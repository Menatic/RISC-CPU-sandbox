import { useState } from 'react';
import { ArrowRight, Zap, AlertTriangle } from 'lucide-react';

type ForwardScenario = {
  label: string; description: string;
  instrs: { mnemonic: string; rd: number | null; rs1: number | null; rs2: number | null; isLoad?: boolean }[];
  forwards: { from: string; to: string; reg: number; value: number; savedCycles: number; description: string }[];
  stallsWithout: number; stallsWith: number;
};

const SCENARIOS: ForwardScenario[] = [
  {
    label: 'EX → EX Forwarding',
    description: 'Result forwarded from EX stage output to the next instruction\'s EX input. Saves 1 cycle.',
    instrs: [
      { mnemonic: 'ADD', rd: 1, rs1: 2, rs2: 3 },
      { mnemonic: 'SUB', rd: 4, rs1: 1, rs2: 5 },
    ],
    forwards: [{ from: 'EX/MEM', to: 'EX', reg: 1, value: 8, savedCycles: 1, description: 'x1 forwarded from ALU output to next ALU input' }],
    stallsWithout: 2, stallsWith: 0,
  },
  {
    label: 'MEM → EX Forwarding',
    description: 'Result from MEM stage forwarded to EX. Instruction 1 produces a value that instruction 3 reads.',
    instrs: [
      { mnemonic: 'ADD', rd: 1, rs1: 2, rs2: 3 },
      { mnemonic: 'ADD', rd: 5, rs1: 6, rs2: 7 },   // unrelated
      { mnemonic: 'MUL', rd: 8, rs1: 1, rs2: 9 },   // reads x1
    ],
    forwards: [{ from: 'MEM/WB', to: 'EX', reg: 1, value: 8, savedCycles: 2, description: 'x1 forwarded from MEM/WB latch to ALU input' }],
    stallsWithout: 2, stallsWith: 0,
  },
  {
    label: 'Load-Use (No Forwarding Possible)',
    description: 'A load cannot forward its result to the immediately following instruction — the data arrives from memory one cycle too late.',
    instrs: [
      { mnemonic: 'LW', rd: 1, rs1: 2, rs2: null, isLoad: true },
      { mnemonic: 'ADD', rd: 3, rs1: 1, rs2: 4 },   // needs x1 from memory
    ],
    forwards: [],
    stallsWithout: 1, stallsWith: 1,
  },
  {
    label: 'Multiple Forwards',
    description: 'Both operands of instruction 4 come from forwarding paths.',
    instrs: [
      { mnemonic: 'ADD', rd: 1, rs1: 2, rs2: 3 },
      { mnemonic: 'MUL', rd: 4, rs1: 5, rs2: 6 },
      { mnemonic: 'SUB', rd: 7, rs1: 1, rs2: 4 },  // both EX→EX and MEM→EX
    ],
    forwards: [
      { from: 'MEM/WB', to: 'EX', reg: 1, value: 8, savedCycles: 2, description: 'x1 from ADD forwarded via MEM/WB' },
      { from: 'EX/MEM', to: 'EX', reg: 4, value: 20, savedCycles: 1, description: 'x4 from MUL forwarded via EX/MEM' },
    ],
    stallsWithout: 3, stallsWith: 0,
  },
];

const STAGES = ['IF', 'ID', 'EX', 'MEM', 'WB'];
const STAGE_COLORS = { IF: '#3b82f6', ID: '#8b5cf6', EX: '#f59e0b', MEM: '#10b981', WB: '#06b6d4' };

