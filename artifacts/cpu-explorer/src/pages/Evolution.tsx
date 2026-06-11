import { useState } from 'react';
import { ChevronLeft, ChevronRight, Cpu, Clock, Zap, TrendingUp } from 'lucide-react';

type ArchEra = {
  id: string; name: string; era: string; cpi: string; ipc: string;
  transistors: string; clockMhz: string; realCPUs: string[];
  description: string; keyInnovation: string;
  limitations: string[]; advances: string[];
  pipelineStages: number;
  color: string;
};

const ARCHITECTURES: ArchEra[] = [
  {
    id: 'single', name: 'Single-Cycle CPU', era: '1960s–70s', cpi: '4.0', ipc: '0.25',
    transistors: '~2,000', clockMhz: '1–5 MHz', realCPUs: ['Intel 8080', 'MOS 6502', 'Zilog Z80'],
    description: 'Every instruction completes in exactly one clock cycle. The clock period must accommodate the slowest instruction (e.g., multiply or divide). Simple control unit — one combinational path per instruction type.',
    keyInnovation: 'Separate instruction and data memory paths allow one instruction per cycle. Simple, correct, but slow.',
    limitations: ['Clock period = worst-case instruction (typically multiply)', 'Low clock frequency', 'Hardware idle during fast instruction execution', 'CPI artificially inflated'],
    advances: ['Predictable timing', 'Simple verification', 'No pipeline hazards'],
    pipelineStages: 1, color: '#f43f5e',
  },
  {
    id: 'multicycle', name: 'Multi-Cycle CPU', era: '1975–85', cpi: '3.0', ipc: '0.33',
    transistors: '~10,000', clockMhz: '2–10 MHz', realCPUs: ['Motorola 68000', 'Intel 8086', 'PDP-11'],
    description: 'Different instructions take different numbers of cycles, each cycle doing one stage of work. The clock can run faster since each cycle does less work. State registers hold intermediate values between cycles.',
    keyInnovation: 'Variable-cycle execution. Simple instructions (AND, ADD) take fewer cycles than complex ones (MUL, DIV). Higher average clock frequency.',
    limitations: ['Still one instruction active at a time', 'Complex FSM control unit', 'Variable CPI makes timing analysis harder'],
    advances: ['Higher clock frequency', 'Hardware reuse across cycles (single ALU, single memory)', 'Better match to instruction complexity'],
    pipelineStages: 1, color: '#f97316',
  },
  {
    id: 'pipeline5', name: '5-Stage Pipeline', era: '1985–90', cpi: '1.5', ipc: '0.67',
    transistors: '~100,000', clockMhz: '16–50 MHz', realCPUs: ['MIPS R2000', 'ARM2', 'SPARC v7'],
    description: 'IF → ID → EX → MEM → WB. Multiple instructions overlap in different stages. The pipeline can have up to 5 instructions in-flight simultaneously. Hazards require stalls.',
    keyInnovation: 'Instruction-level pipelining. Classic RISC pipeline. Throughput approaches 1 IPC despite multi-stage execution.',
    limitations: ['Data hazards cause stall cycles (RAW worst case: 2 stalls)', 'Control hazards flush 2–3 stages on misprediction', 'Structural hazards if shared resources'],
    advances: ['Near-1-IPC throughput', 'Higher clock frequency vs multicycle', 'Foundation for all modern CPUs', 'Separates concerns: IF, decode, execute, memory, writeback'],
    pipelineStages: 5, color: '#f59e0b',
  },
  {
    id: 'forwarding', name: 'Pipeline + Forwarding', era: '1988–93', cpi: '1.2', ipc: '0.83',
    transistors: '~200,000', clockMhz: '25–100 MHz', realCPUs: ['MIPS R4000', 'Intel i486', 'HP PA-RISC'],
    description: 'Data forwarding (bypassing) routes the output of the EX or MEM stage directly to the EX input of a dependent instruction, eliminating most data hazard stalls. Only load-use hazards still require one stall cycle.',
    keyInnovation: 'Forwarding unit detects dependencies and routes values through bypass paths. Eliminates ~80% of RAW stalls.',
    limitations: ['Load-use hazard still requires 1 stall cycle', 'Branch penalty unchanged', 'Forwarding unit adds complexity and latency'],
    advances: ['Dramatic stall reduction', 'Almost-1 CPI for integer code', 'Load scheduling (compiler can hide load-use stall)'],
    pipelineStages: 5, color: '#eab308',
  },
  {
    id: 'branchpred', name: 'Branch Predicted Pipeline', era: '1990–95', cpi: '1.1', ipc: '0.91',
    transistors: '~500,000', clockMhz: '50–200 MHz', realCPUs: ['Intel Pentium', 'Alpha 21064', 'PowerPC 601'],
    description: 'A branch predictor (1-bit or 2-bit saturating counter) guesses the branch outcome before it resolves. Correctly predicted branches have zero penalty. Mispredictions flush the pipeline and incur a 2-cycle penalty.',
    keyInnovation: '2-bit saturating counter achieves ~85–90% accuracy on typical programs. Backwards branches (loops) are almost always correctly predicted as taken.',
    limitations: ['Misprediction penalty still 2–3 cycles', 'Predictor table limited by size', 'Hard-to-predict data-dependent branches'],
    advances: ['Near-zero branch penalty for loops', '90%+ accuracy on integer benchmarks', 'Enables deeper pipelines'],
    pipelineStages: 5, color: '#22c55e',
  },
  {
    id: 'superscalar', name: 'Superscalar (2–4 wide)', era: '1993–98', cpi: '0.8', ipc: '1.25',
    transistors: '~3,000,000', clockMhz: '60–450 MHz', realCPUs: ['Intel Pentium (dual pipe)', 'Alpha 21164', 'MIPS R10000'],
    description: 'Multiple functional units allow issuing 2 or more instructions per cycle (IPC > 1). An issue logic unit checks for dependencies and resource conflicts, then dispatches groups of independent instructions to separate execution units.',
    keyInnovation: 'Breaking the 1-IPC barrier. Multiple decode/issue slots, multiple ALUs, load/store units, floating-point units operating in parallel.',
    limitations: ['ILP wall: most programs have 2–4 independent instructions on average', 'Register pressure', 'Wide instruction fetch and decode is power-hungry', 'In-order issue still limited by first hazard'],
    advances: ['IPC > 1', 'Separate integer and floating-point pipelines', 'Multiple issue slots', 'Significant performance jump over scalar'],
    pipelineStages: 5, color: '#06b6d4',
  },
  {
    id: 'ooo', name: 'Out-of-Order Execution', era: '1995+', cpi: '0.6', ipc: '1.7',
    transistors: '~5,000,000', clockMhz: '150–600 MHz', realCPUs: ['Intel P6 (Pentium Pro)', 'Alpha 21264', 'AMD K5'],
    description: 'Tomasulo\'s algorithm dynamically schedules instructions based on operand availability rather than program order. A Reorder Buffer (ROB) ensures in-order commitment. Register renaming eliminates WAR and WAW hazards.',
    keyInnovation: 'Dynamic scheduling exposes ILP hidden by compiler. Instructions execute as soon as their operands are ready. ROB maintains precise interrupt/exception handling.',
    limitations: ['Large, power-hungry structures (ROB, RS, rename table)', 'ILP is bounded by true data dependencies', 'Complex design verification', 'Memory ordering challenges'],
    advances: ['Hides cache miss latency', 'Hides FP latency', 'IPC consistently > 1', 'Register renaming eliminates false dependencies'],
    pipelineStages: 12, color: '#8b5cf6',
  },
  {
    id: 'speculative', name: 'Speculative OOO', era: '1998–2010', cpi: '0.45', ipc: '2.2',
    transistors: '~28,000,000', clockMhz: '400 MHz–3 GHz', realCPUs: ['Intel Core 2', 'AMD Athlon 64', 'Intel Nehalem'],
    description: 'Combines out-of-order execution with aggressive branch prediction and speculative execution. The processor executes instructions beyond mispredicted branches speculatively, committing only if the prediction was correct. ROB enables precise rollback.',
    keyInnovation: 'Tournament predictor + deep ROB + wide issue. Effective IPC of 2+ on real-world code. High clock speeds via deep pipelines (14–20 stages).',
    limitations: ['Deep pipeline → high misprediction penalty (15–20 cycles)', 'Security: Spectre/Meltdown exploit speculative state', 'Power density constraints', 'Memory latency increasingly dominates'],
    advances: ['IPC > 2', 'Hides most pipeline hazards', 'GHz clock speeds', 'High branch prediction accuracy (>98% on typical code)'],
    pipelineStages: 20, color: '#a855f7',
  },
  {
    id: 'modern', name: 'Modern Superscalar OOO', era: '2010–present', cpi: '0.33', ipc: '3.0',
    transistors: '~10–100 Billion', clockMhz: '3–5 GHz', realCPUs: ['Apple M4', 'Intel Core Ultra', 'AMD Zen 4', 'ARM Cortex-X4'],
    description: 'State-of-the-art microarchitectures with 6–8 wide decode, 300+ instruction ROBs, massive reservation stations, prefetchers, TAGE predictors achieving 99%+ accuracy, and sophisticated memory disambiguation. Multiple cores add further parallelism.',
    keyInnovation: 'TAGE branch predictor + huge OOO window + deep memory prefetching. Apple M1/M4 achieve 6-wide decode and 630-entry ROBs. AMD Zen 4 adds AVX-512.',
    limitations: ['Power efficiency plateau', 'Memory bandwidth as the bottleneck', 'Single-core IPC gains slowing (Dennard scaling ended)', 'Cache hierarchy critical'],
    advances: ['IPC > 3 on integer workloads', 'SIMD for data-level parallelism', 'Hardware prefetchers hide DRAM latency', 'Heterogeneous cores (efficiency + performance)'],
    pipelineStages: 20, color: '#10b981',
  },
];

