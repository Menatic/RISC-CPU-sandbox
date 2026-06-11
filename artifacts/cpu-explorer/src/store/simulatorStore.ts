import { create } from 'zustand';

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

export type CycleTrace = {
  cycle: number;
  pc: number;
};

export type PipelineSlot = {
  instruction: Instruction;
  stall: boolean;
  flush: boolean;
  stage: 'IF' | 'ID' | 'EX' | 'MEM' | 'WB';
  cycleEntered: number;
};

export type PipelineState = {
  IF: PipelineSlot | null;
  ID: PipelineSlot | null;
  EX: PipelineSlot | null;
  MEM: PipelineSlot | null;
  WB: PipelineSlot | null;
};

interface SimulatorState {
  registers: number[];
  pc: number;
  memory: Uint8Array;
  instructionMemory: Instruction[];
  
  assembledProgram: AssembledProgram | null;
  assemblySource: string;
  
  executionMode: 'idle' | 'running' | 'paused' | 'stepped' | 'complete';
  currentCycle: number;
  executionTrace: CycleTrace[];
  
  pipelineStages: PipelineState;
  
  cpi: number;
  ipc: number;
  cyclesElapsed: number;
  instructionsRetired: number;
  
  setSource: (src: string) => void;
  reset: () => void;
}

export const useSimulatorStore = create<SimulatorState>((set) => ({
  registers: new Array(32).fill(0),
  pc: 0,
  memory: new Uint8Array(4 * 1024 * 1024),
  instructionMemory: [],
  
  assembledProgram: null,
  assemblySource: '',
  
  executionMode: 'idle',
  currentCycle: 0,
  executionTrace: [],
  
  pipelineStages: { IF: null, ID: null, EX: null, MEM: null, WB: null },
  
  cpi: 0,
  ipc: 0,
  cyclesElapsed: 0,
  instructionsRetired: 0,
  
  setSource: (src) => set({ assemblySource: src }),
  reset: () => set({ 
    registers: new Array(32).fill(0), 
    pc: 0, 
    executionMode: 'idle', 
    currentCycle: 0 
  })
}));
