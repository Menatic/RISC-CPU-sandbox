import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { assemble } from '@/engine/riscv';
import {
  advancePipeline, isPipelineDone, EMPTY_PIPELINE, INITIAL_STATS,
  type PipelineHistoryEntry, type PipelineState, type SimStats,
} from '@/store/simulatorStore';
import { captureWaveSample, type WaveSample } from '@/engine/waveformTrace';
import { RTL_PASS_REGS, RTL_TESTBENCH_ASM } from '@/data/rtlTestProgram';
import { STAGES_15, type VerilogCoreId } from '@/data/verilogManifest';
import { GtkWaveViewer } from '@/components/rtl/GtkWaveViewer';
import {
  Play, StepForward, RotateCcw, CheckCircle2, XCircle, Activity, Cpu, Radio,
} from 'lucide-react';

const STAGE_COLORS: Record<string, string> = {
  IF: '#06b6d4', ID: '#8b5cf6', EX: '#f59e0b', MEM: '#10b981', WB: '#f43f5e',
};

function mapFiveToFifteen(stages: PipelineState): number | undefined {
  if (stages.WB) return 14;
  if (stages.MEM) return 12;
  if (stages.EX) return 9;
  if (stages.ID) return 5;
  if (stages.IF) return 2;
  return undefined;
}

