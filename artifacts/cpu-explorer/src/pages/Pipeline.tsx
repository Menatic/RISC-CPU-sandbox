import React, { useState } from 'react';
import { useSimulatorStore, type StageId, type PipelineSlot, type PipelineHistoryEntry } from '../store/simulatorStore';
import { abiName } from '../engine/riscv';
import {
  Activity, Zap, AlertTriangle, ArrowRight, ChevronRight, Info,
  Play, StepForward, RotateCcw, BarChart3, GitBranch
} from 'lucide-react';
import { Link } from 'wouter';

const STAGE_META: { id: StageId; label: string; longName: string; color: string; border: string; description: string }[] = [
  { id: 'IF',  label: 'IF',  longName: 'Instruction Fetch',  color: 'bg-blue-900/30',   border: 'border-blue-500',   description: 'Reads the next instruction from instruction memory at the current PC. PC is updated to PC+4 (or branch target).' },
  { id: 'ID',  label: 'ID',  longName: 'Instruction Decode', color: 'bg-purple-900/30', border: 'border-purple-500', description: 'Decodes the 32-bit encoding. Reads source register values from the Register File. Detects potential hazards.' },
  { id: 'EX',  label: 'EX',  longName: 'Execute',            color: 'bg-pink-900/30',   border: 'border-pink-500',   description: 'ALU computes the result. For branches, evaluates condition and determines target. Forwarding paths connect here.' },
  { id: 'MEM', label: 'MEM', longName: 'Memory Access',      color: 'bg-emerald-900/30',border: 'border-emerald-500',description: 'Reads from or writes to data memory (for LW/SW). Other instructions pass through unchanged.' },
  { id: 'WB',  label: 'WB',  longName: 'Write Back',         color: 'bg-amber-900/30',  border: 'border-amber-500',  description: 'Writes the result (ALU or loaded memory value) to the destination register. This is when registers are updated.' },
];

const INSTR_TYPE_COLORS: Record<string, string> = {
  R: 'text-violet-300 border-violet-500/50',
  I: 'text-blue-300 border-blue-500/50',
  S: 'text-orange-300 border-orange-500/50',
  B: 'text-red-300 border-red-500/50',
  U: 'text-cyan-300 border-cyan-500/50',
  J: 'text-pink-300 border-pink-500/50',
};

function hexPad(n: number) { return '0x' + (n >>> 0).toString(16).toUpperCase().padStart(8, '0'); }

