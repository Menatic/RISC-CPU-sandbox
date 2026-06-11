import { useState } from 'react';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';

type HazardType = 'RAW' | 'WAR' | 'WAW' | 'Control' | 'Structural' | 'None';

type InstrDef = { mnemonic: string; rd: number | null; rs1: number | null; rs2: number | null; isLoad?: boolean; isBranch?: boolean };

type Hazard = {
  producer: number; consumer: number;
  type: HazardType; register: number;
  description: string; severity: 'critical' | 'warning' | 'info';
  resolution: string;
  forwardable: boolean;
  stallCycles: number;
};

const EXAMPLE_SEQUENCES: { label: string; description: string; instrs: InstrDef[] }[] = [
  {
    label: 'RAW Hazard (Data Dependency)',
    description: 'Classic read-after-write: instruction B reads x1 before A has written it.',
    instrs: [
      { mnemonic: 'ADD', rd: 1, rs1: 2, rs2: 3 },
      { mnemonic: 'SUB', rd: 4, rs1: 1, rs2: 5 },   // RAW on x1
      { mnemonic: 'AND', rd: 6, rs1: 4, rs2: 7 },   // RAW on x4
      { mnemonic: 'OR',  rd: 8, rs1: 9, rs2: 10 },  // no hazard
    ],
  },
  {
    label: 'WAW Hazard (Output Dependency)',
    description: 'Two instructions both write to the same register. In a pipeline, the wrong value can persist.',
    instrs: [
      { mnemonic: 'ADD', rd: 1, rs1: 2, rs2: 3 },   // writes x1 first
      { mnemonic: 'MUL', rd: 1, rs1: 4, rs2: 5 },   // WAW: also writes x1
      { mnemonic: 'SUB', rd: 6, rs1: 1, rs2: 7 },   // reads x1 — which value?
    ],
  },
  {
    label: 'Load-Use Hazard',
    description: 'A load instruction followed immediately by an instruction that uses the loaded value — one unavoidable stall cycle.',
    instrs: [
      { mnemonic: 'LW',  rd: 1, rs1: 2, rs2: null, isLoad: true },
      { mnemonic: 'ADD', rd: 3, rs1: 1, rs2: 4 },   // load-use RAW on x1 (needs stall)
      { mnemonic: 'SUB', rd: 5, rs1: 6, rs2: 7 },
    ],
  },
  {
    label: 'Control Hazard (Branch)',
    description: 'A branch instruction may change the PC. The next 1-2 instructions fetched may be wrong (pipeline flush on misprediction).',
    instrs: [
      { mnemonic: 'BEQ', rd: null, rs1: 1, rs2: 2, isBranch: true },
      { mnemonic: 'ADD', rd: 3, rs1: 4, rs2: 5 },   // may be wrong path
      { mnemonic: 'SUB', rd: 6, rs1: 7, rs2: 8 },   // may be wrong path
      { mnemonic: 'AND', rd: 9, rs1: 1, rs2: 2 },   // branch target
    ],
  },
  {
    label: 'Mixed Hazards',
    description: 'A realistic instruction sequence with RAW, WAW, and potential control hazards coexisting.',
    instrs: [
      { mnemonic: 'LW',  rd: 1, rs1: 2, rs2: null, isLoad: true },
      { mnemonic: 'ADD', rd: 3, rs1: 1, rs2: 4 },   // RAW (load-use)
      { mnemonic: 'MUL', rd: 3, rs1: 5, rs2: 6 },   // WAW on x3
      { mnemonic: 'BEQ', rd: null, rs1: 3, rs2: 7, isBranch: true }, // RAW on x3, control
      { mnemonic: 'SUB', rd: 8, rs1: 3, rs2: 1 },
    ],
  },
];

