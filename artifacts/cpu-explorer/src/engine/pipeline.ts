import { Instruction } from './riscv';

export type HazardType = 'RAW' | 'WAR' | 'WAW' | 'Control' | 'Structural';

export type ForwardingPath = {
  fromStage: 'EX' | 'MEM' | 'WB';
  toStage: 'EX' | 'ID';
  register: number;
  value: number;
};

export type PipelineSlot = {
  instruction: Instruction;
  stall: boolean;
  flush: boolean;
  hazardType: HazardType | null;
  forwardingSources: ForwardingPath[];
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

export type CycleTrace = {
  cycle: number;
  stages: PipelineState;
  hazards: { type: HazardType; description: string }[];
  stalls: number;
  flushes: number;
  forwards: ForwardingPath[];
  branchPrediction: { predicted: boolean; taken: boolean; correct: boolean } | null;
};

export function advanceCycle(state: PipelineState, cycle: number): { nextState: PipelineState; trace: CycleTrace } {
  // Mock pipeline advance
  const nextState: PipelineState = {
    IF: null,
    ID: state.IF ? { ...state.IF, stage: 'ID', cycleEntered: cycle } : null,
    EX: state.ID ? { ...state.ID, stage: 'EX', cycleEntered: cycle } : null,
    MEM: state.EX ? { ...state.EX, stage: 'MEM', cycleEntered: cycle } : null,
    WB: state.MEM ? { ...state.MEM, stage: 'WB', cycleEntered: cycle } : null,
  };

  return {
    nextState,
    trace: {
      cycle,
      stages: nextState,
      hazards: [],
      stalls: 0,
      flushes: 0,
      forwards: [],
      branchPrediction: null,
    }
  };
}
