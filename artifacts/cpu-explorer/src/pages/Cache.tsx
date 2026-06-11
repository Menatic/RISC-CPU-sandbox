import { useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Database, Zap, AlertTriangle, RotateCcw, Play } from 'lucide-react';

type CacheLevel = { size: number; assoc: number; latency: number; hitRate: number };
type SimState = {
  l1i: CacheLevel; l1d: CacheLevel; l2: CacheLevel; l3: CacheLevel;
  accesses: { addr: string; type: string; level: string; cycles: number; hit: boolean }[];
  totalCycles: number; hits: number; misses: number;
};

function simulateCache(config: {
  l1Size: number; l1Assoc: number;
  l2Size: number; l2Assoc: number;
  l3Size: number; l3Assoc: number;
  blockSize: number; policy: string;
}): SimState {
  // Realistic simulation: use an actual LRU cache set structure
  const blockBits = Math.log2(config.blockSize);
  
  type CacheSet = { tags: number[]; order: number[] };
  
  function makeCache(size: number, assoc: number): CacheSet[] {
    const sets = size / (config.blockSize * assoc);
    return Array.from({ length: Math.max(1, sets) }, () => ({ tags: [], order: [] }));
  }

  function accessCache(cache: CacheSet[], addr: number, assoc: number): boolean {
    const sets = cache.length;
    const setIndex = Math.floor(addr / config.blockSize) % sets;
    const tag = Math.floor(addr / (config.blockSize * sets));
    const set = cache[setIndex];
    const hitIdx = set.tags.indexOf(tag);
    if (hitIdx !== -1) {
      // LRU: move to end
      set.order = set.order.filter(i => i !== hitIdx);
      set.order.push(hitIdx);
      return true;
    }
    // Miss: evict LRU if full
    if (set.tags.length < assoc) {
      const idx = set.tags.length;
      set.tags.push(tag);
      set.order.push(idx);
    } else {
      const evict = set.order.shift()!;
      set.tags[evict] = tag;
      set.order.push(evict);
    }
    return false;
  }

  const l1iCache = makeCache(config.l1Size, config.l1Assoc);
  const l1dCache = makeCache(config.l1Size, config.l1Assoc);
  const l2Cache = makeCache(config.l2Size, config.l2Assoc);
  const l3Cache = makeCache(config.l3Size, config.l3Assoc);

  // Generate a realistic memory access trace
  const trace: number[] = [];
  // Instruction stream (sequential with occasional jumps — simulates real code)
  let ipc = 0x1000;
  for (let i = 0; i < 60; i++) {
    trace.push(ipc);
    if (Math.random() < 0.1) ipc = 0x1000 + Math.floor(Math.random() * 80) * 4;
    else ipc += 4;
  }
  // Data accesses (array traversal + random)
  for (let i = 0; i < 60; i++) {
    if (Math.random() < 0.6) trace.push(0x8000 + i * 4); // sequential array
    else trace.push(0x8000 + Math.floor(Math.random() * 256) * 4); // random
  }

  const accesses: SimState['accesses'] = [];
  let totalCycles = 0, hits = 0, misses = 0;
  let l1iH = 0, l1iM = 0, l1dH = 0, l1dM = 0, l2H = 0, l2M = 0, l3H = 0, l3M = 0;

  for (let i = 0; i < trace.length; i++) {
    const addr = trace[i];
    const isInstr = i < 60;
    const addrStr = '0x' + addr.toString(16).toUpperCase().padStart(8, '0');
    const cache1 = isInstr ? l1iCache : l1dCache;

    let level: string; let latency: number; let hit: boolean;
    if (accessCache(cache1, addr, config.l1Assoc)) {
      level = isInstr ? 'L1I' : 'L1D'; latency = 4; hit = true;
      if (isInstr) l1iH++; else l1dH++;
    } else {
      if (isInstr) l1iM++; else l1dM++;
      if (accessCache(l2Cache, addr, config.l2Assoc)) {
        level = 'L2'; latency = 12; hit = false;
        l2H++;
      } else {
        l2M++;
        if (accessCache(l3Cache, addr, config.l3Assoc)) {
          level = 'L3'; latency = 40; hit = false;
          l3H++;
        } else {
          l3M++;
          level = 'DRAM'; latency = 200; hit = false;
        }
      }
    }

    if (hit) hits++; else misses++;
    totalCycles += latency;

    if (accesses.length < 30) {
      accesses.push({ addr: addrStr, type: isInstr ? 'Fetch' : 'Data', level, cycles: latency, hit });
    }
  }

  const total = l1iH + l1iM;
  const dtotal = l1dH + l1dM;
  return {
    l1i: { size: config.l1Size, assoc: config.l1Assoc, latency: 4, hitRate: total > 0 ? Math.round(l1iH / total * 100) : 0 },
    l1d: { size: config.l1Size, assoc: config.l1Assoc, latency: 4, hitRate: dtotal > 0 ? Math.round(l1dH / dtotal * 100) : 0 },
    l2: { size: config.l2Size, assoc: config.l2Assoc, latency: 12, hitRate: (l2H + l2M) > 0 ? Math.round(l2H / (l2H + l2M) * 100) : 0 },
    l3: { size: config.l3Size, assoc: config.l3Assoc, latency: 40, hitRate: (l3H + l3M) > 0 ? Math.round(l3H / (l3H + l3M) * 100) : 0 },
    accesses, totalCycles, hits, misses,
  };
}

