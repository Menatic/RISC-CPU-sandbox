import type { PipelineState, SimStats } from '@/store/simulatorStore';

export type WaveSample = {
  cycle: number;
  clk: number;
  rst_n: number;
  pc: number;
  fetch_pc: number;
  if_valid: number;
  id_valid: number;
  ex_valid: number;
  mem_valid: number;
  wb_valid: number;
  if_instr: number;
  id_instr: number;
  ex_instr: number;
  mem_instr: number;
  wb_instr: number;
  if_mnemonic: string;
  id_mnemonic: string;
  ex_mnemonic: string;
  stall: number;
  flush: number;
  load_use: number;
  branch_taken: number;
  fwd_a: number;
  fwd_b: number;
  ex_alu: number;
  dmem_addr: number;
  dmem_we: number;
  wb_wdata: number;
  reg_write: number;
  x1: number;
  x2: number;
  x3: number;
  x4: number;
  retired: number;
  pipeline_depth: number;
};

export type WaveSignal = {
  key: keyof WaveSample;
  label: string;
  width: number;
  group: string;
  format: 'bus' | 'wire' | 'ascii';
};

export const WAVE_SIGNALS: WaveSignal[] = [
  { key: 'clk', label: 'clk', width: 1, group: 'tb', format: 'wire' },
  { key: 'rst_n', label: 'rst_n', width: 1, group: 'tb', format: 'wire' },
  { key: 'pc', label: 'pc[31:0]', width: 32, group: 'dut.pc_gen', format: 'bus' },
  { key: 'fetch_pc', label: 'fetch_pc[31:0]', width: 32, group: 'dut.if_stage', format: 'bus' },
  { key: 'if_valid', label: 'if_valid', width: 1, group: 'dut.if_stage', format: 'wire' },
  { key: 'if_instr', label: 'if_id.instr[31:0]', width: 32, group: 'dut.if_id', format: 'bus' },
  { key: 'if_mnemonic', label: 'if_id.mnemonic', width: 8, group: 'dut.if_id', format: 'ascii' },
  { key: 'id_valid', label: 'id_valid', width: 1, group: 'dut.id_stage', format: 'wire' },
  { key: 'id_instr', label: 'id_ex.instr[31:0]', width: 32, group: 'dut.id_ex', format: 'bus' },
  { key: 'id_mnemonic', label: 'id_ex.mnemonic', width: 8, group: 'dut.id_ex', format: 'ascii' },
  { key: 'stall', label: 'hazard.stall', width: 1, group: 'dut.hazard_unit', format: 'wire' },
  { key: 'load_use', label: 'hazard.load_use', width: 1, group: 'dut.hazard_unit', format: 'wire' },
  { key: 'flush', label: 'hazard.flush', width: 1, group: 'dut.hazard_unit', format: 'wire' },
  { key: 'fwd_a', label: 'fwd_unit.forward_a[1:0]', width: 2, group: 'dut.fwd_unit', format: 'bus' },
  { key: 'fwd_b', label: 'fwd_unit.forward_b[1:0]', width: 2, group: 'dut.fwd_unit', format: 'bus' },
  { key: 'ex_valid', label: 'ex_valid', width: 1, group: 'dut.ex_stage', format: 'wire' },
  { key: 'ex_instr', label: 'ex_mem.instr[31:0]', width: 32, group: 'dut.ex_mem', format: 'bus' },
  { key: 'ex_mnemonic', label: 'ex_mem.mnemonic', width: 8, group: 'dut.ex_mem', format: 'ascii' },
  { key: 'ex_alu', label: 'alu.result[31:0]', width: 32, group: 'dut.alu', format: 'bus' },
  { key: 'branch_taken', label: 'branch.taken', width: 1, group: 'dut.branch_comp', format: 'wire' },
  { key: 'mem_valid', label: 'mem_valid', width: 1, group: 'dut.mem_stage', format: 'wire' },
  { key: 'dmem_addr', label: 'dmem.addr[31:0]', width: 32, group: 'dut.dmem', format: 'bus' },
  { key: 'dmem_we', label: 'dmem.we', width: 1, group: 'dut.dmem', format: 'wire' },
  { key: 'wb_valid', label: 'wb_valid', width: 1, group: 'dut.wb_stage', format: 'wire' },
  { key: 'wb_wdata', label: 'wb_wdata[31:0]', width: 32, group: 'dut.wb_stage', format: 'bus' },
  { key: 'reg_write', label: 'regfile.we', width: 1, group: 'dut.regfile', format: 'wire' },
  { key: 'x1', label: 'x1[31:0]', width: 32, group: 'dut.regfile', format: 'bus' },
  { key: 'x2', label: 'x2[31:0]', width: 32, group: 'dut.regfile', format: 'bus' },
  { key: 'x3', label: 'x3[31:0]', width: 32, group: 'dut.regfile', format: 'bus' },
  { key: 'x4', label: 'x4[31:0]', width: 32, group: 'dut.regfile', format: 'bus' },
  { key: 'retired', label: 'instr_retired[7:0]', width: 8, group: 'dut.stats', format: 'bus' },
  { key: 'pipeline_depth', label: 'pipeline_occupancy[3:0]', width: 4, group: 'dut.stats', format: 'bus' },
];

