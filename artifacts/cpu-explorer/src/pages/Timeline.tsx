import { useState } from 'react';
import { useSimulatorStore } from '../store/simulatorStore';

const STAGE_COLORS: Record<string, string> = {
  IF: '#3b82f6', ID: '#8b5cf6', EX: '#f59e0b', MEM: '#10b981', WB: '#06b6d4',
  STALL: '#f43f5e40', FLUSH: '#ef444420',
};

type GanttRow = {
  label: string; slots: string[]; // stage or '' or 'STALL'
};

// Generate a realistic Gantt chart from an instruction sequence
function buildGantt(instrNames: string[], enableForwarding: boolean, branchAt?: number): GanttRow[] {
  const stages = ['IF', 'ID', 'EX', 'MEM', 'WB'];
  const rows: GanttRow[] = [];
  const MAX_CYCLES = 20;

  for (let i = 0; i < instrNames.length; i++) {
    const slots: string[] = new Array(MAX_CYCLES).fill('');
    let startCycle = i;

    // Load-use stall: if previous was a load and we depend on it
    const hasLoadUseStall = !enableForwarding && i > 0 && i < 3; // simplified
    const stalls = hasLoadUseStall ? 1 : 0;
    startCycle = i + stalls;

    // Branch flush: instructions after branch at branchAt get flushed
    const isFlushed = branchAt !== undefined && i > branchAt && i <= branchAt + 2;

    for (let s = 0; s < stages.length && s + startCycle < MAX_CYCLES; s++) {
      if (isFlushed && s <= 1) {
        slots[s + startCycle] = 'FLUSH';
      } else {
        slots[s + startCycle] = stages[s];
      }
    }

    if (hasLoadUseStall) {
      slots[i + 1] = 'STALL';
    }

    rows.push({ label: instrNames[i], slots });
  }
  return rows;
}

const EXAMPLES: { label: string; instrs: string[]; branch?: number }[] = [
  {
    label: 'Sequential (No Hazards)',
    instrs: ['ADD x1,x2,x3', 'AND x4,x5,x6', 'OR x7,x8,x9', 'XOR x10,x11,x12', 'SUB x13,x14,x15'],
  },
  {
    label: 'With Load-Use Stall',
    instrs: ['LW x1,0(x2)', 'ADD x3,x1,x4', 'SUB x5,x6,x7', 'AND x8,x9,x10', 'OR x11,x12,x13'],
    branch: undefined,
  },
  {
    label: 'With Branch Flush',
    instrs: ['ADD x1,x2,x3', 'BEQ x1,x0,L1', 'SUB x4,x5,x6', 'MUL x7,x8,x9', 'AND x10,x11,x12', 'OR x13,x14,x15'],
    branch: 1,
  },
  {
    label: 'Real Program (Fibonacci Inner Loop)',
    instrs: ['BGE x4,x1,end', 'ADD x5,x2,x3', 'ADD x2,x0,x3', 'ADD x3,x0,x5', 'ADDI x4,x4,1', 'JAL x0,loop'],
    branch: 0,
  },
];

