import { create } from 'zustand';
import { assemble, executeInstruction, abiName, type Instruction, type AssembledProgram, type MemMap, type ExecResult } from '../engine/riscv';
import { examplePrograms } from '../data/examplePrograms';

export type StageId = 'IF' | 'ID' | 'EX' | 'MEM' | 'WB';

export type HazardType = 'RAW_EX' | 'RAW_MEM' | 'LOAD_USE' | 'CONTROL' | 'STRUCTURAL';

export interface PipelineSlot {
  instr: Instruction;
  stall: boolean;
  flush: boolean;
  // Values computed at each stage (filled as instr advances)
  rs1Val: number;
  rs2Val: number;
  aluResult: number | null;
  memResult: number | null;
  writebackVal: number | null;
  forwardA: null | 'EX_MEM' | 'MEM_WB';
  forwardB: null | 'EX_MEM' | 'MEM_WB';
  hazard: HazardType | null;
  // Branch resolution
  branchTaken: boolean | null;
  branchTarget: number | null;
}

export interface PipelineState {
  IF: PipelineSlot | null;
  ID: PipelineSlot | null;
  EX: PipelineSlot | null;
  MEM: PipelineSlot | null;
  WB: PipelineSlot | null;
}

export interface PipelineHistoryEntry {
  cycle: number;
  stages: { [K in StageId]: PipelineSlot | null };
  stalls: number;
  flushes: number;
}

export interface SimStats {
  cycles: number;
  instructionsRetired: number;
  cpi: number;
  ipc: number;
  stalls: number;
  flushes: number;
  forwardedOps: number;
  hazards: number;
}

export interface TraceEntry {
  cycle: number;
  instr: Instruction;
  changedReg: number | null;
  memAccess: ExecResult['memAccess'];
  explanation: string;
  regSnapshot: number[];
}

export interface AssembleError { line: number; message: string; }

interface SimulatorState {
  // Source & assembled program
  assemblySource: string;
  assembledProgram: AssembledProgram | null;
  assembleErrors: AssembleError[];

  // CPU architectural state
  registers: number[];        // 32 × signed int
  memory: MemMap;             // sparse word-addressed memory
  pc: number;                 // program counter

  // Execution control
  executionMode: 'idle' | 'assembled' | 'running' | 'stepping' | 'complete' | 'error';
  currentCycle: number;
  fetchPC: number;            // the PC the IF stage will fetch next

  // Pipeline state
  pipelineStages: PipelineState;
  pipelineHistory: PipelineHistoryEntry[];
  enableForwarding: boolean;
  enableBranchPrediction: boolean;

  // Metrics
  stats: SimStats;

  // Trace (per retired instruction)
  executionTrace: TraceEntry[];

  // Last step explanation
  lastExplanation: string;
  lastChangedReg: number | null;
  lastMemAccess: ExecResult['memAccess'];

  // Actions
  setSource: (src: string) => void;
  assembleProgram: () => void;
  advanceCycle: () => void;
  runToEnd: () => void;
  reset: () => void;
  setForwarding: (enabled: boolean) => void;
  setBranchPrediction: (enabled: boolean) => void;
}

const EMPTY_PIPELINE: PipelineState = { IF: null, ID: null, EX: null, MEM: null, WB: null };
const INITIAL_STATS: SimStats = { cycles: 0, instructionsRetired: 0, cpi: 0, ipc: 0, stalls: 0, flushes: 0, forwardedOps: 0, hazards: 0 };

function makeSlot(instr: Instruction, regs: number[], rs1Override?: number, rs2Override?: number): PipelineSlot {
  return {
    instr, stall: false, flush: false,
    rs1Val: rs1Override ?? regs[instr.rs1],
    rs2Val: rs2Override ?? regs[instr.rs2],
    aluResult: null, memResult: null, writebackVal: null,
    forwardA: null, forwardB: null, hazard: null,
    branchTaken: null, branchTarget: null,
  };
}