const KB = 1024;

export default function Cache() {
  const [config, setConfig] = useState({
    l1Size: 32 * KB, l1Assoc: 4,
    l2Size: 256 * KB, l2Assoc: 8,
    l3Size: 4 * 1024 * KB, l3Assoc: 16,
    blockSize: 64, policy: 'lru',
  });
  const [sim, setSim] = useState<SimState | null>(null);

  const run = useCallback(() => setSim(simulateCache(config)), [config]);
  const reset = () => setSim(null);

  const levelColors = { L1I: '#06b6d4', L1D: '#3b82f6', L2: '#10b981', L3: '#f59e0b', DRAM: '#f43f5e' };
  const levelLabel = (bytes: number) => bytes >= 1024 * 1024 ? `${bytes / (1024 * 1024)}MB` : `${bytes / 1024}KB`;

  const hitRateData = sim ? [
    { name: 'L1I', hitRate: sim.l1i.hitRate, missRate: 100 - sim.l1i.hitRate },
    { name: 'L1D', hitRate: sim.l1d.hitRate, missRate: 100 - sim.l1d.hitRate },
    { name: 'L2', hitRate: sim.l2.hitRate, missRate: 100 - sim.l2.hitRate },
    { name: 'L3', hitRate: sim.l3.hitRate, missRate: 100 - sim.l3.hitRate },
  ] : [];

  const pieData = sim ? [
    { name: 'L1 Hits', value: sim.hits },
    { name: 'Misses', value: sim.misses },
  ] : [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-1">Cache Hierarchy Simulator</h1>
        <p className="text-muted-foreground">Configure L1/L2/L3 parameters and simulate a realistic memory access trace using LRU replacement.</p>
      </div>

      {/* Config panel */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Cache Configuration</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'L1 Cache Size', key: 'l1Size', options: [16*KB, 32*KB, 64*KB], fmt: (v: number) => `${v/KB}KB` },
            { label: 'L1 Associativity', key: 'l1Assoc', options: [1, 2, 4, 8], fmt: (v: number) => v === 1 ? 'Direct' : `${v}-way` },
            { label: 'L2 Cache Size', key: 'l2Size', options: [128*KB, 256*KB, 512*KB, 1024*KB], fmt: (v: number) => `${v/KB}KB` },
            { label: 'L3 Cache Size', key: 'l3Size', options: [2*1024*KB, 4*1024*KB, 8*1024*KB, 16*1024*KB], fmt: (v: number) => `${v/(1024*KB)}MB` },
          ].map(({ label, key, options, fmt }) => (
            <div key={key}>
              <label className="text-xs text-muted-foreground block mb-1">{label}</label>
              <select
                className="w-full bg-background border border-border rounded p-2 text-sm"
                value={(config as any)[key]}
                onChange={e => setConfig(c => ({ ...c, [key]: Number(e.target.value) }))}
                data-testid={`select-${key}`}
              >
                {options.map(v => <option key={v} value={v}>{fmt(v)}</option>)}
              </select>
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-4">
          <select className="bg-background border border-border rounded p-2 text-sm"
            value={config.policy} onChange={e => setConfig(c => ({ ...c, policy: e.target.value }))}>
            <option value="lru">LRU Replacement</option>
            <option value="random">Random Replacement</option>
          </select>
          <button onClick={run} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded font-medium text-sm hover:bg-primary/90" data-testid="button-run-cache">
            <Play className="w-4 h-4" /> Run Simulation
          </button>
          <button onClick={reset} className="px-3 py-2 border border-border rounded hover:bg-muted text-sm"><RotateCcw className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Cache hierarchy diagram */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><Database className="w-5 h-5 text-primary" /> Memory Hierarchy</h2>
        <div className="flex flex-col items-center gap-2">
          {[
            { label: 'L1 Instruction Cache', size: config.l1Size, color: '#06b6d4', latency: '4 cycles', width: 200 },
            { label: 'L1 Data Cache', size: config.l1Size, color: '#3b82f6', latency: '4 cycles', width: 200 },
            { label: 'L2 Unified Cache', size: config.l2Size, color: '#10b981', latency: '12 cycles', width: 300 },
            { label: 'L3 Unified Cache', size: config.l3Size, color: '#f59e0b', latency: '40 cycles', width: 400 },
            { label: 'Main Memory (DRAM)', size: 4 * 1024 * 1024 * KB, color: '#f43f5e', latency: '200 cycles', width: 500 },
          ].map(({ label, size, color, latency, width }) => (
            <div key={label} className="flex flex-col items-center">
              <div className="w-8 h-3 border-l border-r border-border/50" />
              <div
                className="flex items-center justify-between px-4 py-2 rounded-lg text-sm font-medium border-2"
                style={{ width, borderColor: color, backgroundColor: color + '20', color }}
              >
                <span>{label}</span>
                <span className="font-mono text-xs">{labelBytes(size)} · {latency}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {sim && (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-cyan-400">{Math.round(sim.hits / (sim.hits + sim.misses) * 100)}%</div>
              <div className="text-xs text-muted-foreground mt-1">Overall Hit Rate</div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-green-400">{sim.l1i.hitRate}%</div>
              <div className="text-xs text-muted-foreground mt-1">L1I Hit Rate</div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-blue-400">{sim.l1d.hitRate}%</div>
              <div className="text-xs text-muted-foreground mt-1">L1D Hit Rate</div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-amber-400">{sim.totalCycles.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground mt-1">Total Cycles</div>
            </div>
          </div>

          {/* Hit rate by level */}
          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Zap className="w-4 h-4 text-primary" /> Hit Rate by Cache Level</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={hitRateData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => [`${v}%`]} />
                <Bar dataKey="hitRate" name="Hit Rate" fill="#06b6d4" radius={[4,4,0,0]} />
                <Bar dataKey="missRate" name="Miss Rate" fill="#f43f5e" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Access trace */}
          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-400" /> Memory Access Trace</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-mono">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs uppercase">
                    <th className="text-left pb-2 pr-4">#</th>
                    <th className="text-left pb-2 pr-4">Address</th>
                    <th className="text-left pb-2 pr-4">Type</th>
                    <th className="text-left pb-2 pr-4">Served By</th>
                    <th className="text-left pb-2 pr-4">Cycles</th>
                    <th className="text-left pb-2">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {sim.accesses.map((a, i) => (
                    <tr key={i} className="border-b border-border/40">
                      <td className="py-1.5 pr-4 text-muted-foreground">{i+1}</td>
                      <td className="py-1.5 pr-4">{a.addr}</td>
                      <td className="py-1.5 pr-4 text-muted-foreground">{a.type}</td>
                      <td className="py-1.5 pr-4">
                        <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: (levelColors as any)[a.level] + '30', color: (levelColors as any)[a.level] }}>{a.level}</span>
                      </td>
                      <td className="py-1.5 pr-4 text-muted-foreground">{a.cycles}</td>
                      <td className="py-1.5">
                        {a.hit ? <span className="text-green-400 text-xs">HIT</span> : <span className="text-amber-400 text-xs">MISS</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function labelBytes(b: number) {
  if (b >= 1024 * 1024 * 1024) return `${b / (1024 * 1024 * 1024)}GB`;
  if (b >= 1024 * 1024) return `${b / (1024 * 1024)}MB`;
  if (b >= 1024) return `${b / 1024}KB`;
  return `${b}B`;
}