export default function Timeline() {
  const [example, setExample] = useState(0);
  const [forwarding, setForwarding] = useState(true);
  const ex = EXAMPLES[example];
  const gantt = buildGantt(ex.instrs, forwarding, ex.branch);
  const maxCycles = gantt[0]?.slots.length ?? 20;
  const cycles = Array.from({ length: maxCycles }, (_, i) => i + 1);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-1">Pipeline Timeline (Gantt Chart)</h1>
        <p className="text-muted-foreground">Visualize how instructions flow through pipeline stages cycle by cycle. See stalls and flushes in real time.</p>
      </div>

      {/* Controls */}
      <div className="bg-card border border-border rounded-lg p-4 flex flex-wrap gap-4 items-center">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Example Program</label>
          <select className="bg-background border border-border rounded px-3 py-1.5 text-sm" value={example}
            onChange={e => setExample(Number(e.target.value))} data-testid="select-timeline-example">
            {EXAMPLES.map((e, i) => <option key={i} value={i}>{e.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Data Forwarding</label>
          <div className="flex gap-2">
            <button onClick={() => setForwarding(true)}
              className={`px-3 py-1.5 rounded border text-sm ${forwarding ? 'border-green-500 bg-green-500/10 text-green-400' : 'border-border text-muted-foreground'}`}
              data-testid="forwarding-on">Enabled</button>
            <button onClick={() => setForwarding(false)}
              className={`px-3 py-1.5 rounded border text-sm ${!forwarding ? 'border-red-500 bg-red-500/10 text-red-400' : 'border-border text-muted-foreground'}`}
              data-testid="forwarding-off">Disabled</button>
          </div>
        </div>

        {/* Legend */}
        <div className="ml-auto flex gap-3 flex-wrap">
          {[['IF','Instruction Fetch'], ['ID','Decode'], ['EX','Execute'], ['MEM','Memory'], ['WB','Writeback']].map(([s, label]) => (
            <div key={s} className="flex items-center gap-1.5 text-xs">
              <div className="w-8 h-4 rounded flex items-center justify-center text-white font-bold text-xs" style={{ backgroundColor: STAGE_COLORS[s] }}>{s}</div>
              <span className="text-muted-foreground hidden sm:block">{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-xs">
            <div className="w-8 h-4 rounded" style={{ backgroundColor: '#f43f5e', opacity: 0.4 }} />
            <span className="text-muted-foreground">Stall/Flush</span>
          </div>
        </div>
      </div>

      {/* Gantt chart */}
      <div className="bg-card border border-border rounded-lg p-4 overflow-x-auto">
        <table className="text-xs font-mono min-w-max w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left pr-4 pb-2 text-muted-foreground font-normal w-36">Instruction</th>
              {cycles.map(c => (
                <th key={c} className="w-10 pb-2 text-muted-foreground font-normal text-center">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gantt.map((row, ri) => (
              <tr key={ri}>
                <td className="pr-4 py-1 text-muted-foreground text-right align-middle whitespace-nowrap" style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <span title={row.label} className="text-xs">{row.label.split(',')[0]}</span>
                </td>
                {row.slots.map((slot, ci) => {
                  if (!slot) return <td key={ci} className="px-1 py-1" />;
                  const isStall = slot === 'STALL';
                  const isFlush = slot === 'FLUSH';
                  const color = STAGE_COLORS[slot];
                  return (
                    <td key={ci} className="px-0.5 py-1">
                      <div className={`h-7 rounded flex items-center justify-center font-bold text-xs transition-all ${isStall ? 'text-red-400' : isFlush ? 'text-red-300/60' : 'text-white'}`}
                        style={{ backgroundColor: isStall ? '#f43f5e30' : isFlush ? '#f43f5e15' : color + 'e0', border: `1px solid ${isStall ? '#f43f5e' : isFlush ? '#f43f5e30' : color}` }}>
                        {isStall ? '■' : isFlush ? '×' : slot}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {(() => {
          const allSlots = gantt.flatMap(r => r.slots);
          const active = allSlots.filter(s => s && s !== 'STALL' && s !== 'FLUSH').length;
          const stalls = allSlots.filter(s => s === 'STALL').length;
          const flushes = allSlots.filter(s => s === 'FLUSH').length;
          const latestCycle = Math.max(...gantt.map(r => r.slots.lastIndexOf('WB') + 1));
          const cpi = latestCycle > 0 ? (latestCycle / ex.instrs.length).toFixed(2) : '—';
          return [
            { label: 'Execution Cycles', value: latestCycle || '—', color: '#06b6d4' },
            { label: 'CPI', value: cpi, color: '#f59e0b' },
            { label: 'Stall Cycles', value: stalls, color: '#f43f5e' },
            { label: 'Flushed Slots', value: flushes, color: '#8b5cf6' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-card border border-border rounded-lg p-4 text-center">
              <div className="text-3xl font-bold" style={{ color }}>{value}</div>
              <div className="text-xs text-muted-foreground mt-1">{label}</div>
            </div>
          ));
        })()}
      </div>

      {/* Explanation */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="font-semibold mb-3">Reading the Gantt Chart</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Each row represents one instruction flowing through the 5 pipeline stages (IF, ID, EX, MEM, WB). Ideally, each instruction starts one cycle after the previous one — giving a diagonal staircase pattern.</p>
          </div>
          <div>
            <p className="text-muted-foreground">Red <strong className="text-red-400">■ (STALL)</strong> cells indicate a pipeline bubble — a wasted cycle due to a data hazard. Grey <strong className="text-red-400/60">× (FLUSH)</strong> cells indicate instructions squashed due to a branch misprediction.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