function StageBoxes({ stages, core }: { stages: PipelineState; core: VerilogCoreId }) {
  const ids = ['IF', 'ID', 'EX', 'MEM', 'WB'] as const;
  const active15 = core === '15stage' ? mapFiveToFifteen(stages) : undefined;

  if (core === '15stage') {
    return (
      <div className="flex flex-wrap gap-0.5">
        {STAGES_15.map((s) => (
          <div
            key={s.id}
            className={`flex-1 min-w-[44px] rounded px-0.5 py-1.5 text-center border text-[9px] transition-all ${
              active15 === s.n
                ? 'bg-primary/25 border-primary text-primary font-bold scale-105'
                : 'bg-secondary/30 border-border text-muted-foreground'
            }`}
          >
            <div className="font-mono">S{s.n}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-5 gap-2">
      {ids.map((id) => {
        const slot = stages[id];
        return (
          <div
            key={id}
            className="rounded-lg border p-2 min-h-[72px]"
            style={{
              borderColor: slot ? STAGE_COLORS[id] : undefined,
              backgroundColor: slot ? `${STAGE_COLORS[id]}18` : undefined,
            }}
          >
            <p className="text-[10px] font-bold mb-1" style={{ color: STAGE_COLORS[id] }}>{id}</p>
            {slot ? (
              <>
                <p className="font-mono text-[10px] truncate">{slot.instr.mnemonic}</p>
                <p className="text-[9px] text-muted-foreground">PC 0x{slot.instr.pc.toString(16)}</p>
                {slot.stall && <p className="text-[9px] text-amber-400">STALL</p>}
                {slot.flush && <p className="text-[9px] text-red-400">FLUSH</p>}
                {slot.forwardA && <p className="text-[9px] text-cyan-400">FWD_A</p>}
              </>
            ) : (
              <p className="text-[9px] text-muted-foreground">bubble</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

type SimSnapshot = {
  registers: number[];
  memory: Map<number, number>;
  fetchPC: number;
  pipelineStages: PipelineState;
  pipelineHistory: PipelineHistoryEntry[];
  stats: SimStats;
  waveformSamples: WaveSample[];
  executionMode: 'ready' | 'running' | 'complete';
  lastExplanation: string;
};

function initialWaveSample(startPC: number): WaveSample {
  return captureWaveSample(0, startPC, EMPTY_PIPELINE, new Array(32).fill(0), { ...INITIAL_STATS }, {
    stall: false, flush: false, loadUse: false,
  });
}

function freshSnapshot(startPC: number): SimSnapshot {
  return {
    registers: new Array(32).fill(0),
    memory: new Map(),
    fetchPC: startPC,
    pipelineStages: EMPTY_PIPELINE,
    pipelineHistory: [],
    stats: { ...INITIAL_STATS },
    waveformSamples: [initialWaveSample(startPC)],
    executionMode: 'ready',
    lastExplanation: 'Click Run to execute — GTKWave-style signal trace updates live.',
  };
}

function applyStep(snap: SimSnapshot, instructions: ReturnType<typeof assemble>['instructions']): SimSnapshot {
  const r = advancePipeline(
    snap.pipelineStages, snap.fetchPC, instructions,
    snap.registers, snap.memory, true, snap.stats,
  );
  const hist: PipelineHistoryEntry = {
    cycle: r.cycleNum,
    stages: { IF: r.next.IF, ID: r.next.ID, EX: r.next.EX, MEM: r.next.MEM, WB: r.next.WB },
    stalls: r.newStats.stalls - snap.stats.stalls,
    flushes: r.newStats.flushes - snap.stats.flushes,
  };
  let expl = `Cycle ${r.cycleNum}`;
  if (r.retired) expl += ` — WB: ${r.retired.instr.mnemonic}`;
  if (hist.stalls) expl += ' [load-use stall → hazard.stall=1]';
  if (hist.flushes) expl += ' [branch flush]';

  const wave = captureWaveSample(
    r.cycleNum, r.newFetchPC, r.next, r.newRegisters, r.newStats,
    { stall: hist.stalls > 0, flush: hist.flushes > 0, loadUse: hist.stalls > 0 },
  );

  const finished = isPipelineDone(r.next, r.newFetchPC, instructions);
  return {
    registers: r.newRegisters,
    memory: r.newMemory,
    fetchPC: r.newFetchPC,
    pipelineStages: r.next,
    pipelineHistory: [...snap.pipelineHistory, hist],
    stats: r.newStats,
    waveformSamples: [...snap.waveformSamples, wave],
    executionMode: finished ? 'complete' : 'running',
    lastExplanation: expl,
  };
}

function runFullSim(startPC: number, instructions: ReturnType<typeof assemble>['instructions']): SimSnapshot {
  let s = freshSnapshot(startPC);
  for (let i = 0; i < 120; i++) {
    if (s.executionMode === 'complete') break;
    if (isPipelineDone(s.pipelineStages, s.fetchPC, instructions) && s.stats.cycles > 0) {
      s = { ...s, executionMode: 'complete' };
      break;
    }
    s = applyStep(s, instructions);
  }
  return s;
}

export function RtlBrowserSimulator({ core }: { core: VerilogCoreId }) {
  const assembled = useMemo(() => assemble(RTL_TESTBENCH_ASM), []);
  const [snap, setSnap] = useState(() => freshSnapshot(assembled.startPC));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pass = snap.registers[3] === RTL_PASS_REGS.x3 && snap.registers[4] === RTL_PASS_REGS.x4;
  const done = snap.executionMode === 'complete';

  const reset = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setSnap(freshSnapshot(assembled.startPC));
  }, [assembled.startPC]);

  const step = useCallback(() => {
    setSnap((prev) => {
      if (prev.executionMode === 'complete') return prev;
      return applyStep(prev, assembled.instructions);
    });
  }, [assembled.instructions]);

  const run = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setSnap((prev) => ({ ...prev, executionMode: 'running' }));
    timerRef.current = setInterval(() => {
      setSnap((prev) => {
        if (prev.executionMode === 'complete') {
          if (timerRef.current) clearInterval(timerRef.current);
          return prev;
        }
        const next = applyStep({ ...prev, executionMode: 'running' }, assembled.instructions);
        if (next.executionMode === 'complete' && timerRef.current) clearInterval(timerRef.current);
        return next;
      });
    }, core === '15stage' ? 80 : 140);
  }, [assembled.instructions, core]);

  const runInstant = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setSnap(runFullSim(assembled.startPC, assembled.instructions));
  }, [assembled.instructions, assembled.startPC]);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setSnap(freshSnapshot(assembled.startPC));
    const t = setTimeout(() => {
      setSnap(runFullSim(assembled.startPC, assembled.instructions));
    }, 350);
    return () => clearTimeout(t);
  }, [core, assembled.startPC, assembled.instructions]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-green-500/30 bg-green-950/20 p-3 text-sm">
        <strong className="text-green-400 font-mono">GTKWave-style VCD viewer</strong>
        <span className="text-slate-400">
          {' '}— 31 hardware signals (clk, PC, pipeline latches, hazard, forwarding, ALU, DMEM, regfile)
          traced cycle-by-cycle. Same testbench as <code className="text-xs">tb_riscv_core.v</code>.
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={run} disabled={done}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-medium disabled:opacity-50">
          <Play className="w-4 h-4" /> Animate
        </button>
        <button type="button" onClick={runInstant}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-green-300 text-sm border border-slate-600">
          <Radio className="w-4 h-4" /> Full Trace
        </button>
        <button type="button" onClick={step} disabled={done}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-secondary">
          <StepForward className="w-4 h-4" /> Step
        </button>
        <button type="button" onClick={reset}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-secondary">
          <RotateCcw className="w-4 h-4" /> Reset
        </button>
        <span className="text-sm text-muted-foreground ml-auto font-mono">
          t={snap.stats.cycles} · IPC={snap.stats.ipc} · retired={snap.stats.instructionsRetired}
          · signals={snap.waveformSamples.length}
        </span>
      </div>

      {done && (
        <div className={`flex items-center gap-2 rounded-lg border p-3 text-sm font-medium font-mono ${
          pass ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300' : 'bg-red-500/10 border-red-500/40 text-red-300'
        }`}>
          {pass ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          {pass
            ? `[PASS] tb_riscv_core.v — x3=${snap.registers[3]} x4=${snap.registers[4]}`
            : `[FAIL] expected x3=8 x4=8`}
        </div>
      )}

      <p className="text-xs text-muted-foreground border-l-2 border-green-500/50 pl-3 font-mono">{snap.lastExplanation}</p>

      {/* GTKWave viewer — primary focus */}
      <GtkWaveViewer samples={snap.waveformSamples} currentCycle={snap.stats.cycles} />

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h4 className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
            <Activity className="w-3 h-3" />
            {core === '15stage' ? '15-Stage Pipeline' : '5-Stage Pipeline'}
          </h4>
          <StageBoxes stages={snap.pipelineStages} core={core} />
        </div>

        <div className="rounded-lg border border-border bg-card p-4 space-y-2">
          <h4 className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
            <Cpu className="w-3 h-3" /> dut.regfile
          </h4>
          <div className="grid grid-cols-2 gap-2 font-mono text-sm">
            {[
              { n: 1, v: snap.registers[1] },
              { n: 2, v: snap.registers[2] },
              { n: 3, v: snap.registers[3], highlight: true },
              { n: 4, v: snap.registers[4], highlight: true },
            ].map(({ n, v, highlight }) => (
              <div key={n} className={`rounded px-2 py-1.5 border font-mono text-xs ${highlight ? 'border-green-500/50 bg-green-500/10' : 'border-border'}`}>
                x{n} = <span className="text-green-400">0x{(v >>> 0).toString(16).toUpperCase().padStart(8, '0')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
