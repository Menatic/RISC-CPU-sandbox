export type PredictorType = 
  | 'static_not_taken' | 'static_taken'
  | 'one_bit' | 'two_bit_saturating'
  | 'gshare' | 'tournament';

export interface PredictorState {
  history: string;
  table: number[];
}

export interface BranchPredictor {
  predict(pc: number): boolean;
  update(pc: number, taken: boolean): void;
  getState(): PredictorState;
}

export function createPredictor(type: PredictorType): BranchPredictor {
  let table = new Array(256).fill(0);
  let globalHistory = 0;
  
  if (type === 'two_bit_saturating' || type === 'gshare' || type === 'tournament') {
     table.fill(1); // initialize to weakly not taken
  }

  return {
    predict(pc: number): boolean {
      if (type === 'static_not_taken') return false;
      if (type === 'static_taken') return true;
      
      let index = (pc >> 2) & 0xFF;
      if (type === 'gshare') {
        index = ((pc >> 2) ^ globalHistory) & 0xFF;
      }
      
      if (type === 'one_bit') return table[index] === 1;
      return table[index] >= 2; // two bit: 0,1 not taken, 2,3 taken
    },
    update(pc: number, taken: boolean) {
      let index = (pc >> 2) & 0xFF;
      if (type === 'gshare') {
        index = ((pc >> 2) ^ globalHistory) & 0xFF;
      }
      
      if (type === 'one_bit') {
        table[index] = taken ? 1 : 0;
      } else if (type === 'two_bit_saturating' || type === 'gshare') {
        if (taken && table[index] < 3) table[index]++;
        else if (!taken && table[index] > 0) table[index]--;
      }
      
      globalHistory = ((globalHistory << 1) | (taken ? 1 : 0)) & 0xFF;
    },
    getState() {
      return { history: globalHistory.toString(2).padStart(8, '0'), table: [...table] };
    }
  };
}
