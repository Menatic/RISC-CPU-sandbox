import { useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Play, RotateCcw, Layers, Cpu, Zap } from 'lucide-react';

type IssueWidth = 1 | 2 | 4;

type InstrGroup = { cycle: number; slot: number; mnemonic: string; rd: number; issueWidth: IssueWidth; stalled: boolean };

const SAMPLE_PROGRAM = [
  { mnemonic: 'ADD',  rd: 1, rs1: 2,  rs2: 3,  type: 'ALU' },
  { mnemonic: 'MUL',  rd: 4, rs1: 5,  rs2: 6,  type: 'MUL' },
  { mnemonic: 'SUB',  rd: 7, rs1: 1,  rs2: 8,  type: 'ALU' },  // RAW on x1
  { mnemonic: 'LW',   rd: 9, rs1: 10, rs2: 0,  type: 'MEM' },
  { mnemonic: 'ADD',  rd: 11,rs1: 4,  rs2: 12, type: 'ALU' },  // RAW on x4 (MUL latency 3)
  { mnemonic: 'AND',  rd: 13,rs1: 14, rs2: 15, type: 'ALU' },
  { mnemonic: 'ADD',  rd: 16,rs1: 9,  rs2: 17, type: 'ALU' },  // RAW on x9 (LW latency 2)
  { mnemonic: 'OR',   rd: 18,rs1: 19, rs2: 20, type: 'ALU' },
];

type SimResult = {
  issueWidth: IssueWidth;
  label: string;
  cycles: number;
  ipc: number;
  cpi: number;
  throughput: number;
  utilization: number;
  timeline: { cycle: number; issued: number; stalls: number }[];
};

function simulate(width: IssueWidth): SimResult {
  // Simplified superscalar simulation with dependency tracking
  const instrs = SAMPLE_PROGRAM;
  const n = instrs.length;
  const latencies: Record<string, number> = { ALU: 1, MUL: 3, MEM: 2 };
  const completeCycle: number[] = new Array(n).fill(-1);
  
  let cycle = 0;
  let issued = 0;
  const timeline: SimResult['timeline'] = [];
  let issuedThisCycle = 0;
  let stallsThisCycle = 0;

  while (issued < n) {
    issuedThisCycle = 0; stallsThisCycle = 0;
    
    for (let slot = 0; slot < width && issued < n; slot++) {
      const i = issued;
      const instr = instrs[i];
      
      // Check for RAW dependencies
      let ready = true;
      for (let j = 0; j < i; j++) {
        const prev = instrs[j];
        if (prev.rd === instr.rs1 || prev.rd === instr.rs2) {
          if (completeCycle[j] > cycle) { ready = false; break; }
        }
      }
      
      if (ready) {
        completeCycle[i] = cycle + latencies[instr.type];
        issued++;
        issuedThisCycle++;
      } else {
        stallsThisCycle++;
        break; // stall this slot and beyond
      }
    }
    
    timeline.push({ cycle: cycle + 1, issued: issuedThisCycle, stalls: stallsThisCycle });
    cycle++;
    if (cycle > 50) break; // safety
  }

  // Wait for last instructions to complete
  const totalCycles = Math.max(...completeCycle);
  const ipc = n / totalCycles;
  const utilization = Math.min(100, Math.round((n / (totalCycles * width)) * 100));

  return {
    issueWidth: width,
    label: width === 1 ? 'In-Order Scalar' : width === 2 ? '2-Wide Superscalar' : '4-Wide Superscalar',
    cycles: totalCycles,
    ipc: Math.round(ipc * 100) / 100,
    cpi: Math.round((totalCycles / n) * 100) / 100,
    throughput: Math.round(n / totalCycles * 100) / 100,
    utilization,
    timeline,
  };
}