export default function Evolution() {
  const [selected, setSelected] = useState(0);
  const arch = ARCHITECTURES[selected];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-1">CPU Evolution Explorer</h1>
        <p className="text-muted-foreground">Trace the evolution of processor microarchitecture from simple single-cycle designs to modern out-of-order superscalar machines.</p>
      </div>

      {/* Timeline */}
      <div className="bg-card border border-border rounded-lg p-4 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {ARCHITECTURES.map((a, i) => (
            <button key={a.id} onClick={() => setSelected(i)} data-testid={`arch-${a.id}`}
              className={`flex flex-col items-center px-3 py-2 rounded-lg border transition-all text-center min-w-[90px] ${selected === i ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'}`}>
              <div className="w-3 h-3 rounded-full mb-1" style={{ backgroundColor: a.color }} />
              <span className="text-xs font-medium leading-tight">{a.name.split(' ').slice(0, 2).join(' ')}</span>
              <span className="text-xs text-muted-foreground">{a.era.split('–')[0]}</span>
            </button>
          ))}
        </div>
        {/* Connection line */}
        <div className="flex items-center mt-2 px-4">
          {ARCHITECTURES.map((a, i) => (
            <div key={a.id} className="flex items-center flex-1">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: i <= selected ? a.color : 'hsl(var(--border))' }} />
              {i < ARCHITECTURES.length - 1 && (
                <div className="h-0.5 flex-1" style={{ backgroundColor: i < selected ? ARCHITECTURES[i + 1].color : 'hsl(var(--border))' }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Previous / Next */}
      <div className="flex justify-between">
        <button onClick={() => setSelected(s => Math.max(0, s - 1))} disabled={selected === 0}
          className="flex items-center gap-1 px-3 py-1.5 border border-border rounded hover:bg-muted disabled:opacity-40 text-sm">
          <ChevronLeft className="w-4 h-4" /> Previous
        </button>
        <span className="text-sm text-muted-foreground">{selected + 1} / {ARCHITECTURES.length}</span>
        <button onClick={() => setSelected(s => Math.min(ARCHITECTURES.length - 1, s + 1))} disabled={selected === ARCHITECTURES.length - 1}
          className="flex items-center gap-1 px-3 py-1.5 border border-border rounded hover:bg-muted disabled:opacity-40 text-sm">
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Architecture detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card border rounded-lg p-5" style={{ borderColor: arch.color + '50' }}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="text-2xl font-bold" style={{ color: arch.color }}>{arch.name}</h2>
                <div className="text-sm text-muted-foreground mt-0.5">{arch.era}</div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold" style={{ color: arch.color }}>{arch.ipc}</div>
                <div className="text-xs text-muted-foreground">IPC</div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{arch.description}</p>
            <div className="mt-3 p-3 bg-muted/50 rounded-lg border border-border">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Key Innovation</div>
              <p className="text-sm">{arch.keyInnovation}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-green-400 mb-2">Advances</h3>
              <ul className="space-y-1">
                {arch.advances.map((a, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-green-400 shrink-0 mt-0.5">+</span>{a}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-red-400 mb-2">Limitations</h3>
              <ul className="space-y-1">
                {arch.limitations.map((l, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-red-400 shrink-0 mt-0.5">–</span>{l}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Metrics */}
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Metrics</h3>
            <div className="space-y-3">
              {[
                { label: 'Avg CPI', value: arch.cpi, icon: Clock, color: '#f59e0b' },
                { label: 'Avg IPC', value: arch.ipc, icon: Zap, color: arch.color },
                { label: 'Clock Speed', value: arch.clockMhz, icon: TrendingUp, color: '#10b981' },
                { label: 'Transistors', value: arch.transistors, icon: Cpu, color: '#8b5cf6' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0" style={{ color }} />
                  <span className="text-sm text-muted-foreground flex-1">{label}</span>
                  <span className="font-mono text-sm font-bold" style={{ color }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Real CPUs */}
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Real Processors</h3>
            <div className="space-y-1.5">
              {arch.realCPUs.map(cpu => (
                <div key={cpu} className="text-sm px-2 py-1.5 bg-muted rounded font-mono">{cpu}</div>
              ))}
            </div>
          </div>

          {/* Pipeline depth visual */}
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Pipeline Depth</h3>
            <div className="flex gap-1 flex-wrap">
              {Array.from({ length: Math.min(arch.pipelineStages, 20) }, (_, i) => (
                <div key={i} className="w-6 h-6 rounded text-xs flex items-center justify-center font-bold"
                  style={{ backgroundColor: arch.color + '30', color: arch.color, fontSize: '9px' }}>
                  {i + 1}
                </div>
              ))}
              {arch.pipelineStages > 20 && <span className="text-xs text-muted-foreground self-center">+{arch.pipelineStages - 20}</span>}
            </div>
            <div className="text-xs text-muted-foreground mt-2">{arch.pipelineStages} stage{arch.pipelineStages !== 1 ? 's' : ''}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
