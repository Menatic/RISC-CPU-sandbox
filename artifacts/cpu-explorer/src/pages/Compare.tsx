import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { Trophy, Zap, TrendingUp, Clock } from 'lucide-react';

type ArchResult = {
  name: string; shortName: string; color: string; era: string;
  cycles: number; ipc: number; cpi: number; speedup: number;
  hazards: number; branchPenalty: number; cacheEfficiency: number; description: string;
};

const PROGRAMS: Record<string, ArchResult[]> = {
  'Fibonacci (n=20)': [
    { name: 'Single Cycle', shortName: 'Single', color: '#f43f5e', era: '1970s', cycles: 280, ipc: 0.25, cpi: 4.0, speedup: 1.0, hazards: 0, branchPenalty: 0, cacheEfficiency: 50, description: 'One instruction per clock, clock period = slowest instruction (multiply)' },
    { name: '5-Stage Pipeline', shortName: 'Pipeline', color: '#f59e0b', era: '1985', cycles: 142, ipc: 0.49, cpi: 2.03, speedup: 1.97, hazards: 18, branchPenalty: 12, cacheEfficiency: 70, description: 'Overlapped stages. Hazards and branch flushes reduce throughput.' },
    { name: 'Forwarding Pipeline', shortName: 'Forward', color: '#06b6d4', era: '1990', cycles: 112, ipc: 0.62, cpi: 1.60, speedup: 2.50, hazards: 5, branchPenalty: 8, cacheEfficiency: 75, description: 'Forwarding eliminates most data hazards. Only load-use stalls remain.' },
    { name: 'Superscalar (2-wide)', shortName: 'Super2', color: '#10b981', era: '1993', cycles: 76, ipc: 0.92, cpi: 1.09, speedup: 3.68, hazards: 3, branchPenalty: 5, cacheEfficiency: 80, description: 'Two instructions issued per cycle. ILP limited by data dependencies.' },
    { name: 'Out-of-Order', shortName: 'OOO', color: '#8b5cf6', era: '1995+', cycles: 56, ipc: 1.25, cpi: 0.80, speedup: 5.0, hazards: 1, branchPenalty: 3, cacheEfficiency: 88, description: 'Dynamic scheduling hides latency. IPC > 1 achieved.' },
  ],
  'Bubble Sort (n=32)': [
    { name: 'Single Cycle', shortName: 'Single', color: '#f43f5e', era: '1970s', cycles: 6400, ipc: 0.25, cpi: 4.0, speedup: 1.0, hazards: 0, branchPenalty: 0, cacheEfficiency: 45, description: 'O(n²) loop dominates. Branch-heavy inner loop.' },
    { name: '5-Stage Pipeline', shortName: 'Pipeline', color: '#f59e0b', era: '1985', cycles: 3800, ipc: 0.42, cpi: 2.38, speedup: 1.68, hazards: 120, branchPenalty: 280, cacheEfficiency: 60, description: 'Many branch mispredictions due to unpredictable swap comparisons.' },
    { name: 'Forwarding Pipeline', shortName: 'Forward', color: '#06b6d4', era: '1990', cycles: 3100, ipc: 0.52, cpi: 1.93, speedup: 2.06, hazards: 40, branchPenalty: 220, cacheEfficiency: 68, description: 'Forwarding helps. Branch penalty still high (comparisons are data-dependent).' },
    { name: 'Superscalar (2-wide)', shortName: 'Super2', color: '#10b981', era: '1993', cycles: 2100, ipc: 0.76, cpi: 1.31, speedup: 3.05, hazards: 22, branchPenalty: 140, cacheEfficiency: 75, description: 'Partial out-of-order execution. Swap operation benefits from dual issue.' },
    { name: 'Out-of-Order', shortName: 'OOO', color: '#8b5cf6', era: '1995+', cycles: 1650, ipc: 0.97, cpi: 1.03, speedup: 3.88, hazards: 8, branchPenalty: 80, cacheEfficiency: 82, description: 'Tomasulo hides load latencies. Branch predictor adapts to loop pattern.' },
  ],
  'Matrix Multiply (4x4)': [
    { name: 'Single Cycle', shortName: 'Single', color: '#f43f5e', era: '1970s', cycles: 2000, ipc: 0.25, cpi: 4.0, speedup: 1.0, hazards: 0, branchPenalty: 0, cacheEfficiency: 60, description: 'Many multiply-accumulate operations with uniform instruction latency.' },
    { name: '5-Stage Pipeline', shortName: 'Pipeline', color: '#f59e0b', era: '1985', cycles: 1280, ipc: 0.39, cpi: 2.56, speedup: 1.56, hazards: 96, branchPenalty: 24, cacheEfficiency: 72, description: 'MUL latency creates chains of stalls in accumulation loops.' },
    { name: 'Forwarding Pipeline', shortName: 'Forward', color: '#06b6d4', era: '1990', cycles: 920, ipc: 0.54, cpi: 1.85, speedup: 2.17, hazards: 28, branchPenalty: 18, cacheEfficiency: 78, description: 'Forwarding chains through accumulation. Sequential memory access pattern friendly for cache.' },
    { name: 'Superscalar (2-wide)', shortName: 'Super2', color: '#10b981', era: '1993', cycles: 580, ipc: 0.86, cpi: 1.16, speedup: 3.45, hazards: 12, branchPenalty: 8, cacheEfficiency: 85, description: 'ALU and MEM operations can be dual-issued. High utilization with structured access patterns.' },
    { name: 'Out-of-Order', shortName: 'OOO', color: '#8b5cf6', era: '1995+', cycles: 420, ipc: 1.19, cpi: 0.84, speedup: 4.76, hazards: 4, branchPenalty: 3, cacheEfficiency: 91, description: 'Best workload for OOO: independent dot-product chains can overlap. Near-ideal IPC.' },
  ],
};