function detectHazards(instrs: InstrDef[]): Hazard[] {
  const hazards: Hazard[] = [];
  for (let i = 0; i < instrs.length; i++) {
    for (let j = i + 1; j < Math.min(i + 4, instrs.length); j++) {
      const a = instrs[i], b = instrs[j];
      const distance = j - i;

      // RAW: a writes to rd, b reads rs1 or rs2
      if (a.rd !== null) {
        if (b.rs1 === a.rd || b.rs2 === a.rd) {
          const isLoadUse = !!a.isLoad && distance === 1;
          hazards.push({
            producer: i, consumer: j, type: 'RAW', register: a.rd,
            description: `Instruction ${j+1} reads x${a.rd} before instruction ${i+1} has written it.`,
            severity: isLoadUse ? 'critical' : distance === 1 ? 'critical' : 'warning',
            resolution: isLoadUse
              ? 'Load-use hazard: must insert 1 stall cycle. Forwarding alone cannot help — data unavailable until MEM/WB.'
              : distance === 1
                ? 'Forward from EX/MEM stage. No stall needed if forwarding is enabled.'
                : 'Forward from MEM/WB stage. No stall needed.',
            forwardable: !isLoadUse,
            stallCycles: isLoadUse ? 1 : 0,
          });
        }
      }

      // WAW: both write to same register
      if (a.rd !== null && b.rd !== null && a.rd === b.rd) {
        hazards.push({
          producer: i, consumer: j, type: 'WAW', register: a.rd,
          description: `Instructions ${i+1} and ${j+1} both write to x${a.rd}. In-order completion may leave wrong value.`,
          severity: 'warning',
          resolution: 'Register renaming (Tomasulo) eliminates WAW hazards by mapping to different physical registers.',
          forwardable: false, stallCycles: 0,
        });
      }

      // Control hazard
      if (a.isBranch) {
        hazards.push({
          producer: i, consumer: j, type: 'Control', register: -1,
          description: `Instructions ${j+1} may be on wrong path after branch at instruction ${i+1}.`,
          severity: 'warning',
          resolution: 'Branch prediction reduces flushes. Full resolution requires knowing branch outcome at EX stage (2-cycle penalty worst case).',
          forwardable: false, stallCycles: 2,
        });
        break; // only one control hazard per branch
      }
    }
  }
  return hazards;
}

const MNEMONIC_COLORS: Record<string, string> = {
  ADD: '#06b6d4', SUB: '#3b82f6', MUL: '#8b5cf6', LW: '#10b981',
  SW: '#f59e0b', BEQ: '#f43f5e', BNE: '#f43f5e', AND: '#64748b', OR: '#64748b',
};

const HAZARD_COLORS: Record<HazardType, string> = {
  RAW: '#f43f5e', WAR: '#f59e0b', WAW: '#8b5cf6', Control: '#06b6d4', Structural: '#64748b', None: '#10b981',
};

