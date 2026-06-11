import { useState } from 'react';
import { X, Cpu, Database, GitBranch, Zap, LayoutGrid, ArrowRight } from 'lucide-react';

type Component = {
  id: string; label: string; x: number; y: number; w: number; h: number;
  color: string; inputs: string[]; outputs: string[];
  purpose: string; latency: string; realWorld: string; detail: string;
};

const COMPONENTS: Component[] = [
  { id: 'pc', label: 'PC', x: 20, y: 180, w: 60, h: 40, color: '#06b6d4',
    inputs: ['Branch target (EX)', 'Jump target (EX)', 'PC+4'],
    outputs: ['Instruction address (IF/ID latch)'],
    purpose: 'Holds the address of the next instruction to fetch. Updated every cycle to PC+4 (sequential) or branch/jump target.',
    latency: '1 cycle register read', realWorld: '64-bit on modern CPUs (x86-64, AArch64)',
    detail: 'On a branch, the PC is updated to the branch target address at the end of the EX stage (or MEM stage for some architectures). The forwarding unit may override PC+4 immediately on prediction.' },
  { id: 'imem', label: 'Instr\nMemory', x: 110, y: 160, w: 80, h: 60, color: '#3b82f6',
    inputs: ['PC (address)'],
    outputs: ['32-bit instruction word'],
    purpose: 'Read-only memory containing the program\'s instructions. Addressed by the PC.',
    latency: '1 cycle (L1I cache hit) / 100+ cycles (DRAM miss)', realWorld: 'L1 Instruction Cache (16–64KB, 4-way set-associative, 4 cycles)',
    detail: 'Modern processors separate I-cache and D-cache for bandwidth. The L1I cache delivers one instruction (or multiple, for superscalar decode) per cycle when hot.' },
  { id: 'regfile', label: 'Register\nFile', x: 260, y: 140, w: 90, h: 80, color: '#8b5cf6',
    inputs: ['Read addr 1 (rs1)', 'Read addr 2 (rs2)', 'Write addr (WB)', 'Write data (WB)'],
    outputs: ['Read data 1 (rs1 value)', 'Read data 2 (rs2 value)'],
    purpose: 'Holds the 32 architectural registers (x0–x31). Supports 2 simultaneous reads and 1 write per cycle.',
    latency: 'Single cycle (register file is SRAM)', realWorld: 'RV32I: 32×32-bit. x86-64: 16 visible, 200+ physical (with renaming). ARM64: 31 GP registers + SP.',
    detail: 'x0 is hardwired to 0. Reads are combinational; writes are clocked. A forwarding unit bypasses the register file for recently-written values.' },
  { id: 'alu', label: 'ALU', x: 430, y: 160, w: 80, h: 60, color: '#f59e0b',
    inputs: ['Operand A (rs1 or PC)', 'Operand B (rs2 or immediate)'],
    outputs: ['ALU result', 'Zero flag (for branches)'],
    purpose: 'Performs arithmetic (ADD, SUB, MUL) and logical (AND, OR, XOR, SLL, SRL) operations. Also computes branch conditions and effective memory addresses.',
    latency: '1 cycle (integer ALU) / 3–6 cycles (multiplier)', realWorld: 'Separate integer ALU + multiplier/divider. Modern CPUs have 4–6 integer ALUs in parallel.',
    detail: 'The zero output feeds the branch control logic. MUX selects between the register value and the sign-extended immediate as the second operand.' },
  { id: 'dmem', label: 'Data\nMemory', x: 560, y: 160, w: 80, h: 60, color: '#10b981',
    inputs: ['Address (ALU result)', 'Write data (rs2)', 'MemRead / MemWrite signals'],
    outputs: ['Read data (LW result)'],
    purpose: 'Stores and loads data to/from memory. Addressed by the ALU result (effective address = base + offset).',
    latency: '4 cycles (L1D hit) / 12 cycles (L2) / 40 cycles (L3) / 200 cycles (DRAM)', realWorld: 'L1 Data Cache (16–64KB). Load-use stall if result needed next cycle.',
    detail: 'On a cache miss, the pipeline stalls (or speculatively continues in OOO machines). Write-back vs write-through policy affects coherence protocol.' },
  { id: 'ctrl', label: 'Control\nUnit', x: 110, y: 280, w: 80, h: 60, color: '#f43f5e',
    inputs: ['Instruction opcode (bits 6:0)', 'Instruction funct3/funct7'],
    outputs: ['RegWrite, MemRead, MemWrite, ALUSrc, ALUOp, Branch, Jump, MemToReg'],
    purpose: 'Decodes the instruction opcode and generates control signals that route data through the datapath.',
    latency: 'Combinational (zero cycles)', realWorld: 'Implemented as a ROM table or combinational logic. Modern CPUs use microcode ROMs for complex instructions.',
    detail: 'The control unit is purely combinational in RISC designs — no clock needed. It maps the 7-bit opcode to ~8 control signals that activate MUXes and register enables.' },
  { id: 'hazunit', label: 'Hazard\nUnit', x: 260, y: 280, w: 90, h: 60, color: '#ef4444',
    inputs: ['ID/EX: rd, MemRead', 'IF/ID: rs1, rs2'],
    outputs: ['PCWrite=0 (stall)', 'IF/IDWrite=0 (stall)', 'Control zero (bubble)'],
    purpose: 'Detects load-use hazards (only RAW hazard that forwarding cannot fix) and inserts exactly one pipeline stall (bubble) cycle.',
    latency: 'Combinational', realWorld: 'Simple 2-comparator circuit. Condition: ID/EX.MemRead AND (ID/EX.rd == IF/ID.rs1 OR ID/EX.rd == IF/ID.rs2)',
    detail: 'When a stall is detected, the hazard unit freezes the PC and IF/ID register for one cycle and inserts a NOP (bubble) into the ID/EX register.' },
  { id: 'fwdunit', label: 'Forward\nUnit', x: 430, y: 280, w: 90, h: 60, color: '#06b6d4',
    inputs: ['EX/MEM: rd, RegWrite', 'MEM/WB: rd, RegWrite', 'ID/EX: rs1, rs2'],
    outputs: ['ForwardA (2-bit)', 'ForwardB (2-bit)'],
    purpose: 'Detects RAW data hazards solvable by forwarding and selects the correct bypass path for ALU inputs.',
    latency: 'Combinational', realWorld: 'Priority encoder: EX/MEM forwarding takes priority over MEM/WB to provide the most recent value',
    detail: 'ForwardA/B = 00: register file; 10: EX/MEM (1 cycle old); 01: MEM/WB (2 cycles old). The ALU inputs are 4-way MUXes controlled by these signals.' },
  { id: 'brpred', label: 'Branch\nPredictor', x: 560, y: 280, w: 90, h: 60, color: '#a855f7',
    inputs: ['PC (for indexing)', 'Branch outcome (EX update)'],
    outputs: ['Prediction bit (taken/not-taken)', 'Predicted PC'],
    purpose: 'Predicts whether a branch will be taken before it reaches the EX stage, allowing the pipeline to continue without stalling.',
    latency: '1 cycle (read during IF)', realWorld: '2-bit saturating counter table (512–8K entries). Modern: TAGE predictor with 99%+ accuracy.',
    detail: 'The prediction is verified in EX. On misprediction, the pipeline flushes IF and ID stages (2-cycle penalty). The predictor table is updated after each branch resolves.' },
];