function computeALU(slot: PipelineSlot, pc: number): number {
  const { instr, rs1Val, rs2Val } = slot;
  const imm = instr.imm;
  const u1 = rs1Val >>> 0, u2 = rs2Val >>> 0;
  switch (instr.mnemonic) {
    case 'ADD': return (rs1Val + rs2Val) | 0;
    case 'SUB': return (rs1Val - rs2Val) | 0;
    case 'AND': case 'ANDI': return (rs1Val & (instr.type === 'I' ? imm : rs2Val));
    case 'OR':  case 'ORI':  return (rs1Val | (instr.type === 'I' ? imm : rs2Val));
    case 'XOR': case 'XORI': return (rs1Val ^ (instr.type === 'I' ? imm : rs2Val));
    case 'SLL': return (rs1Val << (rs2Val & 31)) | 0;
    case 'SRL': return (u1 >>> (rs2Val & 31)) | 0;
    case 'SRA': return (rs1Val >> (rs2Val & 31)) | 0;
    case 'SLT': return rs1Val < rs2Val ? 1 : 0;
    case 'SLTU':return u1 < u2 ? 1 : 0;
    case 'MUL': return Math.imul(rs1Val, rs2Val);
    case 'DIV': return rs2Val !== 0 ? Math.trunc(rs1Val / rs2Val) : -1;
    case 'REM': return rs2Val !== 0 ? rs1Val % rs2Val : rs1Val;
    case 'ADDI': case 'JALR': case 'LB': case 'LH': case 'LW': case 'LBU': case 'LHU':
    case 'SB': case 'SH': case 'SW': return rs1Val + imm; // effective address or imm+rs1
    case 'SLTI': return rs1Val < imm ? 1 : 0;
    case 'SLTIU':return (rs1Val >>> 0) < (imm >>> 0) ? 1 : 0;
    case 'SLLI': return (rs1Val << (imm & 31)) | 0;
    case 'SRLI': return ((rs1Val >>> 0) >>> (imm & 31)) | 0;
    case 'SRAI': return (rs1Val >> (imm & 31)) | 0;
    case 'LUI': return (imm << 12) | 0;
    case 'AUIPC': return (pc + (imm << 12)) | 0;
    case 'JAL': return (pc + 4) | 0; // return address
    default: return (rs1Val + imm) | 0;
  }
}

function evaluateBranch(slot: PipelineSlot): { taken: boolean; target: number } {
  const { instr, rs1Val, rs2Val } = slot;
  const u1 = rs1Val >>> 0, u2 = rs2Val >>> 0;
  let taken = false;
  switch (instr.mnemonic) {
    case 'BEQ': taken = rs1Val === rs2Val; break;
    case 'BNE': taken = rs1Val !== rs2Val; break;
    case 'BLT': taken = rs1Val < rs2Val; break;
    case 'BGE': taken = rs1Val >= rs2Val; break;
    case 'BLTU':taken = u1 < u2; break;
    case 'BGEU':taken = u1 >= u2; break;
  }
  const target = taken ? instr.pc + instr.imm : instr.pc + 4;
  return { taken, target };
}

function memRead(mem: MemMap, addr: number, width: number, signed: boolean): number {
  const wordAddr = addr & ~3;
  const word = mem.get(wordAddr) ?? 0;
  const byteOffset = addr & 3;
  if (width === 4) return word | 0;
  const signExt = (v: number, b: number) => (v << (32 - b)) >> (32 - b);
  if (width === 2) { const h = (word >>> (byteOffset * 8)) & 0xffff; return signed ? signExt(h, 16) : h; }
  const b = (word >>> (byteOffset * 8)) & 0xff; return signed ? signExt(b, 8) : b;
}

function memWrite(mem: MemMap, addr: number, val: number, width: number): MemMap {
  const next = new Map(mem);
  const wordAddr = addr & ~3;
  const byteOffset = addr & 3;
  const existing = next.get(wordAddr) ?? 0;
  if (width === 4) { next.set(wordAddr, val); }
  else if (width === 2) { const mask = 0xffff << (byteOffset * 8); next.set(wordAddr, (existing & ~mask) | ((val & 0xffff) << (byteOffset * 8))); }
  else { const mask = 0xff << (byteOffset * 8); next.set(wordAddr, (existing & ~mask) | ((val & 0xff) << (byteOffset * 8))); }
  return next;
}

