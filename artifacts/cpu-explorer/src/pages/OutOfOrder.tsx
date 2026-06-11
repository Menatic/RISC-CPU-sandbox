import { useState, useCallback } from 'react';
import { Play, RotateCcw, StepForward, Info, ChevronRight } from 'lucide-react';

type RSEntry = {
  id: string; busy: boolean; op: string;
  vj: number | null; vk: number | null;
  qj: string | null; qk: string | null;
  dest: number; cyclesLeft: number;
};

type ROBEntry = {
  id: number; mnemonic: string; dest: number;
  state: 'Issue' | 'Execute' | 'Write' | 'Commit';
  result: number | null; ready: boolean;
};

type TomasuloState = {
  cycle: number;
  regs: number[];  // architectural registers (32)
  physRegs: number[];  // physical registers (64)
  renameTable: number[];  // arch -> phys mapping
  rs: RSEntry[];
  rob: ROBEntry[];
  committed: { dest: number; value: number; instr: string }[];
  log: string[];
};

const INITIAL_INSTRS = [
  { mnemonic: 'ADD', rd: 1, rs1: 2, rs2: 3 },   // x1 = x2 + x3
  { mnemonic: 'MUL', rd: 4, rs1: 1, rs2: 5 },   // x4 = x1 * x5  (RAW on x1)
  { mnemonic: 'ADD', rd: 6, rs1: 3, rs2: 7 },   // x6 = x3 + x7  (can exec OOO)
  { mnemonic: 'SUB', rd: 8, rs1: 4, rs2: 6 },   // x8 = x4 - x6  (depends on x4, x6)
  { mnemonic: 'ADD', rd: 1, rs1: 6, rs2: 8 },   // x1 = x6 + x8  (WAW on x1, RAW on x6,x8)
];

const EXEC_LATENCIES: Record<string, number> = { ADD: 1, SUB: 1, MUL: 3, DIV: 6 };

function makeInitialState(): TomasuloState {
  const regs = new Array(32).fill(0);
  regs[2] = 5; regs[3] = 3; regs[5] = 4; regs[7] = 2;
  const physRegs = [...regs, ...new Array(32).fill(0)];
  const renameTable = Array.from({length: 32}, (_, i) => i);
  
  const rs: RSEntry[] = [
    ...['RS_ALU_0','RS_ALU_1','RS_ALU_2'].map(id => ({
      id, busy: false, op: '', vj: null, vk: null, qj: null, qk: null, dest: -1, cyclesLeft: 0
    })),
    ...['RS_MUL_0','RS_MUL_1'].map(id => ({
      id, busy: false, op: '', vj: null, vk: null, qj: null, qk: null, dest: -1, cyclesLeft: 0
    })),
  ];
  return { cycle: 0, regs, physRegs, renameTable, rs, rob: [], committed: [], log: ['Tomasulo engine initialized. Initial registers: x2=5, x3=3, x5=4, x7=2'] };
}

