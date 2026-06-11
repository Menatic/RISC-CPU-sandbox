// Complete RV32I + M Extension Assembler and Executor
// Supports: all R/I/S/B/U/J types, M extension, pseudo-instructions, labels

export type InstrType = 'R' | 'I' | 'S' | 'B' | 'U' | 'J';
export type FuncUnit = 'ALU' | 'BRANCH' | 'JUMP' | 'LOAD' | 'STORE' | 'SYSTEM';

export interface BinaryField {
  label: string; bits: string; value: number; hi: number; lo: number;
}

export interface Instruction {
  pc: number;
  raw: number;
  mnemonic: string;
  rd: number; rs1: number; rs2: number; imm: number;
  type: InstrType;
  funcUnit: FuncUnit;
  isLoad: boolean; isStore: boolean; isBranch: boolean; isJump: boolean;
  writesRd: boolean;
  memWidth: 1 | 2 | 4;
  memSigned: boolean;
  srcLine: number;
  srcText: string;
  abiNames: { rd: string; rs1: string; rs2: string };
  fields: BinaryField[];
}

export interface AssembleError { line: number; message: string; }
export interface AssembledProgram {
  instructions: Instruction[];
  labels: Record<string, number>;
  errors: AssembleError[];
  startPC: number;
}

export type MemMap = Map<number, number>; // word-addressed (4-byte aligned)

export interface ExecResult {
  registers: number[];
  memory: MemMap;
  nextPC: number;
  explanation: string;
  changedReg: number | null;
  memAccess: { address: number; value: number; isWrite: boolean } | null;
}

// ABI name table
const ABI: string[] = [
  'zero','ra','sp','gp','tp',
  't0','t1','t2',
  's0','s1',
  'a0','a1','a2','a3','a4','a5','a6','a7',
  's2','s3','s4','s5','s6','s7','s8','s9','s10','s11',
  't3','t4','t5','t6',
];

const ABI_PURPOSE: string[] = [
  'Hardwired 0','Return address','Stack pointer','Global pointer','Thread pointer',
  'Temp','Temp','Temp',
  'Saved / Frame ptr','Saved',
  'Arg / Ret val 1','Arg / Ret val 2','Arg 3','Arg 4','Arg 5','Arg 6','Arg 7','Arg 8',
  'Saved','Saved','Saved','Saved','Saved','Saved','Saved','Saved','Saved','Saved',
  'Temp','Temp','Temp','Temp',
];

export function abiName(r: number): string { return ABI[r] ?? `x${r}`; }
export function abiPurpose(r: number): string { return ABI_PURPOSE[r] ?? ''; }

const REG_NAME_MAP: Record<string, number> = {};
ABI.forEach((name, i) => { REG_NAME_MAP[name] = i; REG_NAME_MAP[`fp`] = 8; });

function parseReg(token: string): number {
  const t = token.trim().toLowerCase();
  if (t.startsWith('x')) { const n = parseInt(t.slice(1)); if (n >= 0 && n <= 31) return n; }
  if (REG_NAME_MAP[t] !== undefined) return REG_NAME_MAP[t];
  throw new Error(`Unknown register: "${token}"`);
}

function parseImm(token: string): number {
  const t = token.trim();
  if (t.startsWith('0x') || t.startsWith('0X')) return parseInt(t, 16);
  if (t.startsWith('0b') || t.startsWith('0B')) return parseInt(t.slice(2), 2);
  const n = parseInt(t, 10);
  if (isNaN(n)) throw new Error(`Invalid immediate: "${token}"`);
  return n;
}

function signExt(value: number, bits: number): number {
  const shift = 32 - bits;
  return (value << shift) >> shift;
}

function bits(value: number, hi: number, lo: number): number {
  return (value >>> lo) & ((1 << (hi - lo + 1)) - 1);
}

function toBinStr(value: number, width: number): string {
  return (value >>> 0).toString(2).padStart(32, '0').slice(32 - width);
}

// Encode R-type
function encodeR(funct7: number, rs2: number, rs1: number, funct3: number, rd: number, opcode: number): number {
  return ((funct7 & 0x7f) << 25) | ((rs2 & 0x1f) << 20) | ((rs1 & 0x1f) << 15) |
         ((funct3 & 0x7) << 12) | ((rd & 0x1f) << 7) | (opcode & 0x7f);
}

function encodeI(imm: number, rs1: number, funct3: number, rd: number, opcode: number): number {
  return ((imm & 0xfff) << 20) | ((rs1 & 0x1f) << 15) | ((funct3 & 0x7) << 12) | ((rd & 0x1f) << 7) | (opcode & 0x7f);
}

function encodeS(imm: number, rs2: number, rs1: number, funct3: number, opcode: number): number {
  const imm11_5 = (imm >> 5) & 0x7f;
  const imm4_0 = imm & 0x1f;
  return (imm11_5 << 25) | ((rs2 & 0x1f) << 20) | ((rs1 & 0x1f) << 15) |
         ((funct3 & 0x7) << 12) | (imm4_0 << 7) | (opcode & 0x7f);
}

