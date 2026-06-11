import { useEffect, useRef, useState } from 'react';
import {
  WAVE_SIGNALS, formatBusValue, type WaveSample, type WaveSignal,
} from '@/engine/waveformTrace';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

const ROW_H = 26;
const GROUP_H = 18;
const NAME_W = 248;
const RULER_H = 22;

const GTK = {
  bg: '#0a0a12',
  grid: '#1e293b',
  gridMajor: '#334155',
  nameBg: '#0f172a',
  nameText: '#94a3b8',
  groupText: '#64748b',
  waveHi: '#22d3ee',
  waveLo: '#0e7490',
  busBg: '#052e16',
  busBgAlt: '#14532d',
  busText: '#4ade80',
  busBorder: '#166534',
  cursor: '#f43f5e',
  asciiText: '#fbbf24',
};

const GROUPS = [...new Set(WAVE_SIGNALS.map((s) => s.group))];

function sampleVal(s: WaveSample, sig: WaveSignal): number | string {
  return sig.format === 'ascii' ? String(s[sig.key]) : (s[sig.key] as number);
}

function SignalWaveRow({
  sig, samples, cellW, yOffset,
}: {
  sig: WaveSignal;
  samples: WaveSample[];
  cellW: number;
  yOffset: number;
}) {
  const y = yOffset;
  const yHi = y + 5;
  const yLo = y + ROW_H - 7;
  const waveW = samples.length * cellW;
  const els: JSX.Element[] = [];

  if (sig.format === 'wire') {
    let prev = sampleVal(samples[0], sig) as number;
    for (let c = 0; c < samples.length; c++) {
      const val = sampleVal(samples[c], sig) as number;
      const x1 = c * cellW;
      const x2 = (c + 1) * cellW;
      els.push(
        <line key={`l${c}`} x1={x1} y1={prev ? yHi : yLo} x2={x2} y2={val ? yHi : yLo}
          stroke={val ? GTK.waveHi : GTK.waveLo} strokeWidth={1.5} />,
      );
      if (c > 0 && val !== prev) {
        els.push(<line key={`e${c}`} x1={x1} y1={yHi} x2={x1} y2={yLo} stroke={GTK.waveHi} strokeWidth={1.5} />);
      }
      prev = val;
    }
  } else {
    let segStart = 0;
    let prevVal = sampleVal(samples[0], sig);
    for (let c = 1; c <= samples.length; c++) {
      const val = c < samples.length ? sampleVal(samples[c], sig) : null;
      if (c === samples.length || val !== prevVal) {
        const x1 = segStart * cellW + 1;
        const x2 = c * cellW - 1;
        const w = x2 - x1;
        if (w > 2) {
          const display = sig.format === 'ascii'
            ? String(prevVal)
            : formatBusValue(prevVal as number, sig.width);
          els.push(
            <g key={`b${segStart}`}>
              <rect x={x1} y={y + 3} width={w} height={ROW_H - 8} rx={1}
                fill={segStart % 2 ? GTK.busBg : GTK.busBgAlt}
                stroke={GTK.busBorder} strokeWidth={0.5} />
              {w > 18 && (
                <text x={x1 + 3} y={y + ROW_H / 2 + 2}
                  fill={sig.format === 'ascii' ? GTK.asciiText : GTK.busText}
                  fontSize={sig.format === 'ascii' ? 9 : 8} fontFamily="'JetBrains Mono',monospace">
                  {display}
                </text>
              )}
            </g>,
          );
        }
        segStart = c;
        if (c < samples.length) prevVal = val as number | string;
      }
    }
  }

  els.push(<line key="row" x1={0} y1={y + ROW_H - 1} x2={waveW} y2={y + ROW_H - 1} stroke="#1e293b" strokeWidth={0.5} />);
  return <g>{els}</g>;
}

type Props = {
  samples: WaveSample[];
  currentCycle: number;
};