export default function OutOfOrder() {
  const [state, setState] = useState<TomasuloState>(makeInitialState());
  const [instrPtr, setInstrPtr] = useState(0);
  const [done, setDone] = useState(false);

  const step = useCallback(() => {
    setState(prev => {
      const next: TomasuloState = {
        ...prev,
        cycle: prev.cycle + 1,
        rs: prev.rs.map(r => ({ ...r })),
        rob: prev.rob.map(r => ({ ...r })),
        physRegs: [...prev.physRegs],
        renameTable: [...prev.renameTable],
        regs: [...prev.regs],
        committed: [...prev.committed],
        log: [...prev.log],
      };
      const log = next.log;

      // === COMMIT stage ===
      const head = next.rob[0];
      if (head?.ready && head.state === 'Write') {
        head.state = 'Commit';
        next.regs[head.dest] = head.result!;
        log.push(`Cycle ${next.cycle}: COMMIT ROB#${head.id} → x${head.dest} = ${head.result}`);
        next.committed.push({ dest: head.dest, value: head.result!, instr: head.mnemonic + ' x' + head.dest });
        next.rob.shift();
      }

      // === WRITE BACK (CDB) ===
      for (const rs of next.rs) {
        if (rs.busy && rs.cyclesLeft === 1) {
          const result = rs.op === 'ADD' ? (rs.vj ?? 0) + (rs.vk ?? 0)
                       : rs.op === 'SUB' ? (rs.vj ?? 0) - (rs.vk ?? 0)
                       : rs.op === 'MUL' ? (rs.vj ?? 0) * (rs.vk ?? 0)
                       : 0;
          next.physRegs[rs.dest] = result;
          // broadcast on CDB: update waiting RS entries
          for (const other of next.rs) {
            if (other.qj === rs.id) { other.vj = result; other.qj = null; }
            if (other.qk === rs.id) { other.vk = result; other.qk = null; }
          }
          // update ROB
          const robEntry = next.rob.find(r => r.id === rs.dest);
          if (robEntry) { robEntry.result = result; robEntry.state = 'Write'; robEntry.ready = true; }
          log.push(`Cycle ${next.cycle}: CDB BROADCAST ${rs.id} → result = ${result}`);
          rs.busy = false; rs.op = ''; rs.vj = null; rs.vk = null; rs.qj = null; rs.qk = null;
        }
      }

      // === EXECUTE: decrement counters ===
      for (const rs of next.rs) {
        if (rs.busy && rs.vj !== null && rs.vk !== null && rs.cyclesLeft > 1) {
          rs.cyclesLeft--;
          const robEntry = next.rob.find(r => r.id === rs.dest);
          if (robEntry && robEntry.state === 'Issue') robEntry.state = 'Execute';
        }
      }

      return next;
    });
  }, []);

  const issue = useCallback(() => {
    if (instrPtr >= INITIAL_INSTRS.length) { setDone(true); return; }
    const instr = INITIAL_INSTRS[instrPtr];
    
    setState(prev => {
      const next: TomasuloState = {
        ...prev,
        cycle: prev.cycle,
        rs: prev.rs.map(r => ({ ...r })),
        rob: [...prev.rob.map(r => ({ ...r }))],
        physRegs: [...prev.physRegs],
        renameTable: [...prev.renameTable],
        regs: [...prev.regs],
        committed: [...prev.committed],
        log: [...prev.log],
      };

      // Find a free RS slot
      const isALU = instr.mnemonic !== 'MUL' && instr.mnemonic !== 'DIV';
      const freeRS = next.rs.find(r => !r.busy && (isALU ? r.id.includes('ALU') : r.id.includes('MUL')));
      if (!freeRS) {
        next.log.push(`Cycle ${next.cycle}: STALL — no free RS for ${instr.mnemonic}`);
        return next;
      }

      // Allocate ROB entry
      const robId = next.rob.length + 1;
      
      // Register renaming
      const rs1Val = next.regs[instr.rs1];
      const rs2Val = next.regs[instr.rs2];
      
      // Check if rs1 or rs2 are waiting in ROB
      const rs1Rob = next.rob.find(r => r.dest === instr.rs1 && !r.ready);
      const rs2Rob = next.rob.find(r => r.dest === instr.rs2 && !r.ready);
      
      freeRS.busy = true;
      freeRS.op = instr.mnemonic;
      freeRS.dest = robId;
      freeRS.cyclesLeft = EXEC_LATENCIES[instr.mnemonic] ?? 1;
      
      if (rs1Rob) { freeRS.qj = freeRS.id; freeRS.vj = null; }
      else { freeRS.vj = rs1Val; freeRS.qj = null; }
      
      if (rs2Rob) { freeRS.qk = freeRS.id; freeRS.vk = null; }
      else { freeRS.vk = rs2Val; freeRS.qk = null; }

      next.rob.push({ id: robId, mnemonic: instr.mnemonic, dest: instr.rd, state: 'Issue', result: null, ready: false });
      next.log.push(`Cycle ${next.cycle}: ISSUE ${instr.mnemonic} x${instr.rd},x${instr.rs1},x${instr.rs2} → ${freeRS.id}, ROB#${robId}`);
      
      return next;
    });
    setInstrPtr(p => p + 1);
  }, [instrPtr]);

  const reset = () => { setState(makeInitialState()); setInstrPtr(0); setDone(false); };

  const stateColors: Record<string, string> = {
    Issue: 'text-blue-400 bg-blue-500/10',
    Execute: 'text-amber-400 bg-amber-500/10',
    Write: 'text-green-400 bg-green-500/10',
    Commit: 'text-cyan-400 bg-cyan-500/10',
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-1">Out-of-Order Execution Lab</h1>
        <p className="text-muted-foreground">Step through the Tomasulo algorithm: instruction issue, out-of-order execution, CDB broadcast, and in-order commit via the Reorder Buffer.</p>
      </div>

      {/* Instruction queue */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Instruction Queue</h2>
        <div className="flex gap-2 flex-wrap">
          {INITIAL_INSTRS.map((instr, i) => (
            <div key={i} className={`px-3 py-2 rounded-lg border font-mono text-sm transition-all ${
              i < instrPtr ? 'border-green-500/40 bg-green-500/10 text-muted-foreground line-through' :
              i === instrPtr ? 'border-primary bg-primary/10 text-foreground' :
              'border-border bg-background text-muted-foreground'
            }`}>
              <span className="text-xs text-muted-foreground mr-1">{i+1}.</span>
              {instr.mnemonic} x{instr.rd}, x{instr.rs1}, x{instr.rs2}
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={issue} disabled={instrPtr >= INITIAL_INSTRS.length} data-testid="button-issue"
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-50 hover:bg-blue-700">
            <ChevronRight className="w-4 h-4" /> Issue Next
          </button>
          <button onClick={step} data-testid="button-step"
            className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm font-medium hover:bg-primary/90">
            <StepForward className="w-4 h-4" /> Advance Cycle
          </button>
          <button onClick={reset} className="px-3 py-1.5 border border-border rounded text-sm hover:bg-muted"><RotateCcw className="w-4 h-4" /></button>
          <span className="ml-auto text-sm font-mono text-muted-foreground">Cycle: <span className="text-primary font-bold">{state.cycle}</span></span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Reservation Stations */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Reservation Stations</h2>
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left pb-2 pr-2">Station</th>
                <th className="text-left pb-2 pr-2">Op</th>
                <th className="text-left pb-2 pr-2">Vj</th>
                <th className="text-left pb-2 pr-2">Vk</th>
                <th className="text-left pb-2 pr-2">Qj</th>
                <th className="text-left pb-2 pr-2">Qk</th>
                <th className="text-left pb-2">Cyc</th>
              </tr>
            </thead>
            <tbody>
              {state.rs.map(r => (
                <tr key={r.id} className={`border-b border-border/40 ${r.busy ? '' : 'opacity-40'}`}>
                  <td className="py-1.5 pr-2 text-primary font-bold">{r.id.replace('RS_', '')}</td>
                  <td className="py-1.5 pr-2">{r.busy ? r.op : '—'}</td>
                  <td className="py-1.5 pr-2">{r.vj !== null ? r.vj : (r.busy ? '?' : '—')}</td>
                  <td className="py-1.5 pr-2">{r.vk !== null ? r.vk : (r.busy ? '?' : '—')}</td>
                  <td className="py-1.5 pr-2 text-amber-400">{r.qj ?? '—'}</td>
                  <td className="py-1.5 pr-2 text-amber-400">{r.qk ?? '—'}</td>
                  <td className="py-1.5">{r.busy ? r.cyclesLeft : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Reorder Buffer */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Reorder Buffer (ROB)</h2>
          {state.rob.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">ROB is empty</p>
          ) : (
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left pb-2 pr-2">#</th>
                  <th className="text-left pb-2 pr-2">Instr</th>
                  <th className="text-left pb-2 pr-2">Dest</th>
                  <th className="text-left pb-2 pr-2">Result</th>
                  <th className="text-left pb-2">State</th>
                </tr>
              </thead>
              <tbody>
                {state.rob.map((r, i) => (
                  <tr key={r.id} className={`border-b border-border/40 ${i === 0 ? 'bg-primary/5' : ''}`}>
                    <td className="py-1.5 pr-2 text-muted-foreground">#{r.id}{i === 0 ? ' ←HEAD' : ''}</td>
                    <td className="py-1.5 pr-2">{r.mnemonic}</td>
                    <td className="py-1.5 pr-2">x{r.dest}</td>
                    <td className="py-1.5 pr-2">{r.result !== null ? r.result : '—'}</td>
                    <td className="py-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-xs ${stateColors[r.state] ?? ''}`}>{r.state}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Register file */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Architectural Registers</h2>
        <div className="grid grid-cols-8 sm:grid-cols-16 gap-1.5">
          {state.regs.slice(0, 16).map((v, i) => (
            <div key={i} className={`text-center rounded p-1.5 border text-xs font-mono ${v !== 0 ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
              <div className="text-muted-foreground" style={{fontSize: '9px'}}>x{i}</div>
              <div className="font-bold">{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Event log */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
          <Info className="w-4 h-4" /> Event Log
        </h2>
        <div className="font-mono text-xs space-y-1 max-h-40 overflow-y-auto">
          {[...state.log].reverse().map((entry, i) => (
            <div key={i} className="text-muted-foreground">{entry}</div>
          ))}
        </div>
      </div>

      {state.committed.length > 0 && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-green-400 mb-2">Committed Instructions</h2>
          <div className="flex gap-2 flex-wrap">
            {state.committed.map((c, i) => (
              <span key={i} className="px-2 py-1 bg-green-500/20 text-green-300 rounded text-xs font-mono">{c.instr} = {c.value}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