function encodeB(imm: number, rs2: number, rs1: number, funct3: number, opcode: number): number {
  const b12 = (imm >> 12) & 1; const b11 = (imm >> 11) & 1;
  const b10_5 = (imm >> 5) & 0x3f; const b4_1 = (imm >> 1) & 0xf;
  return (b12 << 31) | (b10_5 << 25) | ((rs2 & 0x1f) << 20) | ((rs1 & 0x1f) << 15) |
         ((funct3 & 0x7) << 12) | (b4_1 << 8) | (b11 << 7) | (opcode & 0x7f);
}

function encodeU(imm: number, rd: number, opcode: number): number {
  return ((imm & 0xfffff) << 12) | ((rd & 0x1f) << 7) | (opcode & 0x7f);
}

function encodeJ(imm: number, rd: number, opcode: number): number {
  const b20 = (imm >> 20) & 1; const b10_1 = (imm >> 1) & 0x3ff;
  const b11 = (imm >> 11) & 1; const b19_12 = (imm >> 12) & 0xff;
  return (b20 << 31) | (b10_1 << 21) | (b11 << 20) | (b19_12 << 12) | ((rd & 0x1f) << 7) | (opcode & 0x7f);
}

function rFields(raw: number): BinaryField[] {
  return [
    { label:'funct7', hi:31, lo:25, value: bits(raw,31,25), bits: toBinStr(bits(raw,31,25),7) },
    { label:'rs2',    hi:24, lo:20, value: bits(raw,24,20), bits: toBinStr(bits(raw,24,20),5) },
    { label:'rs1',    hi:19, lo:15, value: bits(raw,19,15), bits: toBinStr(bits(raw,19,15),5) },
    { label:'funct3', hi:14, lo:12, value: bits(raw,14,12), bits: toBinStr(bits(raw,14,12),3) },
    { label:'rd',     hi:11, lo:7,  value: bits(raw,11,7),  bits: toBinStr(bits(raw,11,7),5) },
    { label:'opcode', hi:6,  lo:0,  value: bits(raw,6,0),   bits: toBinStr(bits(raw,6,0),7) },
  ];
}
function iFields(raw: number): BinaryField[] {
  return [
    { label:'imm[11:0]', hi:31, lo:20, value: signExt(bits(raw,31,20),12), bits: toBinStr(bits(raw,31,20),12) },
    { label:'rs1',       hi:19, lo:15, value: bits(raw,19,15), bits: toBinStr(bits(raw,19,15),5) },
    { label:'funct3',    hi:14, lo:12, value: bits(raw,14,12), bits: toBinStr(bits(raw,14,12),3) },
    { label:'rd',        hi:11, lo:7,  value: bits(raw,11,7),  bits: toBinStr(bits(raw,11,7),5) },
    { label:'opcode',    hi:6,  lo:0,  value: bits(raw,6,0),   bits: toBinStr(bits(raw,6,0),7) },
  ];
}
function sFields(raw: number): BinaryField[] {
  const imm = signExt((bits(raw,31,25) << 5) | bits(raw,11,7), 12);
  return [
    { label:'imm[11:5]', hi:31, lo:25, value: bits(raw,31,25), bits: toBinStr(bits(raw,31,25),7) },
    { label:'rs2',       hi:24, lo:20, value: bits(raw,24,20), bits: toBinStr(bits(raw,24,20),5) },
    { label:'rs1',       hi:19, lo:15, value: bits(raw,19,15), bits: toBinStr(bits(raw,19,15),5) },
    { label:'funct3',    hi:14, lo:12, value: bits(raw,14,12), bits: toBinStr(bits(raw,14,12),3) },
    { label:'imm[4:0]',  hi:11, lo:7,  value: bits(raw,11,7),  bits: toBinStr(bits(raw,11,7),5) },
    { label:'opcode',    hi:6,  lo:0,  value: bits(raw,6,0),   bits: toBinStr(bits(raw,6,0),7) },
  ];
}
function bFields(raw: number): BinaryField[] {
  return [
    { label:'imm[12|10:5]', hi:31, lo:25, value: bits(raw,31,25), bits: toBinStr(bits(raw,31,25),7) },
    { label:'rs2',          hi:24, lo:20, value: bits(raw,24,20), bits: toBinStr(bits(raw,24,20),5) },
    { label:'rs1',          hi:19, lo:15, value: bits(raw,19,15), bits: toBinStr(bits(raw,19,15),5) },
    { label:'funct3',       hi:14, lo:12, value: bits(raw,14,12), bits: toBinStr(bits(raw,14,12),3) },
    { label:'imm[4:1|11]',  hi:11, lo:7,  value: bits(raw,11,7),  bits: toBinStr(bits(raw,11,7),5) },
    { label:'opcode',       hi:6,  lo:0,  value: bits(raw,6,0),   bits: toBinStr(bits(raw,6,0),7) },
  ];
}
function uFields(raw: number): BinaryField[] {
  return [
    { label:'imm[31:12]', hi:31, lo:12, value: bits(raw,31,12), bits: toBinStr(bits(raw,31,12),20) },
    { label:'rd',         hi:11, lo:7,  value: bits(raw,11,7),  bits: toBinStr(bits(raw,11,7),5) },
    { label:'opcode',     hi:6,  lo:0,  value: bits(raw,6,0),   bits: toBinStr(bits(raw,6,0),7) },
  ];
}
function jFields(raw: number): BinaryField[] {
  return [
    { label:'imm[20|10:1|11|19:12]', hi:31, lo:12, value: bits(raw,31,12), bits: toBinStr(bits(raw,31,12),20) },
    { label:'rd',                    hi:11, lo:7,  value: bits(raw,11,7),  bits: toBinStr(bits(raw,11,7),5) },
    { label:'opcode',                hi:6,  lo:0,  value: bits(raw,6,0),   bits: toBinStr(bits(raw,6,0),7) },
  ];
}