function advancePipeline(
  current: PipelineState,
  fetchPC: number,
  program: Instruction[],
  registers: number[],
  memory: MemMap,
  enableForwarding: boolean,
  stats: SimStats,
): {
  next: PipelineState;
  newRegisters: number[];
  newMemory: MemMap;
  newFetchPC: number;
  newStats: SimStats;
  retired: TraceEntry | null;
  cycleNum: number;
} {
  let regs = [...registers];
  let mem = new Map(memory);
  const st = { ...stats };
  let retired: TraceEntry | null = null;
  const cycle = st.cycles + 1;

  // Clone slots mutably
  const WB  = current.WB  ? { ...current.WB }  : null;
  const MEM = current.MEM ? { ...current.MEM } : null;
  const EX  = current.EX  ? { ...current.EX }  : null;
  const ID  = current.ID  ? { ...current.ID }  : null;
  const IF  = current.IF  ? { ...current.IF }  : null;

  // ====== WB stage: commit to register file ======
  if (WB && !WB.stall && !WB.flush) {
    const val = WB.writebackVal;
    if (WB.instr.writesRd && WB.instr.rd !== 0 && val !== null) {
      regs[WB.instr.rd] = val;
      regs[0] = 0;
    }
    st.instructionsRetired++;
    // Build trace entry
    retired = {
      cycle, instr: WB.instr,
      changedReg: (WB.instr.writesRd && WB.instr.rd !== 0) ? WB.instr.rd : null,
      memAccess: null, // filled below if store
      explanation: '',
      regSnapshot: [...regs],
    };
  }

  // ====== MEM stage: memory access ======
  let newMEMslot: PipelineSlot | null = null;
  if (MEM && !MEM.stall && !MEM.flush) {
    const addr = MEM.aluResult ?? 0;
    if (MEM.instr.isLoad) {
      const loaded = memRead(mem, addr, MEM.instr.memWidth, MEM.instr.memSigned);
      MEM.memResult = loaded;
      MEM.writebackVal = loaded;
    } else if (MEM.instr.isStore) {
      mem = memWrite(mem, addr, MEM.rs2Val, MEM.instr.memWidth);
      MEM.writebackVal = null;
      if (retired) retired.memAccess = { address: addr, value: MEM.rs2Val, isWrite: true };
    } else {
      MEM.writebackVal = MEM.aluResult;
    }
    if (retired && MEM.instr.isLoad) retired.memAccess = { address: addr, value: MEM.memResult!, isWrite: false };
    newMEMslot = MEM;
  } else if (MEM?.flush) {
    newMEMslot = null;
  }

  // ====== EX stage: compute ALU result, resolve branches ======
  let newEXslot: PipelineSlot | null = null;
  let branchFlush = false;
  let branchTarget = fetchPC;

  if (EX && !EX.stall && !EX.flush) {
    // Apply forwarding
    if (enableForwarding) {
      if (newMEMslot?.instr.writesRd && newMEMslot.instr.rd !== 0 && newMEMslot.instr.rd === EX.instr.rs1) {
        EX.rs1Val = newMEMslot.writebackVal ?? newMEMslot.aluResult ?? EX.rs1Val;
        EX.forwardA = 'EX_MEM'; st.forwardedOps++;
      } else if (WB?.instr.writesRd && WB.instr.rd !== 0 && WB.instr.rd === EX.instr.rs1 && WB.writebackVal !== null) {
        EX.rs1Val = WB.writebackVal;
        EX.forwardA = 'MEM_WB'; st.forwardedOps++;
      }
      if (newMEMslot?.instr.writesRd && newMEMslot.instr.rd !== 0 && newMEMslot.instr.rd === EX.instr.rs2) {
        EX.rs2Val = newMEMslot.writebackVal ?? newMEMslot.aluResult ?? EX.rs2Val;
        EX.forwardB = 'EX_MEM'; st.forwardedOps++;
      } else if (WB?.instr.writesRd && WB.instr.rd !== 0 && WB.instr.rd === EX.instr.rs2 && WB.writebackVal !== null) {
        EX.rs2Val = WB.writebackVal;
        EX.forwardB = 'MEM_WB'; st.forwardedOps++;
      }
    }

    EX.aluResult = computeALU(EX, EX.instr.pc);

    if (EX.instr.isBranch) {
      const { taken, target } = evaluateBranch(EX);
      EX.branchTaken = taken;
      EX.branchTarget = target;
      if (taken) {
        branchFlush = true;
        branchTarget = target;
        st.flushes += 2;
      }
    } else if (EX.instr.isJump) {
      if (EX.instr.mnemonic === 'JAL') {
        branchFlush = true;
        branchTarget = EX.instr.pc + EX.instr.imm;
      } else { // JALR
        branchFlush = true;
        branchTarget = (EX.rs1Val + EX.instr.imm) & ~1;
      }
      EX.branchTarget = branchTarget;
      st.flushes += 2;
    }

    newEXslot = EX;
  } else if (EX?.flush) {
    newEXslot = null;
    st.flushes++;
  } else if (EX?.stall) {
    newEXslot = { ...EX, stall: true };
  }

  // ====== Hazard detection (between ID and EX) ======
  let loadUseStall = false;
  let newIDslot: PipelineSlot | null = null;

  if (ID && !ID.stall && !ID.flush) {
    // Load-use hazard: EX is a load and its rd matches ID's rs1 or rs2
    if (EX && !EX.flush && EX.instr.isLoad && EX.instr.rd !== 0) {
      if (EX.instr.rd === ID.instr.rs1 || EX.instr.rd === ID.instr.rs2) {
        loadUseStall = true;
        ID.hazard = 'LOAD_USE';
        st.stalls++;
        st.hazards++;
      }
    }
    // RAW hazard without forwarding
    if (!enableForwarding && EX && !EX.flush && EX.instr.writesRd && EX.instr.rd !== 0) {
      if (EX.instr.rd === ID.instr.rs1 || EX.instr.rd === ID.instr.rs2) {
        loadUseStall = true;
        ID.hazard = 'RAW_EX';
        st.stalls++;
        st.hazards++;
      }
    }

    // Apply forwarding into ID for register reads
    if (enableForwarding) {
      if (newMEMslot?.instr.writesRd && newMEMslot.instr.rd !== 0 && newMEMslot.instr.rd === ID.instr.rs1) {
        ID.rs1Val = newMEMslot.writebackVal ?? newMEMslot.aluResult ?? regs[ID.instr.rs1];
        ID.forwardA = 'EX_MEM';
      }
      if (newMEMslot?.instr.writesRd && newMEMslot.instr.rd !== 0 && newMEMslot.instr.rd === ID.instr.rs2) {
        ID.rs2Val = newMEMslot.writebackVal ?? newMEMslot.aluResult ?? regs[ID.instr.rs2];
        ID.forwardB = 'EX_MEM';
      }
    }

    newIDslot = loadUseStall ? { ...ID, stall: true } : ID;
  } else if (ID?.flush || branchFlush) {
    newIDslot = null;
  } else if (ID?.stall && !loadUseStall) {
    newIDslot = ID; // maintain stall
  }

  // ====== Shift pipeline forward ======
  const nextWB  = newMEMslot;
  const nextMEM = newEXslot;
  const nextEX  = loadUseStall
    ? { ...makeSlot({ ...newIDslot!.instr, mnemonic: 'NOP', writesRd: false, isBranch: false, isJump: false, isLoad: false, isStore: false } as Instruction, regs), flush: true }
    : (branchFlush ? null : (newIDslot && !newIDslot.stall ? { ...newIDslot } : null));

  // ====== IF stage: fetch next instruction ======
  let newIFslot: PipelineSlot | null = null;
  let newFetchPC = fetchPC;

  if (branchFlush) {
    newFetchPC = branchTarget;
  } else if (loadUseStall) {
    // Freeze IF (keep the same slot)
    newIFslot = IF;
  }

  if (!loadUseStall) {
    const instrAtPC = program.find(i => i.pc === newFetchPC);
    if (instrAtPC) {
      newIFslot = makeSlot(instrAtPC, regs);
      newFetchPC = newFetchPC + 4;
    } else if (newFetchPC < program[0]?.pc || program.length === 0) {
      newIFslot = null;
    }
  }

  const nextID = loadUseStall
    ? { ...newIDslot!, stall: true }
    : (branchFlush ? null : IF ? { ...makeSlot(IF.instr, regs) } : null);

  st.cycles = cycle;
  if (st.instructionsRetired > 0) {
    st.cpi = Math.round(st.cycles / st.instructionsRetired * 100) / 100;
    st.ipc = Math.round(st.instructionsRetired / st.cycles * 100) / 100;
  }

  return {
    next: { IF: newIFslot, ID: nextID, EX: nextEX, MEM: nextMEM, WB: nextWB },
    newRegisters: regs,
    newMemory: mem,
    newFetchPC: loadUseStall ? fetchPC : newFetchPC,
    newStats: st,
    retired,
    cycleNum: cycle,
  };
}