function StageBox({ meta, slot }: { meta: typeof STAGE_META[0]; slot: PipelineSlot | null }) {
  const [showTip, setShowTip] = useState(false);
  const isStall  = slot?.stall  ?? false;
  const isFlush  = slot?.flush  ?? false;
  const hasInstr = slot !== null && !isFlush;

  return (
    <div className="relative flex-1">
      <div
        className={`rounded-xl border-2 p-4 flex flex-col min-h-[200px] transition-all duration-300 ${
          isFlush ? 'border-red-500 bg-red-900/20 opacity-80' :
          isStall ? 'border-amber-500 bg-amber-900/20' :
          hasInstr ? `${meta.border} ${meta.color}` :
          'border-border bg-card/20 opacity-50'
        }`}
      >
        {/* Stage header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-lg font-bold tracking-wider">{meta.label}</div>
            <div className="text-[10px] text-muted-foreground">{meta.longName}</div>
          </div>
          <button
            onClick={() => setShowTip(!showTip)}
            className="p-1 rounded hover:bg-white/10 transition-colors"
          >
            <Info className="w-4 h-4 text-muted-foreground hover:text-foreground" />
          </button>
        </div>

        {/* Tooltip */}
        {showTip && (
          <div className="absolute top-12 right-0 z-20 w-72 p-3 rounded-lg border border-border bg-popover shadow-xl text-xs text-muted-foreground leading-relaxed">
            {meta.description}
          </div>
        )}

        {/* Instruction display */}
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          {isFlush ? (
            <div className="text-center">
              <div className="text-red-400 font-bold text-sm mb-1">FLUSHED</div>
              <div className="text-xs text-red-300/70">Branch/Jump resolved</div>
              <div className="text-[10px] text-muted-foreground mt-1">Bubble inserted</div>
            </div>
          ) : isStall ? (
            <div className="text-center">
              <div className="text-amber-400 font-bold text-sm mb-1">STALLED</div>
              <div className="text-[10px] text-muted-foreground">Load-Use hazard</div>
              {slot?.instr && (
                <div className="mt-1 font-mono text-xs text-foreground/60">{slot.instr.mnemonic}</div>
              )}
            </div>
          ) : hasInstr ? (
            <div className="w-full text-center">
              <div className="font-mono text-xl font-bold text-foreground mb-1">{slot!.instr.mnemonic}</div>
              <div className="font-mono text-[10px] text-muted-foreground mb-2">{hexPad(slot!.instr.pc)}</div>
              <div className="text-xs text-muted-foreground leading-relaxed truncate px-1" title={slot!.instr.srcText}>
                {slot!.instr.srcText}
              </div>

              {/* Register operands */}
              <div className="mt-3 space-y-1">
                {slot!.instr.writesRd && slot!.instr.rd !== 0 && (
                  <div className="flex items-center justify-center gap-1 text-[10px]">
                    <span className="text-cyan-400 font-mono">→ x{slot!.instr.rd}({abiName(slot!.instr.rd)})</span>
                  </div>
                )}
                {meta.id === 'EX' && slot!.aluResult !== null && (
                  <div className="text-[10px] text-emerald-400 font-mono">ALU = {slot!.aluResult}</div>
                )}
                {meta.id === 'MEM' && slot!.instr.isLoad && slot!.memResult !== null && (
                  <div className="text-[10px] text-emerald-400 font-mono">Loaded = {slot!.memResult}</div>
                )}
                {meta.id === 'WB' && slot!.writebackVal !== null && (
                  <div className="text-[10px] text-emerald-400 font-mono">Written = {slot!.writebackVal}</div>
                )}
              </div>

              {/* Forwarding indicators */}
              {(slot!.forwardA || slot!.forwardB) && (
                <div className="mt-2 flex flex-wrap gap-1 justify-center">
                  {slot!.forwardA && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-900/50 border border-cyan-500/30 text-cyan-300">
                      ⚡ FwdA:{slot!.forwardA}
                    </span>
                  )}
                  {slot!.forwardB && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-900/50 border border-cyan-500/30 text-cyan-300">
                      ⚡ FwdB:{slot!.forwardB}
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-muted-foreground/40 text-sm italic">Idle</div>
          )}
        </div>

        {/* Hazard badge */}
        {slot?.hazard && (
          <div className="mt-2 text-[10px] px-2 py-1 rounded bg-amber-900/50 border border-amber-500/40 text-amber-300 text-center">
            {slot.hazard === 'LOAD_USE' ? 'Load-Use Stall' : slot.hazard}
          </div>
        )}

        {/* Branch indicator */}
        {meta.id === 'EX' && slot !== null && slot.branchTaken !== null && (
          <div className={`mt-2 text-[10px] px-2 py-1 rounded border text-center ${
            slot.branchTaken
              ? 'bg-red-900/50 border-red-500/40 text-red-300'
              : 'bg-emerald-900/50 border-emerald-500/40 text-emerald-300'
          }`}>
            Branch {slot.branchTaken ? `TAKEN → ${hexPad(slot.branchTarget ?? 0)}` : 'not taken'}
          </div>
        )}
      </div>
    </div>
  );
}

// Forwarding arrows between stages (shown as SVG overlay)
function ForwardingArrows({ stages }: { stages: typeof STAGE_META; slots: Record<StageId, PipelineSlot | null> }) {
  const s = stages;
  return null; // Placeholder — complex SVG arrows; shown as text badges on slots instead
}

// Gantt chart row
function GanttRow({ entry, allInstrs }: { entry: PipelineHistoryEntry; allInstrs: { pc: number; mnemonic: string }[] }) {
  return (
    <div className="flex items-center gap-2 text-[10px] font-mono py-0.5">
      <span className="text-muted-foreground w-10 text-right flex-shrink-0">C{entry.cycle}</span>
      <div className="flex gap-1 flex-wrap">
        {(['WB','MEM','EX','ID','IF'] as StageId[]).map(stage => {
          const slot = entry.stages[stage];
          return slot ? (
            <span key={stage} className={`px-1.5 py-0.5 rounded border text-[9px] ${
              slot.flush ? 'border-red-500/40 bg-red-900/20 text-red-400' :
              slot.stall ? 'border-amber-500/40 bg-amber-900/20 text-amber-400' :
              stage === 'WB' ? 'border-amber-400/40 bg-amber-900/20 text-amber-300' :
              stage === 'MEM'? 'border-emerald-400/40 bg-emerald-900/20 text-emerald-300' :
              stage === 'EX' ? 'border-pink-400/40 bg-pink-900/20 text-pink-300' :
              stage === 'ID' ? 'border-purple-400/40 bg-purple-900/20 text-purple-300' :
              'border-blue-400/40 bg-blue-900/20 text-blue-300'
            }`} title={slot.instr.srcText}>
              {stage}:{slot.flush ? '✗' : slot.stall ? '⏸' : slot.instr.mnemonic.slice(0,4)}
            </span>
          ) : null;
        })}
        {entry.stalls > 0 && <span className="text-amber-400 text-[9px]">+{entry.stalls} stall</span>}
        {entry.flushes > 0 && <span className="text-red-400 text-[9px]">+{entry.flushes} flush</span>}
      </div>
    </div>
  );
}

// Detailed Gantt chart (instruction × cycle grid)
function DetailedGantt({ history, program }: { history: PipelineHistoryEntry[]; program: { pc: number; mnemonic: string; srcText: string }[] }) {
  if (history.length === 0 || program.length === 0) return null;

  const stageColor: Record<StageId, string> = {
    IF: 'bg-blue-700',
    ID: 'bg-purple-700',
    EX: 'bg-pink-700',
    MEM: 'bg-emerald-700',
    WB: 'bg-amber-700',
  };

  // Build grid: program[i] × cycle
  type Cell = { stage: StageId; stall: boolean; flush: boolean } | null;
  const grid: Record<number, Record<number, Cell>> = {}; // grid[instrPC][cycle]

  for (const entry of history) {
    for (const stageId of ['IF','ID','EX','MEM','WB'] as StageId[]) {
      const slot = entry.stages[stageId];
      if (slot) {
        const ipc = slot.instr.pc;
        if (!grid[ipc]) grid[ipc] = {};
        grid[ipc][entry.cycle] = { stage: stageId, stall: slot.stall, flush: slot.flush };
      }
    }
  }

  const cycles = history.map(h => h.cycle);
  const minCycle = Math.min(...cycles);
  const maxCycle = Math.max(...cycles);
  const visProgram = program.slice(0, 12); // show first 12 instructions

  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-0 text-[10px] font-mono">
        <thead>
          <tr>
            <th className="text-left px-2 py-1 text-muted-foreground font-normal min-w-[140px]">Instruction</th>
            {Array.from({ length: maxCycle - minCycle + 1 }, (_, i) => minCycle + i).map(cycle => (
              <th key={cycle} className="px-1 py-1 text-center text-muted-foreground font-normal w-10">C{cycle}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visProgram.map((instr, ri) => (
            <tr key={instr.pc} className={ri % 2 === 0 ? 'bg-card/20' : ''}>
              <td className="px-2 py-0.5 text-muted-foreground border-r border-border truncate max-w-[140px]" title={instr.srcText}>
                <span className="text-foreground/70">{instr.mnemonic}</span>
              </td>
              {Array.from({ length: maxCycle - minCycle + 1 }, (_, i) => minCycle + i).map(cycle => {
                const cell = grid[instr.pc]?.[cycle] ?? null;
                return (
                  <td key={cycle} className="px-0.5 py-0.5 text-center">
                    {cell ? (
                      <div className={`mx-auto w-8 rounded text-[9px] py-0.5 text-center font-bold ${
                        cell.flush ? 'bg-red-800 text-red-200' :
                        cell.stall ? 'bg-amber-800 text-amber-200' :
                        stageColor[cell.stage]
                      } text-white`}>
                        {cell.flush ? '✗' : cell.stall ? '⏸' : cell.stage}
                      </div>
                    ) : (
                      <div className="mx-auto w-8 h-4" />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Pipeline() {
  const {
    pipelineStages, pipelineHistory,
    assembledProgram, executionMode,
    currentCycle, stats, registers,
    lastExplanation, enableForwarding,
    advanceCycle, runToEnd, reset, setForwarding,
  } = useSimulatorStore();

  const [ganttMode, setGanttMode] = useState<'simple' | 'grid'>('grid');
  const [showInfo, setShowInfo] = useState(false);

  const isAssembled = executionMode !== 'idle' && executionMode !== 'error';
  const isComplete  = executionMode === 'complete';
  const canStep     = isAssembled && !isComplete;

  const program = assembledProgram?.instructions ?? [];

  // Detect active hazards
  const hasLoadUse = pipelineStages.ID?.hazard === 'LOAD_USE';
  const hasFlush   = pipelineStages.ID?.flush || pipelineStages.IF?.flush;
  const hasForward = pipelineStages.EX?.forwardA || pipelineStages.EX?.forwardB;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="p-6 space-y-6">

        {/* ======== HEADER ======== */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Activity className="w-7 h-7 text-primary" />
              <h1 className="text-3xl font-bold">5-Stage Pipeline Visualizer</h1>
            </div>
            <p className="text-muted-foreground">
              Cycle-accurate simulation of RISC-V in-order pipeline with hazard detection and data forwarding.
              {!isAssembled && (
                <span className="ml-2 text-primary/80">
                  <Link href="/ide" className="underline hover:text-primary">Go to IDE</Link> and assemble a program first.
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            {isAssembled && (
              <>
                <button onClick={advanceCycle} disabled={!canStep}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded text-sm hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <StepForward className="w-4 h-4" /> +1 Cycle
                </button>
                <button onClick={runToEnd} disabled={!canStep}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <Play className="w-4 h-4" /> Run
                </button>
                <button onClick={reset}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-secondary-foreground rounded text-sm hover:bg-secondary/80 transition-colors">
                  <RotateCcw className="w-4 h-4" /> Reset
                </button>
              </>
            )}
          </div>
        </div>

        {/* ======== STATS BAR ======== */}
        <div className="grid grid-cols-7 gap-3">
          {[
            { label: 'Cycle', value: currentCycle, color: 'text-primary' },
            { label: 'Retired', value: stats.instructionsRetired, color: 'text-emerald-400' },
            { label: 'CPI', value: stats.cpi || '—', color: 'text-amber-400' },
            { label: 'IPC', value: stats.ipc || '—', color: 'text-cyan-400' },
            { label: 'Stalls', value: stats.stalls, color: 'text-red-400' },
            { label: 'Flushes', value: stats.flushes, color: 'text-orange-400' },
            { label: 'Forwarded', value: stats.forwardedOps, color: 'text-violet-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-card border border-border rounded-lg p-3 text-center">
              <div className={`text-xl font-mono font-bold ${color}`}>{value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* ======== PIPELINE STAGES ======== */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Pipeline Stages — Cycle {currentCycle}</h2>
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer hover:text-foreground">
              <input type="checkbox" checked={enableForwarding} onChange={e => setForwarding(e.target.checked)} className="w-3.5 h-3.5 accent-primary" />
              Data Forwarding
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
            </label>
          </div>

          <div className="flex gap-3 items-stretch">
            {STAGE_META.map((meta, si) => (
              <React.Fragment key={meta.id}>
                <StageBox meta={meta} slot={pipelineStages[meta.id]} />
                {si < 4 && (
                  <div className="flex items-center justify-center flex-shrink-0">
                    <div className="flex flex-col items-center">
                      <ArrowRight className={`w-5 h-5 ${
                        // Show forwarding arrow color
                        (meta.id === 'EX' && pipelineStages.MEM?.forwardA) ||
                        (meta.id === 'MEM' && pipelineStages.EX?.forwardA)
                          ? 'text-cyan-400' : 'text-muted-foreground'
                      }`} />
                    </div>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Forwarding paths visualization */}
          {hasForward && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-cyan-500/30 bg-cyan-900/10">
              <Zap className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              <div className="text-sm">
                <span className="text-cyan-400 font-semibold">Data Forwarding Active: </span>
                <span className="text-muted-foreground">
                  {pipelineStages.EX?.forwardA === 'EX_MEM' && 'rs1 forwarded from EX/MEM latch'}
                  {pipelineStages.EX?.forwardA === 'MEM_WB' && 'rs1 forwarded from MEM/WB latch'}
                  {pipelineStages.EX?.forwardB === 'EX_MEM' && ' · rs2 forwarded from EX/MEM latch'}
                  {pipelineStages.EX?.forwardB === 'MEM_WB' && ' · rs2 forwarded from MEM/WB latch'}
                  {' '} — EX stage uses up-to-date values without stalling.
                </span>
              </div>
            </div>
          )}

          {/* Load-Use hazard warning */}
          {hasLoadUse && (
            <div className="flex items-start gap-2 px-4 py-3 rounded-lg border border-amber-500/40 bg-amber-900/10">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <span className="text-amber-400 font-semibold">Load-Use Hazard Detected: </span>
                <span className="text-muted-foreground">
                  A <strong>LW/LH/LB</strong> instruction is in EX, but the very next instruction (in ID) needs its result.
                  Memory data cannot be forwarded because it hasn't been loaded yet — it arrives at the end of MEM stage.
                  The pipeline <strong>inserts 1 bubble cycle</strong> (stall) to wait. This is the one hazard forwarding cannot eliminate.
                </span>
              </div>
            </div>
          )}

          {/* Branch flush warning */}
          {hasFlush && (
            <div className="flex items-start gap-2 px-4 py-3 rounded-lg border border-red-500/40 bg-red-900/10">
              <GitBranch className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <span className="text-red-400 font-semibold">Control Hazard — Pipeline Flush: </span>
                <span className="text-muted-foreground">
                  A branch or jump resolved in EX stage. Since IF and ID fetched the wrong instructions,
                  they are <strong>flushed</strong> (replaced with bubbles). This causes a <strong>2-cycle penalty</strong>.
                  Modern CPUs use branch prediction to guess the outcome and avoid this penalty most of the time.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ======== EXPLANATION BOX ======== */}
        {lastExplanation && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-primary/30 bg-primary/5">
            <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-foreground mb-0.5">What just happened (Cycle {currentCycle}):</div>
              <div className="text-sm text-muted-foreground">{lastExplanation}</div>
            </div>
          </div>
        )}

        {/* ======== REGISTER FILE SNAPSHOT ======== */}
        {isAssembled && (
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Register File (current architectural state)
            </h3>
            <div className="grid grid-cols-8 gap-1.5">
              {registers.map((val, i) => (
                <div key={i} className={`rounded border px-1.5 py-1 text-center text-[10px] font-mono ${
                  val !== 0 ? 'border-primary/30 bg-primary/5' :
                  i === 0 ? 'border-gray-700 bg-transparent opacity-40' :
                  'border-border bg-transparent'
                }`}>
                  <div className="text-muted-foreground/70">{abiName(i)}</div>
                  <div className={val !== 0 ? 'text-primary font-bold' : 'text-muted-foreground/40'}>{val}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ======== GANTT CHART ======== */}
        {pipelineHistory.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Pipeline Timing Diagram (Gantt Chart)
              </h3>
              <div className="flex gap-1">
                <button
                  onClick={() => setGanttMode('grid')}
                  className={`px-2 py-1 text-xs rounded border transition-colors ${ganttMode === 'grid' ? 'border-primary bg-primary/20 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
                >
                  Grid
                </button>
                <button
                  onClick={() => setGanttMode('simple')}
                  className={`px-2 py-1 text-xs rounded border transition-colors ${ganttMode === 'simple' ? 'border-primary bg-primary/20 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
                >
                  Timeline
                </button>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 mb-4 text-[10px]">
              {[
                { color: 'bg-blue-700', label: 'IF — Instruction Fetch' },
                { color: 'bg-purple-700', label: 'ID — Decode' },
                { color: 'bg-pink-700', label: 'EX — Execute' },
                { color: 'bg-emerald-700', label: 'MEM — Memory' },
                { color: 'bg-amber-700', label: 'WB — Write Back' },
                { color: 'bg-amber-800', label: 'Stall' },
                { color: 'bg-red-800', label: 'Flush' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className={`w-3 h-3 rounded ${color}`} />
                  <span className="text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>

            {ganttMode === 'grid' ? (
              <DetailedGantt history={pipelineHistory} program={program} />
            ) : (
              <div className="space-y-0.5 max-h-64 overflow-y-auto">
                {[...pipelineHistory].reverse().slice(0, 40).map((entry, i) => (
                  <GanttRow key={i} entry={entry} allInstrs={program} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ======== HOW THE PIPELINE WORKS ======== */}
        <div className="bg-card border border-border rounded-xl p-6">
          <button
            className="flex items-center gap-2 text-sm font-semibold w-full text-left"
            onClick={() => setShowInfo(!showInfo)}
          >
            <Info className="w-4 h-4 text-primary" />
            How the 5-Stage Pipeline Works
            <ChevronRight className={`w-4 h-4 ml-auto transition-transform ${showInfo ? 'rotate-90' : ''}`} />
          </button>

          {showInfo && (
            <div className="mt-4 space-y-4 text-sm text-muted-foreground">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-foreground font-medium mb-2">The Basic Idea</h4>
                  <p>
                    A pipelined CPU works like a factory assembly line. Instead of one worker doing every job
                    for one car before starting the next, different workers handle different stages simultaneously.
                    While one instruction is being decoded (ID), the previous one is computing in the ALU (EX),
                    and the one before that is accessing memory (MEM).
                  </p>
                </div>
                <div>
                  <h4 className="text-foreground font-medium mb-2">Pipeline Hazards</h4>
                  <p>
                    Problems arise when instructions depend on each other. A <strong className="text-amber-400">Data Hazard (RAW)</strong> occurs
                    when instruction B needs a value that instruction A hasn't computed yet.
                    A <strong className="text-red-400">Control Hazard</strong> occurs at branches — the CPU doesn't know which instruction to fetch next.
                    A <strong className="text-amber-400">Load-Use Hazard</strong> is a special case where memory data
                    arrives too late for forwarding to help.
                  </p>
                </div>
                <div>
                  <h4 className="text-foreground font-medium mb-2">Data Forwarding</h4>
                  <p>
                    Instead of waiting for results to be written to the register file (WB stage), the CPU
                    can "short-circuit" the result directly from one pipeline latch to another.
                    <strong className="text-cyan-400"> EX→EX forwarding</strong> uses the ALU result directly.
                    <strong className="text-cyan-400"> MEM→EX forwarding</strong> uses it after memory access.
                    This eliminates most RAW stalls at no extra cycle cost.
                  </p>
                </div>
                <div>
                  <h4 className="text-foreground font-medium mb-2">CPI and Performance</h4>
                  <p>
                    <strong className="text-emerald-400">CPI (Cycles Per Instruction)</strong> measures pipeline efficiency.
                    An ideal pipeline has CPI = 1.0 (one instruction completes every cycle).
                    Stalls raise CPI above 1. Branch flushes, load-use stalls, and cache misses all contribute.
                    <strong className="text-emerald-400"> IPC (Instructions Per Cycle)</strong> = 1/CPI.
                    Modern CPUs achieve IPC &gt; 1 through superscalar execution (multiple pipelines).
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <h4 className="text-foreground font-medium mb-2">Technical Detail: Pipeline Registers</h4>
                <p className="leading-relaxed">
                  Between each stage, a set of <strong>flip-flops (pipeline registers)</strong> hold the instruction's data
                  as it progresses: <span className="font-mono text-xs text-blue-300">IF/ID</span> →
                  <span className="font-mono text-xs text-purple-300"> ID/EX</span> →
                  <span className="font-mono text-xs text-pink-300"> EX/MEM</span> →
                  <span className="font-mono text-xs text-emerald-300"> MEM/WB</span>.
                  Forwarding multiplexers select between the register file output and these pipeline registers.
                  The forwarding control logic (ForwardA, ForwardB) uses 2-bit signals:
                  <span className="font-mono text-xs"> 00</span> = no forward,
                  <span className="font-mono text-xs"> 10</span> = EX/MEM,
                  <span className="font-mono text-xs"> 01</span> = MEM/WB.
                  A Hazard Detection Unit monitors the ID/EX.RegisterRt field against the EX stage's load destination.
                </p>
              </div>
            </div>
          )}
        </div>

        {!isAssembled && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Activity className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-xl font-semibold text-muted-foreground mb-2">No Program Loaded</h3>
            <p className="text-muted-foreground max-w-md mb-6">
              Write RISC-V assembly in the IDE, click Assemble, then come back here to see the pipeline in action.
            </p>
            <Link href="/ide" className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
              Go to RISC-V IDE <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