function slotInstr(stages: PipelineState, stage: keyof PipelineState): number {
  const s = stages[stage];
  if (!s || s.flush) return 0x00000013;
  return s.instr.raw >>> 0;
}

function slotMnemonic(stages: PipelineState, stage: keyof PipelineState): string {
  const s = stages[stage];
  if (!s || s.flush) return 'NOP';
  return s.instr.mnemonic;
}

function slotValid(stages: PipelineState, stage: keyof PipelineState): number {
  const s = stages[stage];
  return s && !s.flush ? 1 : 0;
}

function fwdEncode(f: null | 'EX_MEM' | 'MEM_WB'): number {
  if (f === 'EX_MEM') return 2;
  if (f === 'MEM_WB') return 1;
  return 0;
}

export function captureWaveSample(
  cycle: number,
  fetchPC: number,
  stages: PipelineState,
  registers: number[],
  stats: SimStats,
  events: { stall: boolean; flush: boolean; loadUse: boolean },
): WaveSample {
  const ex = stages.EX;
  const mem = stages.MEM;
  const wb = stages.WB;
  const depth = ['IF', 'ID', 'EX', 'MEM', 'WB'].filter((k) => stages[k as keyof PipelineState]).length;

  return {
    cycle,
    clk: cycle % 2,
    rst_n: 1,
    pc: fetchPC,
    fetch_pc: stages.IF?.instr.pc ?? fetchPC,
    if_valid: slotValid(stages, 'IF'),
    id_valid: slotValid(stages, 'ID'),
    ex_valid: slotValid(stages, 'EX'),
    mem_valid: slotValid(stages, 'MEM'),
    wb_valid: slotValid(stages, 'WB'),
    if_instr: slotInstr(stages, 'IF'),
    id_instr: slotInstr(stages, 'ID'),
    ex_instr: slotInstr(stages, 'EX'),
    mem_instr: slotInstr(stages, 'MEM'),
    wb_instr: slotInstr(stages, 'WB'),
    if_mnemonic: slotMnemonic(stages, 'IF'),
    id_mnemonic: slotMnemonic(stages, 'ID'),
    ex_mnemonic: slotMnemonic(stages, 'EX'),
    stall: events.stall ? 1 : 0,
    flush: events.flush ? 1 : 0,
    load_use: events.loadUse ? 1 : 0,
    branch_taken: ex?.branchTaken ? 1 : 0,
    fwd_a: fwdEncode(ex?.forwardA ?? null),
    fwd_b: fwdEncode(ex?.forwardB ?? null),
    ex_alu: ex?.aluResult ?? 0,
    dmem_addr: mem?.aluResult ?? 0,
    dmem_we: mem?.instr.isStore ? 1 : 0,
    wb_wdata: wb?.writebackVal ?? wb?.aluResult ?? 0,
    reg_write: wb && wb.instr.writesRd && !wb.flush ? 1 : 0,
    x1: registers[1] >>> 0,
    x2: registers[2] >>> 0,
    x3: registers[3] >>> 0,
    x4: registers[4] >>> 0,
    retired: stats.instructionsRetired,
    pipeline_depth: depth,
  };
}

export function formatBusValue(v: number, width: number): string {
  if (width <= 4) return `0x${(v >>> 0).toString(16).toUpperCase()}`;
  const hexLen = Math.ceil(width / 4);
  return `0x${(v >>> 0).toString(16).toUpperCase().padStart(hexLen, '0')}`;
}