export function GtkWaveViewer({ samples, currentCycle }: Props) {
  const [cellW, setCellW] = useState(28);
  const scrollRef = useRef<HTMLDivElement>(null);
  const totalCycles = Math.max(samples.length, 1);
  const waveW = totalCycles * cellW;

  const totalH = RULER_H + GROUPS.length * GROUP_H + WAVE_SIGNALS.length * ROW_H;

  const rowOffsets = (() => {
    let y = RULER_H;
    const rows: { sig: WaveSignal; y: number }[] = [];
    for (const group of GROUPS) {
      y += GROUP_H;
      for (const sig of WAVE_SIGNALS.filter((s) => s.group === group)) {
        rows.push({ sig, y });
        y += ROW_H;
      }
    }
    return rows;
  })();

  useEffect(() => {
    if (!scrollRef.current || currentCycle <= 0) return;
    scrollRef.current.scrollLeft = Math.max(0, currentCycle * cellW - scrollRef.current.clientWidth / 3);
  }, [currentCycle, cellW]);

  if (samples.length === 0) {
    return (
      <div className="rounded-lg border border-slate-700 p-8 text-center text-slate-400 text-sm font-mono" style={{ background: GTK.bg }}>
        Run the RTL testbench to generate VCD-style waveforms…
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-700 overflow-hidden shadow-2xl" style={{ background: GTK.bg }}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700" style={{ background: '#111827' }}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-green-400 font-mono">GTKWave</span>
          <span className="text-[10px] text-slate-500">VCD viewer · dut.riscv_core</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-900/40 text-green-400 font-mono">
            {WAVE_SIGNALS.length} signals
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setCellW((w) => Math.max(10, w - 4))} className="p-1.5 rounded hover:bg-slate-800 text-slate-400"><ZoomOut className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={() => setCellW((w) => Math.min(72, w + 4))} className="p-1.5 rounded hover:bg-slate-800 text-slate-400"><ZoomIn className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={() => setCellW(28)} className="p-1.5 rounded hover:bg-slate-800 text-slate-400"><Maximize2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      <div className="flex" style={{ maxHeight: 560 }}>
        <div className="shrink-0 overflow-y-auto border-r border-slate-700" style={{ width: NAME_W, background: GTK.nameBg }}>
          <div style={{ height: RULER_H }} className="border-b border-slate-700 flex items-end px-2 pb-1">
            <span className="text-[9px] text-slate-500 font-mono">Signal hierarchy</span>
          </div>
          {GROUPS.map((group) => {
            const sigs = WAVE_SIGNALS.filter((s) => s.group === group);
            return (
              <div key={group}>
                <div style={{ height: GROUP_H, background: '#0c1222' }} className="flex items-center px-2 border-b border-slate-800/60">
                  <span className="text-[9px] font-mono text-slate-500 truncate">{group}</span>
                </div>
                {sigs.map((sig) => (
                  <div key={sig.key} style={{ height: ROW_H }}
                    className="flex items-center px-2 border-b border-slate-800/30 font-mono text-[10px] text-slate-400">
                    <span className="truncate">{sig.label}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <div ref={scrollRef} className="flex-1 overflow-auto">
          <svg width={waveW + 4} height={totalH} style={{ background: GTK.bg }}>
            {Array.from({ length: totalCycles + 1 }).map((_, c) => (
              <g key={c}>
                <line x1={c * cellW} y1={0} x2={c * cellW} y2={totalH}
                  stroke={c % 5 === 0 ? GTK.gridMajor : GTK.grid} strokeWidth={c % 5 === 0 ? 1 : 0.5} />
                {c % 5 === 0 && (
                  <text x={c * cellW + 2} y={14} fill="#64748b" fontSize={8} fontFamily="monospace">{c}</text>
                )}
              </g>
            ))}

            {currentCycle > 0 && (
              <line x1={currentCycle * cellW} y1={0} x2={currentCycle * cellW} y2={totalH}
                stroke={GTK.cursor} strokeWidth={1.5} strokeDasharray="4 2" />
            )}

            {rowOffsets.map(({ sig, y }) => (
              <SignalWaveRow key={sig.key} sig={sig} samples={samples} cellW={cellW} yOffset={y} />
            ))}
          </svg>
        </div>
      </div>

      {currentCycle > 0 && samples[currentCycle] && (
        <div className="border-t border-slate-700 px-3 py-2 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[9px]" style={{ background: '#111827' }}>
          <span className="text-red-400 font-bold">cursor t={currentCycle}</span>
          {['pc', 'if_instr', 'ex_alu', 'x3', 'x4', 'stall', 'fwd_a'].map((key) => {
            const sig = WAVE_SIGNALS.find((s) => s.key === key);
            if (!sig) return null;
            const v = sampleVal(samples[currentCycle], sig);
            return (
              <span key={key} className="text-slate-500">
                {sig.label}=<span className="text-green-400">
                  {sig.format === 'bus' ? formatBusValue(v as number, sig.width) : String(v)}
                </span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
