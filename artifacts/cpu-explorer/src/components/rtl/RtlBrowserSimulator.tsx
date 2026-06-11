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
      <div className="flex flex-wrap gap-px">
        {STAGES_15.map((s) => (
          <div
            key={s.id}
            className={`flex-1 min-w-[36px] px-0.5 py-1 text-center border text-[8px] font-mono ${
              active15 === s.n
                ? 'bg-[#001800] border-[#00ff00] text-[#00ff00]'
                : 'bg-[#1c1c1c] border-[#333] text-[#666]'
            }`}
          >
            S{s.n}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-5 gap-px">
      {ids.map((id) => {
        const slot = stages[id];
        return (
          <div
            key={id}
            className="border border-[#333] p-1.5 min-h-[52px] font-mono text-[9px]"
            style={{ background: slot ? '#1a1a1a' : '#111' }}
          >
            <p className="font-bold mb-0.5" style={{ color: STAGE_COLORS[id] }}>{id}</p>
            {slot ? (
              <>
                <p className="text-[#ccc] truncate">{slot.instr.mnemonic}</p>
                <p className="text-[#666]">0x{slot.instr.pc.toString(16)}</p>
              </>
            ) : (
              <p className="text-[#444]">—</p>
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
    lastExplanation: 'Ready — press Full Trace or Animate.',
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
  if (hist.stalls) expl += ' [stall]';
  if (hist.flushes) expl += ' [flush]';

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
    }, core === '15stage' ? 90 : 160);
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
    }, 300);
    return () => clearTimeout(t);
  }, [core, assembled.startPC, assembled.instructions]);

  return (
    <div className="space-y-0">
      <GtkWaveViewer
        samples={snap.waveformSamples}
        currentCycle={snap.stats.cycles}
        className="w-full"
        toolbar={{
          onAnimate: run,
          onFullTrace: runInstant,
          onStep: step,
          onReset: reset,
          animateDisabled: done,
          stepDisabled: done,
          cycle: snap.stats.cycles,
          ipc: snap.stats.ipc,
          retired: snap.stats.instructionsRetired,
          pass: done ? pass : null,
          done,
        }}
      />

      {/* Compact inspector strip — GTKWave auxiliary panel style */}
      <div className="grid lg:grid-cols-[1fr_200px] gap-0 border border-t-0 border-[#808080] font-mono text-[10px]"
        style={{ background: '#1c1c1c' }}>
        <div className="p-2 border-r border-[#333]">
          <p className="text-[#666] mb-1 text-[9px] uppercase tracking-wider">
            {core === '15stage' ? 'dut.pipeline[15:0]' : 'dut.pipeline[4:0]'}
          </p>
          <StageBoxes stages={snap.pipelineStages} core={core} />
          <p className="text-[#555] mt-1.5 text-[9px]">{snap.lastExplanation}</p>
        </div>
        <div className="p-2">
          <p className="text-[#666] mb-1 text-[9px] uppercase tracking-wider">dut.regfile</p>
          <div className="space-y-0.5">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="flex justify-between text-[#00ff00]">
                <span className="text-[#888]">x{n}</span>
                <span>0x{(snap.registers[n] >>> 0).toString(16).toUpperCase().padStart(8, '0')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
