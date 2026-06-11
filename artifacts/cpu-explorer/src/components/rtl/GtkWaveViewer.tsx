import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  WAVE_SIGNALS, formatBusValue, type WaveSample, type WaveSignal,
} from '@/engine/waveformTrace';

const ROW_H = 22;
const GROUP_H = 16;
const NAME_W = 200;
const VALUE_W = 88;
const RULER_H = 20;
const TOOLBAR_H = 28;
const STATUS_H = 22;

/** GTKWave 3.x classic palette */
const C = {
  window: '#d4d0c8',
  toolbar: '#ece9d8',
  toolbarBorder: '#808080',
  waveBg: '#000000',
  nameBg: '#1c1c1c',
  nameFg: '#c0c0c0',
  nameHi: '#ffffff',
  valueFg: '#00ff00',
  groupBg: '#282828',
  groupFg: '#808080',
  hi: '#00ff00',
  lo: '#006600',
  edge: '#00ff00',
  busFill: '#001800',
  busBorder: '#006600',
  busText: '#00ff00',
  asciiText: '#ffff00',
  grid: '#1a1a1a',
  gridMajor: '#333333',
  cursor: '#ff0000',
  rulerBg: '#1c1c1c',
  rulerFg: '#909090',
  rowLine: '#222222',
  statusBg: '#ece9d8',
  statusFg: '#000000',
};

const GROUPS = [...new Set(WAVE_SIGNALS.map((s) => s.group))];

function sampleVal(s: WaveSample, sig: WaveSignal): number | string {
  return sig.format === 'ascii' ? String(s[sig.key]) : (s[sig.key] as number);
}

function formatCursorValue(sig: WaveSignal, v: number | string): string {
  if (sig.format === 'ascii') return String(v);
  if (sig.format === 'wire') return (v as number) ? '1' : '0';
  return formatBusValue(v as number, sig.width);
}

function drawDigitalWire(
  samples: WaveSample[],
  sig: WaveSignal,
  cellW: number,
  yHi: number,
  yLo: number,
): JSX.Element[] {
  const els: JSX.Element[] = [];
  for (let c = 0; c < samples.length; c++) {
    const val = sampleVal(samples[c], sig) as number;
    const y = val ? yHi : yLo;
    const x0 = c * cellW;
    const x1 = (c + 1) * cellW;
    els.push(
      <line key={`h${c}`} x1={x0} y1={y} x2={x1} y2={y}
        stroke={C.hi} strokeWidth={1.25} shapeRendering="crispEdges" />,
    );
    if (c > 0) {
      const prev = sampleVal(samples[c - 1], sig) as number;
      if (prev !== val) {
        const py = prev ? yHi : yLo;
        els.push(
          <line key={`v${c}`} x1={x0} y1={py} x2={x0} y2={y}
            stroke={C.edge} strokeWidth={1.25} shapeRendering="crispEdges" />,
        );
      }
    }
  }
  return els;
}

function drawBus(
  samples: WaveSample[],
  sig: WaveSignal,
  cellW: number,
  y: number,
): JSX.Element[] {
  const els: JSX.Element[] = [];
  let segStart = 0;
  let prevVal = sampleVal(samples[0], sig);

  for (let c = 1; c <= samples.length; c++) {
    const val = c < samples.length ? sampleVal(samples[c], sig) : null;
    if (c === samples.length || val !== prevVal) {
      const x1 = segStart * cellW + 0.5;
      const x2 = c * cellW - 0.5;
      const w = x2 - x1;
      if (w >= 1) {
        const display = sig.format === 'ascii'
          ? String(prevVal)
          : formatBusValue(prevVal as number, sig.width);
        const fs = sig.width > 8 ? 7 : 8;
        els.push(
          <g key={`b${segStart}`}>
            <rect x={x1} y={y + 4} width={w} height={ROW_H - 9}
              fill={C.busFill} stroke={C.busBorder} strokeWidth={0.5}
              shapeRendering="crispEdges" />
            <text x={x1 + 2} y={y + ROW_H / 2 + 3}
              fill={sig.format === 'ascii' ? C.asciiText : C.busText}
              fontSize={fs} fontFamily="'Courier New',Courier,monospace"
              style={{ pointerEvents: 'none' }}>
              {display}
            </text>
          </g>,
        );
      }
      segStart = c;
      if (c < samples.length) prevVal = val as number | string;
    }
  }
  return els;
}

