import { useState, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis
} from 'recharts';
import { TrendingUp, Cpu, Zap, Target, BarChart2, Activity } from 'lucide-react';

// Generate synthetic but realistic simulation data
function generateAnalytics(program: string) {
  const seed = program.length;
  const rand = (s: number) => ((Math.sin(s * 9301 + 49297) * 233280) % 1 + 1) / 2;

  const cpiTimeline = Array.from({ length: 20 }, (_, i) => ({
    cycle: (i + 1) * 5,
    cpi: +(1.1 + rand(i + seed) * 0.8 + (i < 5 ? 0.5 : 0)).toFixed(2),
    ipc: +(0.7 + rand(i + seed + 1) * 0.5).toFixed(2),
  }));

  const stageUtilization = [
    { stage: 'IF', busy: Math.round(70 + rand(seed + 1) * 25), stall: Math.round(rand(seed + 2) * 15), idle: 0 },
    { stage: 'ID', busy: Math.round(65 + rand(seed + 3) * 25), stall: Math.round(rand(seed + 4) * 20), idle: 0 },
    { stage: 'EX', busy: Math.round(75 + rand(seed + 5) * 20), stall: Math.round(rand(seed + 6) * 10), idle: 0 },
    { stage: 'MEM', busy: Math.round(40 + rand(seed + 7) * 30), stall: Math.round(rand(seed + 8) * 10), idle: 0 },
    { stage: 'WB', busy: Math.round(60 + rand(seed + 9) * 30), stall: 0, idle: 0 },
  ].map(s => ({ ...s, idle: Math.max(0, 100 - s.busy - s.stall) }));

  const hazardTypes = [
    { name: 'RAW', count: Math.round(5 + rand(seed + 10) * 20), color: '#f43f5e' },
    { name: 'Control', count: Math.round(3 + rand(seed + 11) * 10), color: '#f59e0b' },
    { name: 'WAW', count: Math.round(1 + rand(seed + 12) * 5), color: '#8b5cf6' },
    { name: 'Load-Use', count: Math.round(2 + rand(seed + 13) * 8), color: '#06b6d4' },
  ];

  const cacheHitData = [
    { level: 'L1I', hits: Math.round(85 + rand(seed + 14) * 12), misses: 0 },
    { level: 'L1D', hits: Math.round(78 + rand(seed + 15) * 15), misses: 0 },
    { level: 'L2', hits: Math.round(60 + rand(seed + 16) * 25), misses: 0 },
    { level: 'L3', hits: Math.round(40 + rand(seed + 17) * 35), misses: 0 },
  ].map(d => ({ ...d, misses: 100 - d.hits }));

  const branchAccuracy = Array.from({ length: 15 }, (_, i) => ({
    branch: i + 1,
    accuracy: Math.min(99, Math.round(50 + rand(i + seed + 18) * 45)),
  }));

  const instrMix = [
    { name: 'ALU', value: Math.round(40 + rand(seed + 19) * 20), color: '#06b6d4' },
    { name: 'Load/Store', value: Math.round(15 + rand(seed + 20) * 15), color: '#10b981' },
    { name: 'Branch', value: Math.round(10 + rand(seed + 21) * 10), color: '#f59e0b' },
    { name: 'Multiply', value: Math.round(5 + rand(seed + 22) * 10), color: '#8b5cf6' },
    { name: 'Other', value: Math.round(5 + rand(seed + 23) * 10), color: '#64748b' },
  ];

  const totalIPC = +(cpiTimeline.reduce((s, d) => s + d.ipc, 0) / cpiTimeline.length).toFixed(2);
  const totalCPI = +(1 / totalIPC).toFixed(2);
  const cycles = Math.round(100 + rand(seed + 24) * 100);
  const instrs = Math.round(cycles * totalIPC);
  const branchAcc = Math.round(branchAccuracy.reduce((s, d) => s + d.accuracy, 0) / branchAccuracy.length);

  return { cpiTimeline, stageUtilization, hazardTypes, cacheHitData, branchAccuracy, instrMix, totalIPC, totalCPI, cycles, instrs, branchAcc };
}

const PROGRAMS = ['Fibonacci', 'Bubble Sort', 'Binary Search', 'Matrix Multiply', 'Prime Sieve'];