export default function Blueprint() {
  const [selected, setSelected] = useState<Component | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const SVG_W = 720; const SVG_H = 400;

  // Draw simplified wires
  const wires = [
    { from: [80, 200], to: [110, 190], label: 'PC' },
    { from: [190, 190], to: [260, 175], label: 'Instr' },
    { from: [350, 180], to: [430, 190], label: 'rs1/rs2' },
    { from: [510, 190], to: [560, 190], label: 'Addr/Data' },
    { from: [190, 310], to: [260, 310], label: 'Ctrl' },
    { from: [350, 310], to: [430, 310], label: 'Hazard' },
    { from: [520, 310], to: [560, 310], label: 'Fwd' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-1">Interactive CPU Blueprint</h1>
        <p className="text-muted-foreground">Click any component to see its purpose, inputs/outputs, and real-world implementation details.</p>
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <div className="text-xs text-muted-foreground mb-2 flex items-center gap-4">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500/30 inline-block border border-blue-500" /> Instruction path</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-500/30 inline-block border border-purple-500" /> Data path</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500/30 inline-block border border-red-500" /> Control path</span>
        </div>

        {/* SVG Blueprint */}
        <div className="overflow-x-auto">
          <svg width={SVG_W} height={SVG_H} className="rounded-lg bg-slate-950/50 border border-border">
            {/* Grid dots */}
            {Array.from({ length: 24 }, (_, x) =>
              Array.from({ length: 14 }, (_, y) => (
                <circle key={`${x}-${y}`} cx={x * 30 + 15} cy={y * 28 + 14} r={1} fill="#1e293b" />
              ))
            )}

            {/* Wires */}
            {wires.map((w, i) => (
              <g key={i}>
                <line x1={w.from[0]} y1={w.from[1]} x2={w.to[0]} y2={w.to[1]} stroke="#334155" strokeWidth={2} strokeDasharray="4,2" />
              </g>
            ))}

            {/* Main datapath arrow */}
            <defs>
              <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="#334155" />
              </marker>
            </defs>
            <line x1={80} y1={200} x2={680} y2={200} stroke="#1e293b" strokeWidth={8} strokeDasharray="20,4" />
            <text x={350} y={215} textAnchor="middle" fill="#334155" fontSize="10" fontFamily="monospace">DATAPATH</text>

            {/* Components */}
            {COMPONENTS.map(comp => {
              const isHovered = hoverId === comp.id;
              const isSelected = selected?.id === comp.id;
              return (
                <g key={comp.id} className="cursor-pointer"
                  onClick={() => setSelected(selected?.id === comp.id ? null : comp)}
                  onMouseEnter={() => setHoverId(comp.id)}
                  onMouseLeave={() => setHoverId(null)}>
                  <rect x={comp.x} y={comp.y} width={comp.w} height={comp.h} rx={6}
                    fill={comp.color + (isSelected ? '40' : isHovered ? '25' : '15')}
                    stroke={comp.color}
                    strokeWidth={isSelected ? 2.5 : isHovered ? 2 : 1.5}
                    className="transition-all" />
                  <text x={comp.x + comp.w / 2} y={comp.y + comp.h / 2}
                    textAnchor="middle" dominantBaseline="central"
                    fill={comp.color} fontSize="11" fontWeight="600" fontFamily="monospace">
                    {comp.label.split('\n').map((line, i, arr) => (
                      <tspan key={i} x={comp.x + comp.w / 2} dy={i === 0 ? (arr.length > 1 ? '-0.6em' : 0) : '1.2em'}>{line}</tspan>
                    ))}
                  </text>
                </g>
              );
            })}

            {/* Labels */}
            <text x={20} y={145} fill="#475569" fontSize="10" fontFamily="monospace">INSTRUCTION FETCH →</text>
            <text x={20} y={260} fill="#475569" fontSize="10" fontFamily="monospace">CONTROL LOGIC ↓</text>
          </svg>
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="bg-card border rounded-lg p-5 relative" style={{ borderColor: selected.color + '60' }}>
          <button onClick={() => setSelected(null)} className="absolute top-3 right-3 p-1 hover:bg-muted rounded">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selected.color }} />
            <h2 className="text-xl font-bold" style={{ color: selected.color }}>{selected.label.replace('\n', ' ')}</h2>
            <span className="text-xs text-muted-foreground">Component Detail</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Purpose</div>
                <p className="text-sm">{selected.purpose}</p>
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Detail</div>
                <p className="text-sm text-muted-foreground">{selected.detail}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-semibold text-green-400 mb-1">Inputs</div>
                  <ul className="space-y-1">
                    {selected.inputs.map((inp, i) => <li key={i} className="text-xs text-muted-foreground flex items-start gap-1"><ArrowRight className="w-3 h-3 text-green-400 shrink-0 mt-0.5" />{inp}</li>)}
                  </ul>
                </div>
                <div>
                  <div className="text-xs font-semibold text-blue-400 mb-1">Outputs</div>
                  <ul className="space-y-1">
                    {selected.outputs.map((out, i) => <li key={i} className="text-xs text-muted-foreground flex items-start gap-1"><ArrowRight className="w-3 h-3 text-blue-400 shrink-0 mt-0.5" />{out}</li>)}
                  </ul>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="border border-border rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-1">Latency</div>
                <div className="text-sm font-medium">{selected.latency}</div>
              </div>
              <div className="border border-border rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-1">Real-World Implementation</div>
                <div className="text-sm">{selected.realWorld}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!selected && (
        <div className="text-center text-sm text-muted-foreground py-4">
          Click any component in the diagram above to see detailed information
        </div>
      )}
    </div>
  );
}