// Tokenize one line: strips comments, returns tokens
function tokenize(line: string): string[] {
  const noComment = line.replace(/#.*$/, '').replace(/\/\/.*$/, '').trim();
  if (!noComment) return [];
  return noComment.split(/[\s,]+/).filter(t => t.length > 0);
}

// Expand pseudo-instructions to real instructions
// Returns array of [mnemonic, ...operands] arrays (one or two instructions)
type RawInstr = string[];

function expandPseudo(tokens: string[], labelMap: Record<string, number>, pc: number): RawInstr[] {
  const [mnem, ...ops] = tokens;
  const m = mnem.toUpperCase();
  switch (m) {
    case 'NOP': return [['ADDI','x0','x0','0']];
    case 'MV':  return [['ADDI', ops[0], ops[1], '0']];
    case 'NOT': return [['XORI', ops[0], ops[1], '-1']];
    case 'NEG': return [['SUB',  ops[0], 'x0',   ops[1]]];
    case 'NEGW':return [['SUBW', ops[0], 'x0',   ops[1]]];
    case 'SEQZ':return [['SLTIU',ops[0], ops[1], '1']];
    case 'SNEZ':return [['SLTU', ops[0], 'x0',   ops[1]]];
    case 'SLTZ':return [['SLT',  ops[0], ops[1], 'x0']];
    case 'SGTZ':return [['SLT',  ops[0], 'x0',   ops[1]]];
    case 'BEQZ':return [['BEQ',  ops[0], 'x0',   ops[1]]];
    case 'BNEZ':return [['BNE',  ops[0], 'x0',   ops[1]]];
    case 'BLEZ':return [['BGE',  'x0',   ops[0], ops[1]]];
    case 'BGEZ':return [['BGE',  ops[0], 'x0',   ops[1]]];
    case 'BLTZ':return [['BLT',  ops[0], 'x0',   ops[1]]];
    case 'BGTZ':return [['BLT',  'x0',   ops[0], ops[1]]];
    case 'BGT': return [['BLT',  ops[1], ops[0], ops[2]]];
    case 'BLE': return [['BGE',  ops[1], ops[0], ops[2]]];
    case 'BGTU':return [['BLTU', ops[1], ops[0], ops[2]]];
    case 'BLEU':return [['BGEU', ops[1], ops[0], ops[2]]];
    case 'J':   return [['JAL',  'x0',   ops[0]]];
    case 'JR':  return [['JALR', 'x0',   ops[0], '0']];
    case 'RET': return [['JALR', 'x0',   'x1',   '0']];
    case 'CALL':return [['JAL',  'x1',   ops[0]]];
    case 'LI': {
      const rd = ops[0]; const imm = parseImm(ops[1]);
      if (imm >= -2048 && imm <= 2047) return [['ADDI', rd, 'x0', String(imm)]];
      // For larger immediates: LUI + ADDI
      const upper = (imm + 0x800) >> 12;
      const lower = imm - (upper << 12);
      return [['LUI', rd, String(upper)], ['ADDI', rd, rd, String(lower)]];
    }
    case 'LA': {
      const rd = ops[0]; const lbl = ops[1];
      const addr = labelMap[lbl];
      if (addr === undefined) throw new Error(`Undefined label: ${lbl}`);
      const offset = addr - pc;
      const upper = (offset + 0x800) >> 12;
      const lower = offset - (upper << 12);
      return [['AUIPC', rd, String(upper)], ['ADDI', rd, rd, String(lower)]];
    }
    default: return [tokens]; // not a pseudo — return as-is
  }
}

// Main assemble function
export function assemble(source: string): AssembledProgram {
  const START_PC = 0x00000000;
  const lines = source.split('\n');
  const errors: AssembleError[] = [];
  const labels: Record<string, number> = {};
  const rawInstrs: { tokens: string[]; srcLine: number; srcText: string }[] = [];

  // Pass 1: collect labels, count instructions
  let pc = START_PC;
  for (let li = 0; li < lines.length; li++) {
    let line = lines[li];
    // Remove comments
    line = line.replace(/#.*$/, '').replace(/\/\/.*$/, '');
    // Handle .section, .text, .data directives (ignore them)
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('.')) continue; // ignore directives

    // Handle labels
    let rest = trimmed;
    const labelMatch = rest.match(/^(\w+):/);
    if (labelMatch) {
      labels[labelMatch[1]] = pc;
      rest = rest.slice(labelMatch[0].length).trim();
    }
    if (!rest) continue;

    const tokens = rest.split(/[\s,]+/).filter(t => t.length > 0);
    if (tokens.length === 0) continue;

    // Count instructions (need to know if pseudo expands to 2)
    try {
      const expanded = expandPseudo(tokens, labels, pc);
      for (let i = 0; i < expanded.length; i++) {
        rawInstrs.push({ tokens: expanded[i], srcLine: li, srcText: expanded.length > 1 ? `${trimmed} (${i+1}/${expanded.length})` : trimmed });
        pc += 4;
      }
    } catch (e) {
      // Pass 1 errors are non-fatal (might be forward references in pseudos)
      rawInstrs.push({ tokens, srcLine: li, srcText: trimmed });
      pc += 4;
    }
  }

  // Pass 2: actually assemble instructions
  const instructions: Instruction[] = [];
  let curPC = START_PC;

  for (const { tokens: tok0, srcLine, srcText } of rawInstrs) {
    try {
      // Re-expand pseudos with full label map
      let expanded: string[][];
      try {
        expanded = expandPseudo(tok0, labels, curPC);
      } catch {
        expanded = [tok0];
      }

      // The expanded list should now be a single instruction (pseudos were already expanded in pass 1)
      // But handle the case where expansion gives 1 instr
      const tok = expanded[0];
      const mnem = tok[0].toUpperCase();
      const instr = assembleOne(mnem, tok.slice(1), curPC, labels, srcLine, srcText);
      instructions.push(instr);
      curPC += 4;
    } catch (e: any) {
      errors.push({ line: srcLine, message: e.message ?? String(e) });
      // Insert NOP
      instructions.push(makeNOP(curPC, srcLine, srcText));
      curPC += 4;
    }
  }

  return { instructions, labels, errors, startPC: START_PC };
}

function makeNOP(pc: number, srcLine: number, srcText: string): Instruction {
  const raw = encodeI(0, 0, 0, 0, 0x13);
  return {
    pc, raw, mnemonic: 'NOP', rd: 0, rs1: 0, rs2: 0, imm: 0,
    type: 'I', funcUnit: 'ALU', isLoad: false, isStore: false,
    isBranch: false, isJump: false, writesRd: false,
    memWidth: 4, memSigned: true, srcLine, srcText,
    abiNames: { rd: 'zero', rs1: 'zero', rs2: 'zero' },
    fields: iFields(raw),
  };
}

// Instruction definition table
interface InstrDef {
  type: InstrType;
  opcode: number;
  funct3?: number;
  funct7?: number;
  funcUnit: FuncUnit;
  isLoad?: boolean; isStore?: boolean; isBranch?: boolean; isJump?: boolean;
  memWidth?: 1|2|4; memSigned?: boolean;
}

const INSTR_TABLE: Record<string, InstrDef> = {
  // R-type ALU
  ADD:   { type:'R', opcode:0x33, funct3:0x0, funct7:0x00, funcUnit:'ALU' },
  SUB:   { type:'R', opcode:0x33, funct3:0x0, funct7:0x20, funcUnit:'ALU' },
  SLL:   { type:'R', opcode:0x33, funct3:0x1, funct7:0x00, funcUnit:'ALU' },
  SLT:   { type:'R', opcode:0x33, funct3:0x2, funct7:0x00, funcUnit:'ALU' },
  SLTU:  { type:'R', opcode:0x33, funct3:0x3, funct7:0x00, funcUnit:'ALU' },
  XOR:   { type:'R', opcode:0x33, funct3:0x4, funct7:0x00, funcUnit:'ALU' },
  SRL:   { type:'R', opcode:0x33, funct3:0x5, funct7:0x00, funcUnit:'ALU' },
  SRA:   { type:'R', opcode:0x33, funct3:0x5, funct7:0x20, funcUnit:'ALU' },
  OR:    { type:'R', opcode:0x33, funct3:0x6, funct7:0x00, funcUnit:'ALU' },
  AND:   { type:'R', opcode:0x33, funct3:0x7, funct7:0x00, funcUnit:'ALU' },
  // M extension
  MUL:   { type:'R', opcode:0x33, funct3:0x0, funct7:0x01, funcUnit:'ALU' },
  MULH:  { type:'R', opcode:0x33, funct3:0x1, funct7:0x01, funcUnit:'ALU' },
  MULHSU:{ type:'R', opcode:0x33, funct3:0x2, funct7:0x01, funcUnit:'ALU' },
  MULHU: { type:'R', opcode:0x33, funct3:0x3, funct7:0x01, funcUnit:'ALU' },
  DIV:   { type:'R', opcode:0x33, funct3:0x4, funct7:0x01, funcUnit:'ALU' },
  DIVU:  { type:'R', opcode:0x33, funct3:0x5, funct7:0x01, funcUnit:'ALU' },
  REM:   { type:'R', opcode:0x33, funct3:0x6, funct7:0x01, funcUnit:'ALU' },
  REMU:  { type:'R', opcode:0x33, funct3:0x7, funct7:0x01, funcUnit:'ALU' },
  // I-type ALU
  ADDI:  { type:'I', opcode:0x13, funct3:0x0, funcUnit:'ALU' },
  SLTI:  { type:'I', opcode:0x13, funct3:0x2, funcUnit:'ALU' },
  SLTIU: { type:'I', opcode:0x13, funct3:0x3, funcUnit:'ALU' },
  XORI:  { type:'I', opcode:0x13, funct3:0x4, funcUnit:'ALU' },
  ORI:   { type:'I', opcode:0x13, funct3:0x6, funcUnit:'ALU' },
  ANDI:  { type:'I', opcode:0x13, funct3:0x7, funcUnit:'ALU' },
  SLLI:  { type:'I', opcode:0x13, funct3:0x1, funct7:0x00, funcUnit:'ALU' },
  SRLI:  { type:'I', opcode:0x13, funct3:0x5, funct7:0x00, funcUnit:'ALU' },
  SRAI:  { type:'I', opcode:0x13, funct3:0x5, funct7:0x20, funcUnit:'ALU' },
  // Loads
  LB:  { type:'I', opcode:0x03, funct3:0x0, funcUnit:'LOAD', isLoad:true, memWidth:1, memSigned:true },
  LH:  { type:'I', opcode:0x03, funct3:0x1, funcUnit:'LOAD', isLoad:true, memWidth:2, memSigned:true },
  LW:  { type:'I', opcode:0x03, funct3:0x2, funcUnit:'LOAD', isLoad:true, memWidth:4, memSigned:true },
  LBU: { type:'I', opcode:0x03, funct3:0x4, funcUnit:'LOAD', isLoad:true, memWidth:1, memSigned:false },
  LHU: { type:'I', opcode:0x03, funct3:0x5, funcUnit:'LOAD', isLoad:true, memWidth:2, memSigned:false },
  // Stores
  SB:  { type:'S', opcode:0x23, funct3:0x0, funcUnit:'STORE', isStore:true, memWidth:1 },
  SH:  { type:'S', opcode:0x23, funct3:0x1, funcUnit:'STORE', isStore:true, memWidth:2 },
  SW:  { type:'S', opcode:0x23, funct3:0x2, funcUnit:'STORE', isStore:true, memWidth:4 },
  // Branches
  BEQ:  { type:'B', opcode:0x63, funct3:0x0, funcUnit:'BRANCH', isBranch:true },
  BNE:  { type:'B', opcode:0x63, funct3:0x1, funcUnit:'BRANCH', isBranch:true },
  BLT:  { type:'B', opcode:0x63, funct3:0x4, funcUnit:'BRANCH', isBranch:true },
  BGE:  { type:'B', opcode:0x63, funct3:0x5, funcUnit:'BRANCH', isBranch:true },
  BLTU: { type:'B', opcode:0x63, funct3:0x6, funcUnit:'BRANCH', isBranch:true },
  BGEU: { type:'B', opcode:0x63, funct3:0x7, funcUnit:'BRANCH', isBranch:true },
  // Upper immediates
  LUI:   { type:'U', opcode:0x37, funcUnit:'ALU' },
  AUIPC: { type:'U', opcode:0x17, funcUnit:'ALU' },
  // Jumps
  JAL:  { type:'J', opcode:0x6f, funcUnit:'JUMP', isJump:true },
  JALR: { type:'I', opcode:0x67, funct3:0x0, funcUnit:'JUMP', isJump:true },
  // System
  ECALL:  { type:'I', opcode:0x73, funct3:0x0, funcUnit:'SYSTEM' },
  EBREAK: { type:'I', opcode:0x73, funct3:0x0, funcUnit:'SYSTEM' },
};

function resolveLabel(op: string, labels: Record<string, number>, pc: number): number {
  if (labels[op] !== undefined) return labels[op] - pc;
  return parseImm(op);
}

function assembleOne(mnem: string, ops: string[], pc: number, labels: Record<string, number>, srcLine: number, srcText: string): Instruction {
  const def = INSTR_TABLE[mnem];
  if (!def) throw new Error(`Unknown instruction: ${mnem}`);

  let rd = 0, rs1 = 0, rs2 = 0, imm = 0, raw = 0;

  if (def.type === 'R') {
    rd = parseReg(ops[0]); rs1 = parseReg(ops[1]); rs2 = parseReg(ops[2]);
    raw = encodeR(def.funct7 ?? 0, rs2, rs1, def.funct3 ?? 0, rd, def.opcode);
  } else if (def.type === 'I') {
    if (def.isLoad) {
      // format: LW rd, imm(rs1)
      rd = parseReg(ops[0]);
      const memOp = ops[1];
      const match = memOp.match(/^(-?\d+|0x[0-9a-fA-F]+)\((\w+)\)$/);
      if (match) { imm = parseImm(match[1]); rs1 = parseReg(match[2]); }
      else { imm = parseImm(ops[1]); rs1 = parseReg(ops[2]); }
    } else if (def.isJump && mnem === 'JALR') {
      rd = parseReg(ops[0]);
      if (ops.length === 2) { // JALR rd, rs1 (imm=0) or JALR rd, imm(rs1)
        const match = ops[1].match(/^(-?\d+|0x[0-9a-fA-F]+)\((\w+)\)$/);
        if (match) { imm = parseImm(match[1]); rs1 = parseReg(match[2]); }
        else { rs1 = parseReg(ops[1]); imm = 0; }
      } else {
        rs1 = parseReg(ops[1]); imm = parseImm(ops[2]);
      }
    } else if (mnem === 'SLLI' || mnem === 'SRLI' || mnem === 'SRAI') {
      rd = parseReg(ops[0]); rs1 = parseReg(ops[1]); imm = parseImm(ops[2]) & 0x1f;
      const shamt = imm;
      const funct7 = (mnem === 'SRAI') ? 0x20 : 0x00;
      raw = encodeR(funct7, shamt, rs1, def.funct3 ?? 0, rd, def.opcode);
      return buildInstr(mnem, def, raw, rd, rs1, rs2, imm, pc, srcLine, srcText, iFields(raw));
    } else {
      rd = parseReg(ops[0]); rs1 = parseReg(ops[1]);
      imm = resolveLabel(ops[2], labels, pc);
    }
    raw = encodeI(imm, rs1, def.funct3 ?? 0, rd, def.opcode);
  } else if (def.type === 'S') {
    // SW rs2, imm(rs1)
    rs2 = parseReg(ops[0]);
    const memOp = ops[1];
    const match = memOp.match(/^(-?\d+|0x[0-9a-fA-F]+)\((\w+)\)$/);
    if (match) { imm = parseImm(match[1]); rs1 = parseReg(match[2]); }
    else { imm = parseImm(ops[1]); rs1 = parseReg(ops[2]); }
    raw = encodeS(imm, rs2, rs1, def.funct3 ?? 0, def.opcode);
  } else if (def.type === 'B') {
    rs1 = parseReg(ops[0]); rs2 = parseReg(ops[1]);
    imm = resolveLabel(ops[2], labels, pc);
    raw = encodeB(imm, rs2, rs1, def.funct3 ?? 0, def.opcode);
  } else if (def.type === 'U') {
    rd = parseReg(ops[0]); imm = parseImm(ops[1]);
    raw = encodeU(imm, rd, def.opcode);
  } else if (def.type === 'J') {
    rd = parseReg(ops[0]);
    imm = resolveLabel(ops[1], labels, pc);
    raw = encodeJ(imm, rd, def.opcode);
  }

  let fields: BinaryField[];
  switch(def.type) {
    case 'R': fields = rFields(raw); break;
    case 'I': fields = iFields(raw); break;
    case 'S': fields = sFields(raw); break;
    case 'B': fields = bFields(raw); break;
    case 'U': fields = uFields(raw); break;
    case 'J': fields = jFields(raw); break;
  }

  return buildInstr(mnem, def, raw, rd, rs1, rs2, imm, pc, srcLine, srcText, fields);
}

function buildInstr(mnem: string, def: InstrDef, raw: number, rd: number, rs1: number, rs2: number, imm: number,
  pc: number, srcLine: number, srcText: string, fields: BinaryField[]): Instruction {
  const writesRd = def.type !== 'S' && def.type !== 'B' && rd !== 0;
  return {
    pc, raw: raw >>> 0, mnemonic: mnem, rd, rs1, rs2, imm,
    type: def.type, funcUnit: def.funcUnit,
    isLoad: def.isLoad ?? false, isStore: def.isStore ?? false,
    isBranch: def.isBranch ?? false, isJump: def.isJump ?? false,
    writesRd: writesRd || (def.isLoad ?? false),
    memWidth: def.memWidth ?? 4, memSigned: def.memSigned ?? true,
    srcLine, srcText,
    abiNames: { rd: abiName(rd), rs1: abiName(rs1), rs2: abiName(rs2) },
    fields,
  };
}

// Execute one instruction, return complete new state
export function executeInstruction(
  instr: Instruction,
  registers: number[],
  memory: MemMap,
): ExecResult {
  const regs = [...registers];
  const mem = new Map(memory);
  let nextPC = instr.pc + 4;
  let changedReg: number | null = null;
  let memAccess: ExecResult['memAccess'] = null;
  let explanation = '';

  const r = (n: number) => regs[n]; // signed register read
  const v1 = r(instr.rs1);
  const v2 = r(instr.rs2);
  const imm = instr.imm;
  const u1 = v1 >>> 0; // unsigned
  const u2 = v2 >>> 0;

  function setRd(val: number) {
    if (instr.rd !== 0) { regs[instr.rd] = val | 0; changedReg = instr.rd; }
  }

  function memRead(addr: number, width: number, signed: boolean): number {
    const wordAddr = addr & ~3;
    const word = mem.get(wordAddr) ?? 0;
    const byteOffset = addr & 3;
    if (width === 4) return word | 0;
    if (width === 2) { const half = (word >>> (byteOffset * 8)) & 0xffff; return signed ? signExt(half, 16) : half; }
    const byte_ = (word >>> (byteOffset * 8)) & 0xff;
    return signed ? signExt(byte_, 8) : byte_;
  }

  function memWrite(addr: number, val: number, width: number) {
    const wordAddr = addr & ~3;
    const byteOffset = addr & 3;
    const existing = mem.get(wordAddr) ?? 0;
    let result = existing;
    if (width === 4) { result = val; }
    else if (width === 2) { const mask = 0xffff << (byteOffset * 8); result = (existing & ~mask) | ((val & 0xffff) << (byteOffset * 8)); }
    else { const mask = 0xff << (byteOffset * 8); result = (existing & ~mask) | ((val & 0xff) << (byteOffset * 8)); }
    mem.set(wordAddr, result);
  }

  const n1 = abiName(instr.rs1); const n2 = abiName(instr.rs2); const nd = abiName(instr.rd);
  const hex = (v: number) => '0x' + (v >>> 0).toString(16).toUpperCase().padStart(8, '0');

  switch (instr.mnemonic) {
    case 'ADD':  { const res = (v1 + v2) | 0; setRd(res); explanation = `${nd} = ${n1}(${v1}) + ${n2}(${v2}) = ${res}`; break; }
    case 'SUB':  { const res = (v1 - v2) | 0; setRd(res); explanation = `${nd} = ${n1}(${v1}) − ${n2}(${v2}) = ${res}`; break; }
    case 'AND':  { const res = v1 & v2; setRd(res); explanation = `${nd} = ${n1}(${hex(v1)}) AND ${n2}(${hex(v2)}) = ${hex(res)}`; break; }
    case 'OR':   { const res = v1 | v2; setRd(res); explanation = `${nd} = ${n1}(${hex(v1)}) OR ${n2}(${hex(v2)}) = ${hex(res)}`; break; }
    case 'XOR':  { const res = v1 ^ v2; setRd(res); explanation = `${nd} = ${n1}(${hex(v1)}) XOR ${n2}(${hex(v2)}) = ${hex(res)}`; break; }
    case 'SLL':  { const res = (v1 << (u2 & 31)) | 0; setRd(res); explanation = `${nd} = ${n1}(${v1}) << ${u2 & 31} bits = ${res}`; break; }
    case 'SRL':  { const res = (u1 >>> (u2 & 31)) | 0; setRd(res); explanation = `${nd} = ${n1}(${v1}) >> ${u2 & 31} (logical) = ${res}`; break; }
    case 'SRA':  { const res = (v1 >> (u2 & 31)) | 0; setRd(res); explanation = `${nd} = ${n1}(${v1}) >> ${u2 & 31} (arithmetic) = ${res}`; break; }
    case 'SLT':  { const res = v1 < v2 ? 1 : 0; setRd(res); explanation = `${nd} = (${n1}(${v1}) < ${n2}(${v2})) = ${res}`; break; }
    case 'SLTU': { const res = u1 < u2 ? 1 : 0; setRd(res); explanation = `${nd} = (${n1}(${v1}) <u ${n2}(${v2})) = ${res} (unsigned)`; break; }
    case 'MUL':  { const res = Math.imul(v1, v2); setRd(res); explanation = `${nd} = ${n1}(${v1}) × ${n2}(${v2}) = ${res} (lower 32 bits)`; break; }
    case 'MULH': { const res = Math.floor(v1 * v2 / 2**32) | 0; setRd(res); explanation = `${nd} = upper 32 bits of ${n1}(${v1}) × ${n2}(${v2}) = ${res}`; break; }
    case 'DIV':  { const res = v2 !== 0 ? Math.trunc(v1 / v2) : -1; setRd(res); explanation = v2 !== 0 ? `${nd} = ${n1}(${v1}) ÷ ${n2}(${v2}) = ${res}` : `Division by zero! Result = -1`; break; }
    case 'DIVU': { const res = u2 !== 0 ? Math.floor(u1 / u2) : 0xffffffff; setRd(res); explanation = u2 !== 0 ? `${nd} = ${n1}(${u1}) ÷u ${n2}(${u2}) = ${res}` : `Division by zero (unsigned)!`; break; }
    case 'REM':  { const res = v2 !== 0 ? v1 % v2 : v1; setRd(res); explanation = `${nd} = ${n1}(${v1}) mod ${n2}(${v2}) = ${res}`; break; }
    case 'REMU': { const res = u2 !== 0 ? u1 % u2 : u1; setRd(res); explanation = `${nd} = ${n1}(${u1}) mod_u ${n2}(${u2}) = ${res}`; break; }
    case 'ADDI': { const res = (v1 + imm) | 0; setRd(res); explanation = `${nd} = ${n1}(${v1}) + imm(${imm}) = ${res}`; break; }
    case 'SLTI': { const res = v1 < imm ? 1 : 0; setRd(res); explanation = `${nd} = (${n1}(${v1}) < ${imm}) = ${res}`; break; }
    case 'SLTIU':{ const res = (v1 >>> 0) < (imm >>> 0) ? 1 : 0; setRd(res); explanation = `${nd} = (${n1} <u ${imm}) = ${res}`; break; }
    case 'XORI': { const res = v1 ^ imm; setRd(res); explanation = `${nd} = ${n1}(${hex(v1)}) XOR ${hex(imm)} = ${hex(res)}`; break; }
    case 'ORI':  { const res = v1 | imm; setRd(res); explanation = `${nd} = ${n1}(${hex(v1)}) OR ${hex(imm)} = ${hex(res)}`; break; }
    case 'ANDI': { const res = v1 & imm; setRd(res); explanation = `${nd} = ${n1}(${hex(v1)}) AND ${hex(imm)} = ${hex(res)}`; break; }
    case 'SLLI': { const res = (v1 << (imm & 31)) | 0; setRd(res); explanation = `${nd} = ${n1}(${v1}) << ${imm & 31} = ${res}`; break; }
    case 'SRLI': { const res = (u1 >>> (imm & 31)) | 0; setRd(res); explanation = `${nd} = ${n1}(${v1}) >>> ${imm & 31} (logical) = ${res}`; break; }
    case 'SRAI': { const res = (v1 >> (imm & 31)) | 0; setRd(res); explanation = `${nd} = ${n1}(${v1}) >> ${imm & 31} (arithmetic, sign-preserved) = ${res}`; break; }
    case 'LUI':  { const res = (imm << 12) | 0; setRd(res); explanation = `${nd} = ${imm} << 12 = ${hex(res)}  (Load Upper Immediate: fills bits [31:12])`; break; }
    case 'AUIPC':{ const res = (instr.pc + (imm << 12)) | 0; setRd(res); explanation = `${nd} = PC(${hex(instr.pc)}) + ${hex(imm << 12)} = ${hex(res)}  (Add Upper Immediate to PC)`; break; }
    case 'JAL':  { setRd(instr.pc + 4); nextPC = instr.pc + imm; explanation = `Jump: x${instr.rd}(${nd}) = ${hex(instr.pc + 4)} (return addr), PC → ${hex(nextPC)}`; break; }
    case 'JALR': { const target = (v1 + imm) & ~1; setRd(instr.pc + 4); nextPC = target; explanation = `Jump: x${instr.rd}(${nd}) = ${hex(instr.pc + 4)}, PC → ${n1}(${hex(v1)}) + ${imm} = ${hex(target)}`; break; }
    case 'LB': case 'LH': case 'LW': case 'LBU': case 'LHU': {
      const addr = v1 + imm;
      const loaded = memRead(addr, instr.memWidth, instr.memSigned);
      setRd(loaded);
      memAccess = { address: addr, value: loaded, isWrite: false };
      explanation = `${nd} = Memory[${n1}(${v1}) + ${imm} = ${hex(addr)}] = ${loaded}`;
      break;
    }
    case 'SB': case 'SH': case 'SW': {
      const addr = v1 + imm;
      memWrite(addr, v2, instr.memWidth);
      memAccess = { address: addr, value: v2, isWrite: true };
      explanation = `Memory[${n1}(${v1}) + ${imm} = ${hex(addr)}] = ${n2}(${v2})`;
      break;
    }
    case 'BEQ': {
      const taken = v1 === v2;
      if (taken) nextPC = instr.pc + imm;
      explanation = taken
        ? `${n1}(${v1}) == ${n2}(${v2}) ✓  Branch TAKEN → PC = ${hex(nextPC)}`
        : `${n1}(${v1}) ≠ ${n2}(${v2}) ✗  Branch NOT taken, continue`;
      break;
    }
    case 'BNE': {
      const taken = v1 !== v2;
      if (taken) nextPC = instr.pc + imm;
      explanation = taken
        ? `${n1}(${v1}) ≠ ${n2}(${v2}) ✓  Branch TAKEN → PC = ${hex(nextPC)}`
        : `${n1}(${v1}) == ${n2}(${v2}) ✗  Branch NOT taken`;
      break;
    }
    case 'BLT': {
      const taken = v1 < v2;
      if (taken) nextPC = instr.pc + imm;
      explanation = taken
        ? `${n1}(${v1}) < ${n2}(${v2}) ✓  Branch TAKEN → PC = ${hex(nextPC)}`
        : `${n1}(${v1}) ≥ ${n2}(${v2}) ✗  Branch NOT taken`;
      break;
    }
    case 'BGE': {
      const taken = v1 >= v2;
      if (taken) nextPC = instr.pc + imm;
      explanation = taken
        ? `${n1}(${v1}) ≥ ${n2}(${v2}) ✓  Branch TAKEN → PC = ${hex(nextPC)}`
        : `${n1}(${v1}) < ${n2}(${v2}) ✗  Branch NOT taken`;
      break;
    }
    case 'BLTU': {
      const taken = (v1 >>> 0) < (v2 >>> 0);
      if (taken) nextPC = instr.pc + imm;
      explanation = taken ? `Branch TAKEN (unsigned)` : `Branch NOT taken (unsigned)`;
      break;
    }
    case 'BGEU': {
      const taken = (v1 >>> 0) >= (v2 >>> 0);
      if (taken) nextPC = instr.pc + imm;
      explanation = taken ? `Branch TAKEN (unsigned)` : `Branch NOT taken (unsigned)`;
      break;
    }
    case 'ECALL':
    case 'EBREAK':
      explanation = `System call (a7=${regs[17]}). In a real system, this would trap to the OS.`;
      break;
    default:
      explanation = `Instruction ${instr.mnemonic} executed (NOP equivalent)`;
  }

  regs[0] = 0; // x0 always 0
  return { registers: regs, memory: mem, nextPC, explanation, changedReg, memAccess };
}

export function instrDescription(instr: Instruction): string {
  const { mnemonic: m, rd, rs1, rs2, imm, abiNames: n, type } = instr;
  const r = (x: number) => `x${x}(${abiName(x)})`;
  switch(type) {
    case 'R': return `${m} ${r(rd)}, ${r(rs1)}, ${r(rs2)}`;
    case 'I': {
      if (instr.isLoad) return `${m} ${r(rd)}, ${imm}(${r(rs1)})`;
      if (instr.isJump) return `${m} ${r(rd)}, ${r(rs1)}, ${imm}`;
      return `${m} ${r(rd)}, ${r(rs1)}, ${imm}`;
    }
    case 'S': return `${m} ${r(rs2)}, ${imm}(${r(rs1)})`;
    case 'B': return `${m} ${r(rs1)}, ${r(rs2)}, ${imm}`;
    case 'U': return `${m} ${r(rd)}, ${imm}`;
    case 'J': return `${m} ${r(rd)}, ${imm}`;
  }
}