export default function Forwarding() {
  const [selected, setSelected] = useState(0);
  const scenario = SCENARIOS[selected];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-1">Forwarding Engine Visualizer</h1>
        <p className="text-muted-foreground">See how EX→EX and MEM→EX data forwarding eliminates stalls by bypassing the register file.</p>
      </div>

      {/* Scenario selector */}
      <div className="flex gap-2 flex-wrap">
        {SCENARIOS.map((s, i) => (
          <button key={i} onClick={() => setSelected(i)} data-testid={`forward-scenario-${i}`}
            className={`px-3 py-2 rounded-lg border text-sm transition-all ${selected === i ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/40'}`}>
            {s.label}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <p className="text-sm text-muted-foreground">{scenario.description}</p>
      </div>

      {/* Pipeline Gantt with forwarding arrows */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="font-semibold mb-4">Pipeline Execution with Forwarding</h2>
        <div className="overflow-x-auto">
          <table className="text-xs font-mono min-w-max">
            <thead>
              <tr>
                <th className="text-left pr-6 pb-2 text-muted-foreground font-normal">Instruction</th>
                {Array.from({length: scenario.instrs.length + 4}, (_, i) => (
                  <th key={i} className="px-3 pb-2 text-muted-foreground font-normal">CC{i+1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scenario.instrs.map((instr, row) => {
                const stall = scenario.stallsWith > 0 && row > 0 && instr.mnemonic !== 'LW' && scenario.instrs[row-1].isLoad ? 1 : 0;
                return (
                  <tr key={row}>
                    <td className="pr-6 py-1.5 text-muted-foreground whitespace-nowrap">
                      <code>{instr.mnemonic} {instr.rd !== null ? `x${instr.rd},` : ''}{instr.rs1 !== null ? `x${instr.rs1}` : ''}{instr.rs2 !== null ? `,x${instr.rs2}` : ''}</code>
                    </td>
                    {Array.from({length: scenario.instrs.length + 4}, (_, col) => {
                      const baseStart = row;
                      const stageIdx = col - baseStart - stall;
                      if (stageIdx < 0 || stageIdx >= STAGES.length) {
                        if (stall > 0 && col === baseStart + stall && row > 0) {
                          return <td key={col} className="px-3 py-1.5 text-center"><div className="px-2 py-0.5 rounded text-amber-400 bg-amber-500/20 font-bold">■</div></td>;
                        }
                        return <td key={col} className="px-3 py-1.5" />;
                      }
                      const stage = STAGES[stageIdx];
                      const color = (STAGE_COLORS as any)[stage];
                      return (
                        <td key={col} className="px-3 py-1.5 text-center">
                          <div className="px-2 py-0.5 rounded font-bold" style={{ backgroundColor: color + '25', color }}>
                            {stage}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Forwarding paths */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2"><Zap className="w-4 h-4 text-primary" /> Active Forwarding Paths</h2>
          {scenario.forwards.length === 0 ? (
            <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <p className="font-medium text-amber-400 text-sm">No forwarding possible</p>
                <p className="text-xs text-muted-foreground mt-0.5">Data arrives from memory too late. A pipeline stall is required.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {scenario.forwards.map((f, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <div className="flex items-center gap-2 shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-green-400 bg-green-500/20 px-2 py-0.5 rounded">{f.from}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-green-400" />
                    <span className="text-xs font-bold text-green-400 bg-green-500/20 px-2 py-0.5 rounded">{f.to}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">x{f.reg} = {f.value}</p>
                    <p className="text-xs text-muted-foreground">{f.description}</p>
                    <p className="text-xs text-green-400 mt-1">Saved {f.savedCycles} stall cycle{f.savedCycles > 1 ? 's' : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="font-semibold mb-4">Performance Impact</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Without forwarding</span>
                <span className="font-mono text-red-400">{scenario.stallsWithout} stall cycles</span>
              </div>
              <div className="h-8 bg-muted rounded overflow-hidden flex">
                {scenario.instrs.map((instr, i) => (
                  <div key={i} style={{ flex: 1, marginRight: '2px' }} className="bg-blue-500/60 rounded flex items-center justify-center text-xs text-white font-mono">{instr.mnemonic}</div>
                ))}
                {Array.from({length: scenario.stallsWithout}, (_, i) => (
                  <div key={i} style={{ flex: 1, marginRight: '2px' }} className="bg-red-500/60 rounded flex items-center justify-center text-xs text-white font-bold">■</div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Total: {scenario.instrs.length + scenario.stallsWithout} cycles</p>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>With forwarding</span>
                <span className="font-mono text-green-400">{scenario.stallsWith} stall cycle{scenario.stallsWith !== 1 ? 's' : ''}</span>
              </div>
              <div className="h-8 bg-muted rounded overflow-hidden flex">
                {scenario.instrs.map((instr, i) => (
                  <div key={i} style={{ flex: 1, marginRight: '2px' }} className="bg-blue-500/60 rounded flex items-center justify-center text-xs text-white font-mono">{instr.mnemonic}</div>
                ))}
                {Array.from({length: scenario.stallsWith}, (_, i) => (
                  <div key={i} style={{ flex: 1, marginRight: '2px' }} className="bg-amber-500/60 rounded flex items-center justify-center text-xs text-white font-bold">■</div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Total: {scenario.instrs.length + scenario.stallsWith} cycles</p>
            </div>

            {scenario.stallsWithout > 0 && (
              <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg">
                <p className="text-sm font-medium text-primary">
                  Speedup: {((scenario.instrs.length + scenario.stallsWithout) / (scenario.instrs.length + scenario.stallsWith)).toFixed(2)}x
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Forwarding saved {scenario.stallsWithout - scenario.stallsWith} stall cycle{scenario.stallsWithout - scenario.stallsWith !== 1 ? 's' : ''}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Forwarding unit architecture explanation */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="font-semibold mb-3">Forwarding Unit Logic</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          {[
            { path: 'EX → EX', condition: 'EX/MEM.rd == ID/EX.rs1 or rs2', when: 'Consecutive instructions with dependency', latency: '0 extra cycles' },
            { path: 'MEM → EX', condition: 'MEM/WB.rd == ID/EX.rs1 or rs2', when: 'One instruction between producer and consumer', latency: '0 extra cycles' },
            { path: 'Load-Use', condition: 'ID/EX.MemRead AND ID/EX.rd == IF/ID.rs1', when: 'Load followed immediately by dependent instr', latency: '1 stall required' },
          ].map(({ path, condition, when, latency }) => (
            <div key={path} className="border border-border rounded-lg p-3">
              <div className="font-bold text-primary text-sm mb-1">{path}</div>
              <div className="text-xs text-muted-foreground mb-1"><strong>Condition:</strong> {condition}</div>
              <div className="text-xs text-muted-foreground mb-1"><strong>When:</strong> {when}</div>
              <div className={`text-xs font-medium ${latency.includes('stall') ? 'text-amber-400' : 'text-green-400'}`}>{latency}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