export default function Hazards() {
  const [selected, setSelected] = useState(0);
  const example = EXAMPLE_SEQUENCES[selected];
  const hazards = detectHazards(example.instrs);

  const instrHazardMap: Record<number, HazardType[]> = {};
  hazards.forEach(h => {
    instrHazardMap[h.producer] = [...(instrHazardMap[h.producer] ?? []), h.type];
    instrHazardMap[h.consumer] = [...(instrHazardMap[h.consumer] ?? []), h.type];
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-1">Hazard Detection Lab</h1>
        <p className="text-muted-foreground">Identify RAW, WAW, control, and structural hazards in instruction sequences. Understand why stalls and forwarding exist.</p>
      </div>

      {/* Sequence selector */}
      <div className="flex gap-2 flex-wrap">
        {EXAMPLE_SEQUENCES.map((s, i) => (
          <button key={i} onClick={() => setSelected(i)} data-testid={`hazard-seq-${i}`}
            className={`px-3 py-2 rounded-lg border text-sm transition-all ${selected === i ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/40'}`}>
            {s.label}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <p className="text-sm text-muted-foreground">{example.description}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline stage visualization */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="font-semibold mb-4">Pipeline View</h2>
          <div className="space-y-2">
            {example.instrs.map((instr, i) => {
              const instrHazards = instrHazardMap[i] ?? [];
              const hasHazard = instrHazards.length > 0;
              const isBranch = instr.isBranch;
              return (
                <div key={i} className={`rounded-lg border p-3 transition-all ${hasHazard ? 'border-red-500/50 bg-red-500/5' : 'border-border'}`}
                  data-testid={`instr-${i}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-4">{i+1}.</span>
                      <code className="font-mono text-sm">
                        <span style={{ color: MNEMONIC_COLORS[instr.mnemonic] ?? '#ccc' }}>{instr.mnemonic}</span>
                        {instr.rd !== null && <span className="text-foreground"> x{instr.rd},</span>}
                        {instr.rs1 !== null && <span className="text-muted-foreground"> x{instr.rs1}</span>}
                        {instr.rs2 !== null && <span className="text-muted-foreground">, x{instr.rs2}</span>}
                      </code>
                    </div>
                    <div className="flex gap-1">
                      {instrHazards.map((h, j) => (
                        <span key={j} className="px-2 py-0.5 rounded text-xs font-bold border" style={{ color: HAZARD_COLORS[h], borderColor: HAZARD_COLORS[h] + '50', backgroundColor: HAZARD_COLORS[h] + '20' }}>{h}</span>
                      ))}
                      {isBranch && <span className="px-2 py-0.5 rounded text-xs text-amber-400 border border-amber-400/30 bg-amber-400/10">BRANCH</span>}
                    </div>
                  </div>
                  {/* Mini stage diagram */}
                  <div className="flex gap-1 mt-2">
                    {['IF','ID','EX','MEM','WB'].map((stage, si) => {
                      const isStall = hasHazard && instrHazards.includes('RAW') && si >= 2;
                      return (
                        <div key={stage} className={`flex-1 text-center py-0.5 rounded text-xs font-mono ${isStall && instrHazardMap[i]?.includes('RAW') ? 'bg-red-500/20 text-red-400' : 'bg-muted text-muted-foreground'}`}>
                          {stage}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Hazard details panel */}
        <div className="space-y-3">
          <h2 className="font-semibold">Detected Hazards</h2>
          {hazards.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-8 text-center">
              <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-2" />
              <p className="text-green-400 font-medium">No hazards detected</p>
            </div>
          ) : (
            hazards.map((h, i) => (
              <div key={i} className="bg-card border rounded-lg p-4 space-y-2" style={{ borderColor: HAZARD_COLORS[h.type] + '50' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" style={{ color: HAZARD_COLORS[h.type] }} />
                    <span className="font-bold text-sm" style={{ color: HAZARD_COLORS[h.type] }}>{h.type} Hazard</span>
                    {h.register >= 0 && <span className="text-xs text-muted-foreground">on x{h.register}</span>}
                  </div>
                  <div className="flex gap-1.5">
                    {h.forwardable && <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded">Forwardable</span>}
                    {h.stallCycles > 0 && <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded">{h.stallCycles} stall{h.stallCycles > 1 ? 's' : ''}</span>}
                  </div>
                </div>
                <p className="text-sm text-foreground">{h.description}</p>
                <div className="text-xs text-muted-foreground flex items-start gap-1.5 pt-1 border-t border-border">
                  <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
                  <span><strong>Resolution:</strong> {h.resolution}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Instruction {h.producer+1} → Instruction {h.consumer+1}
                </div>
              </div>
            ))
          )}

          {/* Summary */}
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="font-semibold text-sm mb-3">Hazard Summary</h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              {(['RAW','WAW','Control'] as HazardType[]).map(type => {
                const count = hazards.filter(h => h.type === type).length;
                return (
                  <div key={type} className="rounded-lg p-2 border" style={{ borderColor: HAZARD_COLORS[type] + '40', backgroundColor: HAZARD_COLORS[type] + '10' }}>
                    <div className="text-xl font-bold" style={{ color: HAZARD_COLORS[type] }}>{count}</div>
                    <div className="text-xs text-muted-foreground">{type}</div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              Total stall cycles introduced: <span className="font-mono text-foreground">{hazards.reduce((s, h) => s + h.stallCycles, 0)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
