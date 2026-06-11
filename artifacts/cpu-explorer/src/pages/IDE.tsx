import React, { useState, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { useSimulatorStore } from '../store/simulatorStore';
import { examplePrograms } from '../data/examplePrograms';
import { abiName, abiPurpose } from '../engine/riscv';
import {
  Play, StepForward, RotateCcw, Cpu, AlertTriangle, CheckCircle2,
  ChevronRight, MemoryStick, Table2, Terminal, ArrowRight, Zap, Info
} from 'lucide-react';
import { Link } from 'wouter';

const CUSTOM_PROGRAM = {
  id: 'custom',
  name: 'Custom Code',
  category: 'Open Sandbox',
  description: 'Write your own RISC-V program here. Paste complex custom code, assemble it, and test it in the simulator.',
  code: `# Custom RISC-V program
# Write or paste your own assembly here, then click Assemble.

ADDI  a0, zero, 5
ADDI  a1, zero, 9
ADD   a2, a0, a1
`,
} as const;

const programOptions = [...examplePrograms, CUSTOM_PROGRAM];

const REG_COLORS = [
  'border-gray-600 bg-gray-900/30',      // x0 zero
  'border-indigo-500/50 bg-indigo-900/20', // x1 ra
  'border-emerald-500/50 bg-emerald-900/20', // x2 sp
  'border-emerald-500/50 bg-emerald-900/20', // x3 gp
  'border-emerald-500/50 bg-emerald-900/20', // x4 tp
];

const INSTR_TYPE_COLORS: Record<string, string> = {
  R: 'bg-violet-900/40 border-violet-500/50 text-violet-300',
  I: 'bg-blue-900/40 border-blue-500/50 text-blue-300',
  S: 'bg-orange-900/40 border-orange-500/50 text-orange-300',
  B: 'bg-red-900/40 border-red-500/50 text-red-300',
  U: 'bg-cyan-900/40 border-cyan-500/50 text-cyan-300',
  J: 'bg-pink-900/40 border-pink-500/50 text-pink-300',
};

const FUNC_UNIT_LABEL: Record<string, string> = {
  ALU: 'ALU', BRANCH: 'Branch', JUMP: 'Jump', LOAD: 'Load', STORE: 'Store', SYSTEM: 'System',
};

type PanelTab = 'registers' | 'binary' | 'memory' | 'trace';

function regGroupColor(i: number): string {
  if (i === 0) return 'bg-gray-800 border-gray-600 text-gray-500';
  if (i === 1) return 'bg-indigo-900/40 border-indigo-500/40 text-indigo-300';
  if (i === 2) return 'bg-emerald-900/40 border-emerald-500/40 text-emerald-200';
  if (i >= 3 && i <= 4) return 'bg-teal-900/40 border-teal-500/40 text-teal-200';
  if (i >= 5 && i <= 7) return 'bg-amber-900/40 border-amber-500/40 text-amber-200';
  if (i === 8 || i === 9) return 'bg-purple-900/40 border-purple-500/40 text-purple-200';
  if (i >= 10 && i <= 17) return 'bg-cyan-900/40 border-cyan-500/40 text-cyan-200';
  if (i >= 18 && i <= 27) return 'bg-purple-900/40 border-purple-500/40 text-purple-200';
  return 'bg-amber-900/40 border-amber-500/40 text-amber-200'; // t3-t6
}

function hexPad(n: number, w = 8) {
  return '0x' + (n >>> 0).toString(16).toUpperCase().padStart(w, '0');
}

export default function IDE() {
  const {
    assemblySource, setSource,
    assembledProgram, assembleErrors,
    registers, memory, pc, fetchPC,
    executionMode, currentCycle,
    pipelineStages, stats,
    executionTrace, lastExplanation,
    lastChangedReg, lastMemAccess,
    assembleProgram, advanceCycle, runToEnd, reset,
    enableForwarding, setForwarding,
  } = useSimulatorStore();

  const [selectedProgram, setSelectedProgram] = useState(examplePrograms[0].id);
  const [customSource, setCustomSource] = useState(CUSTOM_PROGRAM.code);
  const [activeTab, setActiveTab] = useState<PanelTab>('registers');
  const [showHex, setShowHex] = useState(false);
  const [prevRegs, setPrevRegs] = useState<number[]>(new Array(32).fill(0));

  useEffect(() => {
    if (lastChangedReg !== null) {
      const copy = [...registers];
      setPrevRegs(prev => {
        const next = [...prev];
        return next;
      });
    }
  }, [currentCycle]);

  const handleAdvanceCycle = useCallback(() => {
    setPrevRegs([...registers]);
    advanceCycle();
  }, [registers, advanceCycle]);

  const handleRun = useCallback(() => {
    setPrevRegs([...registers]);
    runToEnd();
  }, [registers, runToEnd]);

  const handleReset = useCallback(() => {
    setPrevRegs(new Array(32).fill(0));
    reset();
  }, [reset]);

  const memEntries = Array.from(memory.entries()).sort((a, b) => a[0] - b[0]);
  const currentInstrPC = fetchPC - 4;
  const currentInstr = assembledProgram?.instructions.find(i => i.pc === currentInstrPC) ?? null;

  const stageInstr = {
    IF: pipelineStages.IF?.instr ?? null,
    ID: pipelineStages.ID?.instr ?? null,
    EX: pipelineStages.EX?.instr ?? null,
    MEM: pipelineStages.MEM?.instr ?? null,
    WB: pipelineStages.WB?.instr ?? null,
  };

  const isRunning = executionMode === 'stepping' || executionMode === 'running';
  const isComplete = executionMode === 'complete';
  const isAssembled = executionMode === 'assembled' || executionMode === 'stepping' || executionMode === 'complete';

  const canStep = isAssembled && !isComplete;
  const canRun  = isAssembled && !isComplete;

  const selectedProg = programOptions.find(p => p.id === selectedProgram) ?? CUSTOM_PROGRAM;

  const handleProgramChange = useCallback((nextProgramId: string) => {
    if (selectedProgram === CUSTOM_PROGRAM.id) {
      setCustomSource(assemblySource);
    }

    setSelectedProgram(nextProgramId);

    if (nextProgramId === CUSTOM_PROGRAM.id) {
      setSource(selectedProgram === CUSTOM_PROGRAM.id ? assemblySource : customSource);
      return;
    }

    const nextProgram = examplePrograms.find((program) => program.id === nextProgramId);
    if (nextProgram) {
      setSource(nextProgram.code);
    }
  }, [assemblySource, customSource, selectedProgram, setSource]);

  const handleSourceChange = useCallback((value: string) => {
    setSource(value);
    if (selectedProgram === CUSTOM_PROGRAM.id) {
      setCustomSource(value);
    }
  }, [selectedProgram, setSource]);

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full bg-background text-foreground">
      {/* ======== LEFT: EDITOR PANEL ======== */}
      <div className="flex flex-col w-[54%] border-r border-border min-h-0">

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card/80 backdrop-blur-sm flex-shrink-0 flex-wrap">
          <select
            className="bg-background border border-border rounded px-2 py-1 text-sm text-foreground"
            value={selectedProgram}
            onChange={e => handleProgramChange(e.target.value)}
          >
            {programOptions.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <div className="flex-1" />

          <button
            onClick={assembleProgram}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Cpu className="w-4 h-4" /> Assemble
          </button>
          <button
            onClick={handleAdvanceCycle}
            disabled={!canStep}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded text-sm font-medium hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <StepForward className="w-4 h-4" /> Step Cycle
          </button>
          <button
            onClick={handleRun}
            disabled={!canRun}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Play className="w-4 h-4" /> Run All
          </button>
          <button
            onClick={handleReset}
            disabled={executionMode === 'idle'}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-secondary-foreground rounded text-sm font-medium hover:bg-secondary/80 disabled:opacity-40 transition-colors"
          >
            <RotateCcw className="w-4 h-4" /> Reset
          </button>
        </div>

        {/* Program description */}
        {selectedProg && (
          <div className="px-4 py-2 bg-muted/20 border-b border-border flex-shrink-0">
            <span className="text-xs text-muted-foreground">{selectedProg.description}</span>
            <span className="ml-3 text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary">{selectedProg.category}</span>
          </div>
        )}

        {/* Monaco Editor */}
        <div className="flex-1 min-h-0">
          <Editor
            height="100%"
            defaultLanguage="plaintext"
            theme="vs-dark"
            value={assemblySource}
            onChange={val => handleSourceChange(val ?? '')}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineHeight: 20,
              fontFamily: '"JetBrains Mono", "Fira Code", monospace',
              scrollBeyondLastLine: false,
              renderLineHighlight: 'gutter',
              glyphMargin: false,
              folding: false,
              lineNumbers: 'on',
              wordWrap: 'on',
            }}
          />
        </div>

        {/* Errors / Status bar */}
        <div className="flex-shrink-0 border-t border-border bg-card/60 max-h-32 overflow-y-auto">
          {assembleErrors.length > 0 ? (
            <div className="p-2 space-y-1">
              {assembleErrors.map((err, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <span className="text-amber-300">Line {err.line + 1}: {err.message}</span>
                </div>
              ))}
            </div>
          ) : assembledProgram ? (
            <div className="flex items-center gap-4 px-4 py-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" /> {assembledProgram.instructions.length} instructions</span>
              <span>Cycle: <span className="font-mono text-primary">{currentCycle}</span></span>
              <span>CPI: <span className="font-mono text-amber-400">{stats.cpi || '—'}</span></span>
              <span>IPC: <span className="font-mono text-emerald-400">{stats.ipc || '—'}</span></span>
              <span>Stalls: <span className="font-mono text-red-400">{stats.stalls}</span></span>
              <span>Forwarded: <span className="font-mono text-cyan-400">{stats.forwardedOps}</span></span>
              {isComplete && <span className="text-emerald-400 font-semibold">Execution Complete</span>}
              <Link href="/pipeline" className="ml-auto flex items-center gap-1 text-primary hover:text-primary/80 transition-colors">
                View Pipeline <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            <div className="px-4 py-2 text-xs text-muted-foreground">
              Click <strong>Assemble</strong> to compile your code, then <strong>Step Cycle</strong> or <strong>Run All</strong>
            </div>
          )}
        </div>
      </div>

      {/* ======== RIGHT: STATE PANEL ======== */}
      <div className="flex flex-col w-[46%] min-h-0 bg-background">

        {/* Status bar */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-b border-border bg-card/60 flex-shrink-0 text-sm flex-wrap">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isComplete ? 'bg-emerald-400' : isRunning ? 'bg-amber-400 animate-pulse' : 'bg-gray-500'}`} />
            <span className="text-muted-foreground capitalize">{executionMode}</span>
          </div>
          <div className="font-mono text-xs text-muted-foreground">PC: <span className="text-primary">{hexPad(pc)}</span></div>
          <div className="font-mono text-xs text-muted-foreground">Cycle: <span className="text-amber-400">{currentCycle}</span></div>
          <div className="font-mono text-xs text-muted-foreground">Retired: <span className="text-emerald-400">{stats.instructionsRetired}</span></div>
          <label className="flex items-center gap-1.5 ml-auto cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            <input type="checkbox" checked={enableForwarding} onChange={e => setForwarding(e.target.checked)} className="w-3 h-3 accent-primary" />
            Forwarding
          </label>
        </div>

        {/* Last instruction explanation */}
        {lastExplanation && (
          <div className="px-4 py-2.5 border-b border-border bg-primary/5 flex-shrink-0">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-sm text-foreground/90">{lastExplanation}</p>
            </div>
          </div>
        )}

        {/* Pipeline mini-view */}
        {isAssembled && (
          <div className="px-4 py-2 border-b border-border bg-card/30 flex-shrink-0">
            <div className="flex items-center gap-1.5 text-xs">
              {(['IF','ID','EX','MEM','WB'] as const).map((stage, si) => (
                <React.Fragment key={stage}>
                  <div className={`flex flex-col items-center rounded px-2 py-1 border min-w-[52px] ${
                    pipelineStages[stage]?.flush ? 'border-red-500/50 bg-red-900/20' :
                    pipelineStages[stage]?.stall ? 'border-amber-500/50 bg-amber-900/20' :
                    pipelineStages[stage] ? 'border-primary/40 bg-primary/10' :
                    'border-border bg-transparent opacity-40'
                  }`}>
                    <span className="text-[9px] text-muted-foreground font-bold tracking-wider">{stage}</span>
                    <span className="font-mono text-[10px] text-foreground truncate max-w-[48px]">
                      {pipelineStages[stage]?.flush ? '─' : pipelineStages[stage]?.stall ? '⏸' : pipelineStages[stage]?.instr.mnemonic ?? '·'}
                    </span>
                  </div>
                  {si < 4 && <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                </React.Fragment>
              ))}
              <Link href="/pipeline" className="ml-2 text-[10px] text-primary hover:underline flex items-center gap-1">
                Full view <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-border flex-shrink-0">
          {([['registers','Registers',Table2],['binary','Binary Encoding',Zap],['memory','Memory',MemoryStick],['trace','Trace',Terminal]] as [PanelTab, string, any][]).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                activeTab === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">

          {/* ====== REGISTERS TAB ====== */}
          {activeTab === 'registers' && (
            <div className="p-3">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-muted-foreground">32 integer registers. x0 is always 0. Click hex/dec to toggle display.</p>
                <button
                  onClick={() => setShowHex(!showHex)}
                  className="text-xs px-2 py-1 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80"
                >
                  {showHex ? 'Dec' : 'Hex'}
                </button>
              </div>
              <div className="grid grid-cols-1 gap-1">
                {registers.map((val, i) => {
                  const changed = lastChangedReg === i;
                  const isNonZero = val !== 0;
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-2 rounded border px-2 py-1 text-xs transition-all duration-300 ${
                        changed ? 'border-amber-400 bg-amber-900/30 shadow-sm shadow-amber-500/30' :
                        i === 0 ? 'border-gray-700 bg-gray-900/20 opacity-60' :
                        isNonZero ? 'border-primary/30 bg-primary/5' : 'border-border bg-transparent'
                      }`}
                    >
                      <span className="font-mono text-muted-foreground w-6 text-right flex-shrink-0">x{i}</span>
                      <span className={`font-mono text-[10px] w-12 flex-shrink-0 ${
                        i === 0 ? 'text-gray-600' :
                        i === 1 ? 'text-indigo-400' :
                        i === 2 ? 'text-emerald-400' :
                        i >= 10 && i <= 17 ? 'text-cyan-400' :
                        'text-muted-foreground'
                      }`}>{abiName(i)}</span>
                      <span className="text-[9px] text-muted-foreground/60 flex-1 truncate">{abiPurpose(i)}</span>
                      <span className={`font-mono text-right flex-shrink-0 min-w-[80px] ${changed ? 'text-amber-300 font-bold' : isNonZero ? 'text-foreground' : 'text-muted-foreground/40'}`}>
                        {showHex ? hexPad(val) : val}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ====== BINARY ENCODING TAB ====== */}
          {activeTab === 'binary' && (
            <div className="p-3 space-y-2">
              {!assembledProgram ? (
                <p className="text-sm text-muted-foreground p-4">Assemble the program first to see binary encodings.</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground mb-3">
                    Each instruction is 32 bits. Fields are color-coded by purpose. The current PC instruction is highlighted.
                  </p>
                  {assembledProgram.instructions.map((instr, idx) => {
                    const isCurrent = instr.pc === currentInstrPC && isRunning;
                    const inWB = pipelineStages.WB?.instr.pc === instr.pc;
                    const inEX = pipelineStages.EX?.instr.pc === instr.pc;
                    return (
                      <div key={instr.pc} className={`rounded-lg border p-3 transition-all ${
                        isCurrent ? 'border-primary bg-primary/10' :
                        inWB ? 'border-emerald-500/40 bg-emerald-900/10' :
                        inEX ? 'border-violet-500/40 bg-violet-900/10' :
                        'border-border bg-card/40'
                      }`}>
                        {/* Header row */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] text-muted-foreground">{hexPad(instr.pc)}</span>
                            <span className={`font-mono text-sm font-bold ${isCurrent ? 'text-primary' : 'text-foreground'}`}>
                              {instr.srcText}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${INSTR_TYPE_COLORS[instr.type] ?? ''}`}>
                              {instr.type}-type
                            </span>
                            <span className="text-[10px] text-muted-foreground">{FUNC_UNIT_LABEL[instr.funcUnit]}</span>
                          </div>
                        </div>

                        {/* Full 32-bit binary */}
                        <div className="font-mono text-xs tracking-wider mb-2 flex items-center gap-1 flex-wrap">
                          <span className="text-muted-foreground text-[10px]">Bin:</span>
                          {instr.fields.map((field, fi) => (
                            <span key={fi} className={`px-0.5 rounded ${
                              field.label.startsWith('opcode') ? 'text-amber-300 bg-amber-900/20' :
                              field.label.startsWith('funct') ? 'text-emerald-300 bg-emerald-900/20' :
                              field.label.startsWith('rd') ? 'text-cyan-300 bg-cyan-900/20' :
                              field.label.startsWith('rs') ? 'text-violet-300 bg-violet-900/20' :
                              field.label.startsWith('imm') ? 'text-pink-300 bg-pink-900/20' : 'text-foreground'
                            }`}>{field.bits}</span>
                          ))}
                          <span className="text-muted-foreground text-[10px] ml-2">= {hexPad(instr.raw)}</span>
                        </div>

                        {/* Field breakdown */}
                        <div className="flex flex-wrap gap-2">
                          {instr.fields.map((field, fi) => (
                            <div key={fi} className="text-[10px] rounded bg-muted/30 px-1.5 py-0.5">
                              <span className="text-muted-foreground">{field.label}[{field.hi}:{field.lo}]: </span>
                              <span className="font-mono text-foreground/80">{field.bits}</span>
                              {field.label.startsWith('imm') && <span className="text-pink-300 ml-1">= {field.value}</span>}
                              {(field.label === 'rd' || field.label.startsWith('rs')) && (
                                <span className="text-cyan-300 ml-1">= x{field.value}({abiName(field.value)})</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {/* ====== MEMORY TAB ====== */}
          {activeTab === 'memory' && (
            <div className="p-3">
              <p className="text-xs text-muted-foreground mb-3">
                Data memory — shows only addresses that have been written. RISC-V uses byte addressing; words are 4 bytes aligned.
              </p>
              {lastMemAccess && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded border mb-3 text-xs ${
                  lastMemAccess.isWrite ? 'border-orange-500/40 bg-orange-900/20' : 'border-cyan-500/40 bg-cyan-900/20'
                }`}>
                  <span className={lastMemAccess.isWrite ? 'text-orange-400' : 'text-cyan-400'}>
                    {lastMemAccess.isWrite ? 'STORE' : 'LOAD'}
                  </span>
                  <span className="font-mono">{hexPad(lastMemAccess.address)}</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                  <span className="font-mono">{lastMemAccess.value} ({hexPad(lastMemAccess.value)})</span>
                </div>
              )}
              {memEntries.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  No memory written yet. Run instructions with SW (store word) to see data here.
                </div>
              ) : (
                <div className="font-mono text-xs space-y-1">
                  <div className="grid grid-cols-4 gap-2 text-muted-foreground text-[10px] pb-1 border-b border-border">
                    <span>Address</span><span>Hex Value</span><span>Decimal</span><span>Bytes (MSB→LSB)</span>
                  </div>
                  {memEntries.map(([addr, val]) => (
                    <div key={addr} className={`grid grid-cols-4 gap-2 items-center py-0.5 rounded px-1 ${
                      lastMemAccess?.address === addr * 4 ? 'bg-amber-900/20 border border-amber-500/30' : 'hover:bg-muted/20'
                    }`}>
                      <span className="text-cyan-400">{hexPad(addr * 4)}</span>
                      <span className="text-emerald-400">{hexPad(val)}</span>
                      <span className="text-foreground/80">{val | 0}</span>
                      <span className="text-muted-foreground text-[10px]">
                        {[(val >>> 24) & 0xff, (val >>> 16) & 0xff, (val >>> 8) & 0xff, val & 0xff].map(b => b.toString(16).padStart(2,'0').toUpperCase()).join(' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ====== TRACE TAB ====== */}
          {activeTab === 'trace' && (
            <div className="p-3">
              <p className="text-xs text-muted-foreground mb-3">
                Execution history — each row is a retired instruction (completed WB stage). Ordered by retirement cycle.
              </p>
              {executionTrace.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  No instructions retired yet. Step through or run the program.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {[...executionTrace].reverse().map((entry, i) => (
                    <div key={i} className="rounded border border-border bg-card/40 px-3 py-2">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-[10px] text-muted-foreground font-mono">C{entry.cycle}</span>
                        <span className="text-[10px] font-mono text-muted-foreground">{hexPad(entry.instr.pc)}</span>
                        <span className="font-mono text-sm text-foreground font-semibold">{entry.instr.mnemonic}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${INSTR_TYPE_COLORS[entry.instr.type] ?? ''}`}>{entry.instr.type}</span>
                        {entry.changedReg !== null && (
                          <span className="text-amber-300 text-xs font-mono">
                            → x{entry.changedReg}({abiName(entry.changedReg)}) = {entry.regSnapshot[entry.changedReg]}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{entry.explanation}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