function isPipelineDone(stages: PipelineState, fetchPC: number, program: Instruction[]): boolean {
  const maxPC = program.length > 0 ? program[program.length - 1].pc : -1;
  return fetchPC > maxPC && !stages.IF && !stages.ID && !stages.EX && !stages.MEM && !stages.WB;
}

export const useSimulatorStore = create<SimulatorState>((set, get) => ({
  assemblySource: examplePrograms[0].code,
  assembledProgram: null,
  assembleErrors: [],
  registers: new Array(32).fill(0),
  memory: new Map(),
  pc: 0,
  executionMode: 'idle',
  currentCycle: 0,
  fetchPC: 0,
  pipelineStages: EMPTY_PIPELINE,
  pipelineHistory: [],
  enableForwarding: true,
  enableBranchPrediction: false,
  stats: { ...INITIAL_STATS },
  executionTrace: [],
  lastExplanation: '',
  lastChangedReg: null,
  lastMemAccess: null,

  setSource: (src) => set({ assemblySource: src }),

  assembleProgram: () => {
    const { assemblySource } = get();
    const result = assemble(assemblySource);
    if (result.errors.length > 0 && result.instructions.length === 0) {
      set({ assembleErrors: result.errors, executionMode: 'error', assembledProgram: null });
      return;
    }
    const regs = new Array(32).fill(0);
    const startPC = result.startPC;
    set({
      assembledProgram: result,
      assembleErrors: result.errors,
      executionMode: 'assembled',
      registers: regs,
      memory: new Map(),
      pc: startPC,
      fetchPC: startPC,
      currentCycle: 0,
      pipelineStages: EMPTY_PIPELINE,
      pipelineHistory: [],
      stats: { ...INITIAL_STATS },
      executionTrace: [],
      lastExplanation: `Assembled ${result.instructions.length} instructions successfully. Click "Advance Cycle" to start the pipeline, or "Run All" to execute.`,
      lastChangedReg: null,
      lastMemAccess: null,
    });
  },

  advanceCycle: () => {
    const { assembledProgram, pipelineStages, fetchPC, registers, memory, enableForwarding, stats, pipelineHistory, executionTrace, enableBranchPrediction } = get();
    if (!assembledProgram || assembledProgram.instructions.length === 0) return;

    const result = advancePipeline(
      pipelineStages, fetchPC, assembledProgram.instructions,
      registers, memory, enableForwarding, stats
    );

    // Build explanation for what happened this cycle
    let explanations: string[] = [];
    const stages: { [K in StageId]: PipelineSlot | null } = result.next as any;

    if (result.retired) {
      // Run the full executor to get the explanation
      const execResult = executeInstruction(result.retired.instr, registers, memory);
      result.retired.explanation = execResult.explanation;
      explanations.push(`WB committed: ${result.retired.instr.mnemonic} — ${execResult.explanation}`);
    }
    if (result.next.EX?.instr.isBranch && result.next.EX.branchTaken !== null) {
      explanations.push(`Branch ${result.next.EX.branchTaken ? 'TAKEN (2 flushes)' : 'not taken'}`);
    }
    if (result.newStats.stalls > stats.stalls) {
      explanations.push(`Load-Use stall inserted (1 bubble cycle)`);
    }

    const histEntry: PipelineHistoryEntry = {
      cycle: result.cycleNum,
      stages: {
        IF: result.next.IF, ID: result.next.ID, EX: result.next.EX,
        MEM: result.next.MEM, WB: result.next.WB
      },
      stalls: result.newStats.stalls - stats.stalls,
      flushes: result.newStats.flushes - stats.flushes,
    };

    const newTrace = result.retired ? [...executionTrace, result.retired] : executionTrace;

    const done = isPipelineDone(result.next, result.newFetchPC, assembledProgram.instructions);

    set({
      pipelineStages: result.next,
      registers: result.newRegisters,
      memory: result.newMemory,
      fetchPC: result.newFetchPC,
      pc: result.newFetchPC,
      stats: result.newStats,
      currentCycle: result.cycleNum,
      pipelineHistory: [...pipelineHistory, histEntry],
      executionTrace: newTrace,
      lastExplanation: explanations.join(' | ') || `Cycle ${result.cycleNum} complete`,
      lastChangedReg: result.retired?.changedReg ?? null,
      lastMemAccess: result.retired?.memAccess ?? null,
      executionMode: done ? 'complete' : 'stepping',
    });
  },

  runToEnd: () => {
    const { assembledProgram } = get();
    if (!assembledProgram) return;
    let iterations = 0;
    const MAX = 10000;
    while (iterations < MAX) {
      const { executionMode, pipelineStages, fetchPC } = get();
      if (executionMode === 'complete') break;
      if (isPipelineDone(pipelineStages, fetchPC, assembledProgram.instructions)) {
        set({ executionMode: 'complete' });
        break;
      }
      get().advanceCycle();
      iterations++;
    }
  },

  reset: () => {
    const { assembledProgram } = get();
    const startPC = assembledProgram?.startPC ?? 0;
    set({
      registers: new Array(32).fill(0),
      memory: new Map(),
      pc: startPC,
      fetchPC: startPC,
      executionMode: assembledProgram ? 'assembled' : 'idle',
      currentCycle: 0,
      pipelineStages: EMPTY_PIPELINE,
      pipelineHistory: [],
      stats: { ...INITIAL_STATS },
      executionTrace: [],
      lastExplanation: assembledProgram ? 'Reset. Ready to execute.' : '',
      lastChangedReg: null,
      lastMemAccess: null,
    });
  },

  setForwarding: (enabled) => set({ enableForwarding: enabled }),
  setBranchPrediction: (enabled) => set({ enableBranchPrediction: enabled }),
}));