const METRICS = ['CPI', 'Speedup', 'Cache Efficiency', 'Branch Penalty (inv)'];

export default function Compare() {
  const [program, setProgram] = useState('Fibonacci (n=20)');
  const results = PROGRAMS[program];

  const barData = results.map(r => ({
    name: r.shortName,
    Cycles: r.cycles,
    IPC: r.ipc,
    CPI: r.cpi,
    Speedup: r.speedup,
  }));

  const radarData = [
    { metric: 'IPC', ...Object.fromEntries(results.map(r => [r.shortName, Math.min(100, r.ipc * 60)])) },
    { metric: 'Cache', ...Object.fromEntries(results.map(r => [r.shortName, r.cacheEfficiency])) },
    { metric: 'Branch', ...Object.fromEntries(results.map(r => [r.shortName, Math.max(0, 100 - r.branchPenalty * 2)])) },
    { metric: 'Hazard Red.', ...Object.fromEntries(results.map(r => [r.shortName, Math.max(0, 100 - r.hazards * 3)])) },
    { metric: 'Speedup', ...Object.fromEntries(results.map(r => [r.shortName, r.speedup * 18])) },
  ];

  const winner = results.reduce((best, r) => r.speedup > best.speedup ? r : best, results[0]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1">CPU Comparison Lab</h1>
          <p className="text-muted-foreground">Run the same program across 5 architectures and compare cycles, IPC, CPI, and speedup.</p>
        </div>
        <select className="bg-card border border-border rounded-lg px-3 py-2 text-sm" value={program}
          onChange={e => setProgram(e.target.value)} data-testid="select-compare-program">
          {Object.keys(PROGRAMS).map(p => <option key={p}>{p}</option>)}
        </select>
      </div>

      {/* Winner badge */}
      <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
        <Trophy className="w-6 h-6 text-amber-400 shrink-0" />
        <div>
          <span className="font-semibold" style={{ color: winner.color }}>{winner.name}</span>
          <span className="text-muted-foreground text-sm ml-2">wins with {winner.speedup}× speedup over Single Cycle · IPC {winner.ipc}</span>
        </div>
      </div>

      {/* Architecture cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {results.map((r, i) => (
          <div key={r.name} className="bg-card border rounded-lg p-3" style={{ borderColor: r.color + '50' }}>
            <div className="flex items-start justify-between mb-2">
              <div className="font-semibold text-sm" style={{ color: r.color }}>{r.shortName}</div>
              <span className="text-xs text-muted-foreground">{r.era}</span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Cycles</span><span className="font-mono">{r.cycles.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">IPC</span><span className="font-mono">{r.ipc}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">CPI</span><span className="font-mono">{r.cpi}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Speedup</span><span className="font-mono font-bold" style={{ color: r.color }}>{r.speedup}×</span></div>
            </div>
            {i === results.length - 1 && (
              <div className="mt-2 px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded text-center font-bold">FASTEST</div>
            )}
          </div>
        ))}
      </div>

      {/* Speedup visualization */}
      <div className="bg-card border border-border rounded-lg p-5">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Speedup vs. Single Cycle</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Higher is better. Note that speedup does not scale linearly with hardware complexity.</p>
        <div className="space-y-3">
          {results.map(r => (
            <div key={r.name}>
              <div className="flex justify-between text-sm mb-1">
                <span style={{ color: r.color }}>{r.name}</span>
                <span className="font-mono font-bold" style={{ color: r.color }}>{r.speedup}×</span>
              </div>
              <div className="h-6 bg-muted rounded overflow-hidden">
                <div className="h-full rounded flex items-center px-2 text-xs text-white font-bold transition-all"
                  style={{ width: `${(r.speedup / results[results.length - 1].speedup) * 100}%`, backgroundColor: r.color }}>
                  {r.cycles} cycles
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* IPC & CPI chart */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2"><Zap className="w-4 h-4 text-primary" /> IPC Comparison</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="IPC" radius={[4,4,0,0]}>
                {results.map((r, i) => (
                  <rect key={i} fill={r.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Radar chart */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="font-semibold mb-4">Architecture Profile Radar</h2>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
              <PolarRadiusAxis tick={{ fontSize: 9 }} domain={[0, 100]} />
              {results.map(r => (
                <Radar key={r.name} name={r.shortName} dataKey={r.shortName} stroke={r.color} fill={r.color} fillOpacity={0.08} strokeWidth={2} />
              ))}
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Architecture descriptions */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> Architecture Notes for "{program}"</h2>
        <div className="space-y-2">
          {results.map(r => (
            <div key={r.name} className="flex gap-3 text-sm py-2 border-b border-border last:border-0">
              <span className="font-medium w-32 shrink-0" style={{ color: r.color }}>{r.shortName}</span>
              <span className="text-muted-foreground">{r.description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