export default function Superscalar() {
  const [width, setWidth] = useState<IssueWidth>(2);
  const [results, setResults] = useState<SimResult[]>([]);
  const [ran, setRan] = useState(false);

  const run = useCallback(() => {
    setResults([simulate(1), simulate(2), simulate(4)]);
    setRan(true);
  }, []);

  const current = results.find(r => r.issueWidth === width);

  const comparisonData = results.map(r => ({
    name: r.label.replace(' Superscalar', '').replace('In-Order ', ''),
    cycles: r.cycles, ipc: r.ipc, util: r.utilization,
  }));

  const COLORS: Record<IssueWidth, string> = { 1: '#f43f5e', 2: '#06b6d4', 4: '#10b981' };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-1">Superscalar Processor Lab</h1>
        <p className="text-muted-foreground">Compare scalar vs. 2-wide vs. 4-wide issue. See how ILP (instruction-level parallelism) is bounded by data dependencies.</p>
      </div>

      {/* Program display */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Instruction Sequence (8 instructions)</h2>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_PROGRAM.map((instr, i) => (
            <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded font-mono text-xs bg-background">
              <span className="text-muted-foreground">{i+1}.</span>
              <span className="text-cyan-400">{instr.mnemonic}</span>
              <span className="text-muted-foreground">x{instr.rd},x{instr.rs1},{instr.type === 'MEM' ? 'mem' : `x${instr.rs2}`}</span>
              <span className="text-xs px-1.5 py-0.5 rounded" style={{
                backgroundColor: instr.type === 'ALU' ? '#06b6d420' : instr.type === 'MUL' ? '#8b5cf620' : '#10b98120',
                color: instr.type === 'ALU' ? '#06b6d4' : instr.type === 'MUL' ? '#8b5cf6' : '#10b981',
              }}>{instr.type}</span>
            </div>
          ))}
        </div>
        <button onClick={run} className="mt-4 flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded font-medium text-sm hover:bg-primary/90" data-testid="button-run-superscalar">
          <Play className="w-4 h-4" /> Run All Configurations
        </button>
      </div>

      {ran && results.length > 0 && (
        <>
          {/* Issue width selector */}
          <div className="flex gap-2">
            {([1, 2, 4] as IssueWidth[]).map(w => (
              <button key={w} onClick={() => setWidth(w)} data-testid={`width-${w}`}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border font-medium text-sm transition-all ${width === w ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/40'}`}>
                <Layers className="w-4 h-4" />
                {w === 1 ? 'Scalar' : `${w}-Wide`}
              </button>
            ))}
          </div>

          {/* Stats for selected width */}
          {current && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Cycles', value: current.cycles, color: COLORS[current.issueWidth] },
                { label: 'IPC', value: current.ipc.toFixed(2), color: '#10b981' },
                { label: 'CPI', value: current.cpi.toFixed(2), color: '#f59e0b' },
                { label: 'Utilization', value: `${current.utilization}%`, color: '#8b5cf6' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-card border border-border rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold" style={{ color }}>{value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Comparison charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-lg p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><Cpu className="w-4 h-4 text-primary" /> IPC Comparison</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="ipc" name="IPC" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-card border border-border rounded-lg p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><Zap className="w-4 h-4 text-amber-400" /> Execution Cycles</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="cycles" name="Cycles" fill="#f59e0b" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Amdahl's law note */}
          <div className="bg-card border border-border rounded-lg p-5">
            <h2 className="font-semibold mb-3">Why IPC Doesn't Scale Linearly</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              {results.map(r => (
                <div key={r.issueWidth} className="border border-border rounded-lg p-3">
                  <div className="font-bold mb-1" style={{ color: COLORS[r.issueWidth] }}>{r.label}</div>
                  <div className="text-muted-foreground text-xs space-y-1">
                    <div>Issue slots: <span className="text-foreground">{r.issueWidth}/cycle</span></div>
                    <div>IPC achieved: <span className="text-foreground">{r.ipc}</span></div>
                    <div>Peak IPC: <span className="text-foreground">{r.issueWidth}</span></div>
                    <div>Efficiency: <span style={{ color: COLORS[r.issueWidth] }}>{Math.round(r.ipc / r.issueWidth * 100)}%</span></div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-4">Data dependencies limit achievable IPC even with unlimited hardware. This is Amdahl's Law applied to ILP — the sequential portion (dependency chains) bounds speedup.</p>
          </div>
        </>
      )}

      {!ran && (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <Layers className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium mb-2">Press "Run All Configurations" to simulate</p>
          <p className="text-sm text-muted-foreground">Compare scalar, dual-issue, and quad-issue processors on the same program</p>
        </div>
      )}
    </div>
  );
}
