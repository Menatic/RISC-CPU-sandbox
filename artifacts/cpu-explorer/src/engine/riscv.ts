export type Instruction = {
  pc: number;
  raw: number;
  mnemonic: string;
  rd: number | null;
  rs1: number | null;
  rs2: number | null;
  imm: number | null;
  type: 'R' | 'I' | 'S' | 'B' | 'U' | 'J';
  cycles: number;
};

export type AssembledProgram = {
  instructions: Instruction[];
  data: Uint8Array;
};

export type RVState = {
  registers: number[];
  pc: number;
  memory: Uint8Array;
};

export function assemble(source: string): AssembledProgram {
  const instructions: Instruction[] = [];
  const data = new Uint8Array(4 * 1024 * 1024);
  const lines = source.split('\n');
  
  let pc = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    // Very basic parsing for demo
    const parts = trimmed.split(/[\s,]+/);
    const mnemonic = parts[0].toUpperCase();
    
    instructions.push({
      pc,
      raw: 0,
      mnemonic,
      rd: parts.length > 1 ? parseInt(parts[1].replace('x', '')) : null,
      rs1: parts.length > 2 ? parseInt(parts[2].replace('x', '')) : null,
      rs2: parts.length > 3 ? parseInt(parts[3].replace('x', '')) : null,
      imm: null,
      type: 'R',
      cycles: 1
    });
    
    pc += 4;
  }
  
  return { instructions, data };
}

export function disassemble(encoding: number): Instruction {
  return {
    pc: 0,
    raw: encoding,
    mnemonic: 'NOP',
    rd: null, rs1: null, rs2: null, imm: null,
    type: 'I',
    cycles: 1
  };
}

export function executeInstruction(instr: Instruction, state: RVState): RVState {
  const nextState = { ...state, registers: [...state.registers] };
  nextState.pc += 4;
  
  // Basic mock execution
  if (instr.mnemonic === 'ADD' && instr.rd !== null && instr.rs1 !== null && instr.rs2 !== null) {
    nextState.registers[instr.rd] = nextState.registers[instr.rs1] + nextState.registers[instr.rs2];
  } else if (instr.mnemonic === 'ADDI' && instr.rd !== null && instr.rs1 !== null && instr.rs2 !== null) {
     nextState.registers[instr.rd] = nextState.registers[instr.rs1] + instr.rs2; // treating rs2 as imm for simple mock
  }
  
  nextState.registers[0] = 0; // x0 is always 0
  return nextState;
}