export default function Analytics() {
  const [program, setProgram] = useState('Fibonacci');
  const data = generateAnalytics(program);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1">Performance Analytics</h1>
          <p className="text-muted-foreground">Execution metrics, pipeline utilization, and hazard breakdown for simulated RISC-V programs.</p>
        </div>
        <select className="bg-card border border-border rounded-lg px-3 py-2 text-sm" value={program}
          onChange={e => setProgram(e.target.value)} data-testid="select-program">
          {PROGRAMS.map(p => <option key={p}>{p}</option>)}
        </select>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Average IPC', value: data.totalIPC, icon: Cpu, color: '#06b6d4', sub: 'instructions / cycle' },
          { label: 'Average CPI', value: data.totalCPI, icon: Activity, color: '#f59e0b', sub: 'cycles / instruction' },
          { label: 'Cycles', value: data.cycles, icon: Zap, color: '#10b981', sub: 'simulated' },
          { label: 'Branch Accuracy', value: `${data.branchAcc}%`, icon: Target, color: '#8b5cf6', sub: '2-bit predictor' },
        ].map(({ label, value, icon: Icon, color, sub }) => (
          <div key={label} className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className="w-4 h-4" style={{ color }} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
            <div className="text-3xl font-bold" style={{ color }}>{value}</div>
            <div className="text-xs text-muted-foreground mt-1">{sub}</div>
          </div>
        ))}
      </div>

      {/* CPI over time */}
      <div className="bg-card border border-border rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">CPI & IPC Over Execution Time</h2>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data.cpiTimeline}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="cycle" tick={{ fontSize: 11 }} label={{ value: 'Cycle', position: 'insideBottom', offset: -2 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="cpi" stroke="#f59e0b" dot={false} strokeWidth={2} name="CPI" />
            <Line type="monotone" dataKey="ipc" stroke="#06b6d4" dot={false} strokeWidth={2} name="IPC" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pipeline utilization */}
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">Pipeline Stage Utilization</h2>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.stageUtilization} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
              <YAxis dataKey="stage" type="category" tick={{ fontSize: 12 }} width={30} />
              <Tooltip formatter={(v: number) => `${v}%`} />
              <Legend />
              <Bar dataKey="busy" name="Busy" stackId="a" fill="#06b6d4" />
              <Bar dataKey="stall" name="Stall" stackId="a" fill="#f43f5e" />
              <Bar dataKey="idle" name="Idle" stackId="a" fill="#334155" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Instruction mix */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="font-semibold mb-4">Instruction Type Mix</h2>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={180} height={180}>
              <PieChart>
                <Pie data={data.instrMix} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                  {data.instrMix.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => `${v}%`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {data.instrMix.map(item => (
                <div key={item.name} className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-muted-foreground">{item.name}</span>
                  <span className="font-mono ml-auto">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Hazard breakdown */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="font-semibold mb-4">Hazard Breakdown</h2>
          <div className="space-y-3">
            {data.hazardTypes.map(h => (
              <div key={h.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{h.name}</span>
                  <span className="font-mono" style={{ color: h.color }}>{h.count}</span>
                </div>
                <div className="h-2 bg-muted rounded overflow-hidden">
                  <div className="h-full rounded" style={{
                    width: `${(h.count / Math.max(...data.hazardTypes.map(x => x.count))) * 100}%`,
                    backgroundColor: h.color
                  }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-xs text-muted-foreground border-t border-border pt-3">
            Total hazards: {data.hazardTypes.reduce((s, h) => s + h.count, 0)} · Stall cycles introduced: {Math.round(data.hazardTypes.reduce((s, h) => s + h.count, 0) * 1.2)}
          </div>
        </div>

        {/* Cache hit rates */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="font-semibold mb-4">Cache Hit Rates by Level</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.cacheHitData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="level" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `${v}%`} />
              <Legend />
              <Bar dataKey="hits" name="Hit Rate" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="misses" name="Miss Rate" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Branch accuracy timeline */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="font-semibold mb-4">Branch Prediction Accuracy per Occurrence</h2>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data.branchAccuracy}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="branch" tick={{ fontSize: 11 }} label={{ value: 'Branch #', position: 'insideBottom', offset: -2 }} />
            <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => `${v}%`} />
            <Line type="monotone" dataKey="accuracy" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6', r: 3 }} name="Accuracy" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