function SignalWaveRow({
  sig, samples, cellW, yOffset,
}: {
  sig: WaveSignal;
  samples: WaveSample[];
  cellW: number;
  yOffset: number;
}) {
  const yHi = yOffset + 4;
  const yLo = yOffset + ROW_H - 5;
  const waveW = samples.length * cellW;

  const waves = sig.format === 'wire'
    ? drawDigitalWire(samples, sig, cellW, yHi, yLo)
    : drawBus(samples, sig, cellW, yOffset);

  return (
    <g>
      {waves}
      <line x1={0} y1={yOffset + ROW_H - 0.5} x2={waveW} y2={yOffset + ROW_H - 0.5}
        stroke={C.rowLine} strokeWidth={0.5} />
    </g>
  );
}

export type GtkWaveToolbarProps = {
  onExecute?: () => void;
  onFullTrace?: () => void;
  onStep?: () => void;
  onReset?: () => void;
  executeDisabled?: boolean;
  stepDisabled?: boolean;
  cycle: number;
  ipc: number;
  retired: number;
  pass?: boolean | null;
  done?: boolean;
};

type Props = {
  samples: WaveSample[];
  currentCycle: number;
  toolbar?: GtkWaveToolbarProps;
  className?: string;
};

export function GtkWaveViewer({ samples, currentCycle, toolbar, className }: Props) {
  const [cellW, setCellW] = useState(48);
  const scrollRef = useRef<HTMLDivElement>(null);
  const totalCycles = Math.max(samples.length, 1);
  const waveW = totalCycles * cellW;
  const cursorIdx = Math.min(Math.max(currentCycle, 0), samples.length - 1);
  const cursorSample = samples[cursorIdx];

  const totalH = RULER_H + GROUPS.length * GROUP_H + WAVE_SIGNALS.length * ROW_H;

  const rowLayout = useMemo(() => {
    let y = RULER_H;
    const rows: { sig: WaveSignal; y: number; group: string }[] = [];
    for (const group of GROUPS) {
      y += GROUP_H;
      for (const sig of WAVE_SIGNALS.filter((s) => s.group === group)) {
        rows.push({ sig, y, group });
        y += ROW_H;
      }
    }
    return rows;
  }, []);

  const scrollToCursor = useCallback(() => {
    const el = scrollRef.current;
    if (!el || currentCycle <= 0) return;
    const target = currentCycle * cellW - el.clientWidth * 0.35 + NAME_W + VALUE_W;
    el.scrollLeft = Math.max(0, target);
  }, [currentCycle, cellW]);

  useEffect(() => { scrollToCursor(); }, [scrollToCursor]);

  const zoomIn = () => setCellW((w) => Math.min(120, w + 8));
  const zoomOut = () => setCellW((w) => Math.max(24, w - 8));
  const zoomFit = () => {
    const el = scrollRef.current;
    if (!el || samples.length < 2) { setCellW(48); return; }
    const avail = el.clientWidth - NAME_W - VALUE_W - 16;
    setCellW(Math.max(24, Math.min(120, Math.floor(avail / samples.length))));
  };

  if (samples.length === 0) {
    return (
      <div className={`flex flex-col border border-[#808080] ${className ?? ''}`} style={{ background: C.window }}>
        <div className="flex items-center px-2 text-[11px] font-sans" style={{ height: TOOLBAR_H, background: C.toolbar, borderBottom: `1px solid ${C.toolbarBorder}` }}>
          <span className="font-bold text-black">GTKWave</span>
          <span className="ml-2 text-gray-600">tb_riscv_core.vcd</span>
        </div>
        <div className="flex items-center justify-center font-mono text-sm text-[#00ff00]" style={{ height: 200, background: C.waveBg }}>
          [ waiting for simulation — press Full Trace ]
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col select-none ${className ?? ''}`}
      style={{ background: C.window, border: `1px solid ${C.toolbarBorder}`, fontFamily: 'Tahoma,Verdana,sans-serif' }}>

      {/* GTK2-style toolbar */}
      <div className="flex items-center gap-0 shrink-0 text-[11px]"
        style={{ height: TOOLBAR_H, background: C.toolbar, borderBottom: `1px solid ${C.toolbarBorder}` }}>
        <span className="px-2 font-bold text-black border-r border-[#808080] h-full flex items-center">GTKWave</span>
        <span className="px-2 text-gray-700 border-r border-[#a0a0a0] h-full flex items-center font-mono text-[10px]">
          tb_riscv_core.vcd
        </span>

        {toolbar && (
          <>
            <button type="button" onClick={toolbar.onExecute} disabled={toolbar.executeDisabled}
              className="px-2 h-full border-r border-[#a0a0a0] hover:bg-[#d8d4cc] disabled:opacity-40 text-black">
              ▶ Execute
            </button>
            <button type="button" onClick={toolbar.onFullTrace}
              className="px-2 h-full border-r border-[#a0a0a0] hover:bg-[#d8d4cc] text-black">
              Full Trace
            </button>
            <button type="button" onClick={toolbar.onStep} disabled={toolbar.stepDisabled}
              className="px-2 h-full border-r border-[#a0a0a0] hover:bg-[#d8d4cc] disabled:opacity-40 text-black">
              Step
            </button>
            <button type="button" onClick={toolbar.onReset}
              className="px-2 h-full border-r border-[#a0a0a0] hover:bg-[#d8d4cc] text-black">
              Reset
            </button>
          </>
        )}

        <div className="ml-auto flex items-center h-full">
          <button type="button" onClick={zoomOut} title="Zoom out"
            className="px-2 h-full border-l border-[#a0a0a0] hover:bg-[#d8d4cc] text-black font-bold">−</button>
          <button type="button" onClick={zoomFit} title="Zoom fit"
            className="px-2 h-full border-l border-[#a0a0a0] hover:bg-[#d8d4cc] text-black text-[10px]">Fit</button>
          <button type="button" onClick={zoomIn} title="Zoom in"
            className="px-2 h-full border-l border-[#a0a0a0] hover:bg-[#d8d4cc] text-black font-bold">+</button>
        </div>
      </div>

      {/* Single unified scroll region — fixes double scrollbar */}
      <div
        ref={scrollRef}
        className="overflow-auto"
        style={{ height: 'calc(72vh - 50px)', minHeight: 320, maxHeight: 640, background: C.waveBg }}
      >
        <div className="flex" style={{ width: NAME_W + VALUE_W + waveW, minHeight: totalH }}>

          {/* Sticky name + value columns */}
          <div className="sticky left-0 z-10 shrink-0 flex border-r border-[#404040]"
            style={{ width: NAME_W + VALUE_W, background: C.nameBg }}>

            {/* Signal names */}
            <div style={{ width: NAME_W }}>
              <div style={{ height: RULER_H, background: C.rulerBg }}
                className="border-b border-[#404040] flex items-end px-1.5 pb-0.5">
                <span className="text-[9px] font-mono" style={{ color: C.rulerFg }}>Signals</span>
              </div>
              {GROUPS.map((group) => {
                const sigs = WAVE_SIGNALS.filter((s) => s.group === group);
                return (
                  <div key={group}>
                    <div style={{ height: GROUP_H, background: C.groupBg }}
                      className="border-b border-[#333] flex items-center px-1.5">
                      <span className="text-[9px] font-mono truncate" style={{ color: C.groupFg }}>{group}</span>
                    </div>
                    {sigs.map((sig) => (
                      <div key={sig.key} style={{ height: ROW_H }}
                        className="flex items-center px-1.5 border-b border-[#2a2a2a]">
                        <span className="text-[10px] font-mono truncate" style={{ color: C.nameFg }} title={sig.label}>
                          {sig.label}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            {/* Value @ cursor column (GTKWave marker values) */}
            <div style={{ width: VALUE_W, background: C.nameBg }} className="border-l border-[#333]">
              <div style={{ height: RULER_H, background: C.rulerBg }}
                className="border-b border-[#404040] flex items-end justify-end px-1 pb-0.5">
                <span className="text-[9px] font-mono" style={{ color: C.rulerFg }}>Value</span>
              </div>
              {GROUPS.map((group) => {
                const sigs = WAVE_SIGNALS.filter((s) => s.group === group);
                return (
                  <div key={group}>
                    <div style={{ height: GROUP_H, background: C.groupBg }} className="border-b border-[#333]" />
                    {sigs.map((sig) => {
                      const v = cursorSample ? sampleVal(cursorSample, sig) : 0;
                      return (
                        <div key={sig.key} style={{ height: ROW_H }}
                          className="flex items-center justify-end px-1 border-b border-[#2a2a2a]">
                          <span className="text-[9px] font-mono truncate" style={{ color: C.valueFg }}>
                            {formatCursorValue(sig, v)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Waveform canvas */}
          <svg width={waveW} height={totalH} style={{ background: C.waveBg, display: 'block' }}>
            {/* Time ruler */}
            <rect x={0} y={0} width={waveW} height={RULER_H} fill={C.rulerBg} />
            {Array.from({ length: totalCycles + 1 }).map((_, c) => (
              <g key={c}>
                <line x1={c * cellW} y1={0} x2={c * cellW} y2={totalH}
                  stroke={c % 5 === 0 ? C.gridMajor : C.grid}
                  strokeWidth={c % 5 === 0 ? 1 : 0.5} />
                <text x={c * cellW + 2} y={13} fill={C.rulerFg} fontSize={9}
                  fontFamily="'Courier New',monospace">{c}</text>
              </g>
            ))}
            <line x1={0} y1={RULER_H - 0.5} x2={waveW} y2={RULER_H - 0.5} stroke="#404040" strokeWidth={1} />

            {/* Cursor */}
            {currentCycle > 0 && (
              <>
                <line x1={currentCycle * cellW} y1={0} x2={currentCycle * cellW} y2={totalH}
                  stroke={C.cursor} strokeWidth={1} shapeRendering="crispEdges" />
                <polygon
                  points={`${currentCycle * cellW - 4},0 ${currentCycle * cellW + 4},0 ${currentCycle * cellW},6`}
                  fill={C.cursor}
                />
              </>
            )}

            {rowLayout.map(({ sig, y }) => (
              <SignalWaveRow key={sig.key} sig={sig} samples={samples} cellW={cellW} yOffset={y} />
            ))}
          </svg>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-3 px-2 shrink-0 font-mono text-[10px] border-t border-[#808080]"
        style={{ height: STATUS_H, background: C.statusBg, color: C.statusFg }}>
        <span>Marker: <strong>{currentCycle}</strong> ps</span>
        <span>|</span>
        <span>cycles={samples.length - 1}</span>
        <span>|</span>
        <span>signals={WAVE_SIGNALS.length}</span>
        {toolbar && (
          <>
            <span>|</span>
            <span>IPC={toolbar.ipc}</span>
            <span>retired={toolbar.retired}</span>
          </>
        )}
        {toolbar?.done && toolbar.pass !== null && toolbar.pass !== undefined && (
          <span className={`ml-auto font-bold ${toolbar.pass ? 'text-green-700' : 'text-red-700'}`}>
            {toolbar.pass ? '[PASS] tb_riscv_core.v' : '[FAIL] tb_riscv_core.v'}
          </span>
        )}
      </div>
    </div>
  );
}
