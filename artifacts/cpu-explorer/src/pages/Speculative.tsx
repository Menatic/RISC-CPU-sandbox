import { useState, useCallback } from 'react';
import { Play, RotateCcw, StepForward, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';

type SpecState = 'idle' | 'predicting' | 'executing_speculative' | 'resolving' | 'commit' | 'rollback';

type SpecStep = {
  cycle: number; state: SpecState; description: string;
  instrs: { mnemonic: string; status: 'commit' | 'speculative' | 'flushed' | 'wait' | 'executing' }[];
  highlight: string; isCorrect?: boolean;
};

function buildTrace(predictTaken: boolean): SpecStep[] {
  // Branch at instruction 2, target is instruction 6
  // If prediction is correct: saves 2 cycles. If wrong: flushes + rollback.
  const branchActuallyTaken = true; // hardcoded for demo

  const steps: SpecStep[] = [
    {
      cycle: 1, state: 'idle',
      description: 'Cycle 1: Instruction 1 enters IF. Branch (instruction 2) has not been fetched yet.',
      instrs: [
        { mnemonic: 'ADD x1,x2,x3', status: 'executing' },
        { mnemonic: 'BEQ x1,x0,target', status: 'wait' },
        { mnemonic: 'SUB x4,x5,x6 (fallthrough)', status: 'wait' },
        { mnemonic: 'AND x7,x8,x9 (fallthrough)', status: 'wait' },
        { mnemonic: '...', status: 'wait' },
        { mnemonic: 'ADD x10,x11,x12 (target)', status: 'wait' },
      ],
      highlight: 'Instruction 1 executing normally',
    },
    {
      cycle: 2, state: 'predicting',
      description: `Cycle 2: Branch instruction fetched. Predictor guesses: ${predictTaken ? 'TAKEN' : 'NOT TAKEN'}. Immediately fetching next instructions speculatively.`,
      instrs: [
        { mnemonic: 'ADD x1,x2,x3', status: 'commit' },
        { mnemonic: 'BEQ x1,x0,target', status: 'executing' },
        { mnemonic: predictTaken ? 'ADD x10,x11,x12 (target)' : 'SUB x4,x5,x6 (fallthrough)', status: 'speculative' },
        { mnemonic: predictTaken ? 'MUL x13,x14,x15' : 'AND x7,x8,x9 (fallthrough)', status: 'speculative' },
        { mnemonic: '...', status: 'wait' },
        { mnemonic: predictTaken ? 'SUB x4,x5,x6 (fallthrough)' : 'ADD x10,x11,x12 (target)', status: 'wait' },
      ],
      highlight: `Prediction: ${predictTaken ? 'Taken → fetching from target' : 'Not taken → fetching fallthrough'}`,
    },
    {
      cycle: 3, state: 'executing_speculative',
      description: `Cycle 3: Branch still in EX stage. Speculative instructions are executing but NOT committed — held in ROB pending branch resolution.`,
      instrs: [
        { mnemonic: 'ADD x1,x2,x3', status: 'commit' },
        { mnemonic: 'BEQ x1,x0,target', status: 'executing' },
        { mnemonic: predictTaken ? 'ADD x10,x11,x12' : 'SUB x4,x5,x6', status: 'speculative' },
        { mnemonic: predictTaken ? 'MUL x13,x14,x15' : 'AND x7,x8,x9', status: 'executing' },
        { mnemonic: '...', status: 'speculative' },
        { mnemonic: predictTaken ? 'SUB x4,x5,x6' : 'ADD x10,x11,x12 (target)', status: 'wait' },
      ],
      highlight: 'Speculative instructions in-flight — ROB holds them, not yet committed',
    },
    {
      cycle: 4, state: 'resolving',
      description: `Cycle 4: Branch resolves — actual outcome is TAKEN. Prediction was ${predictTaken ? 'CORRECT' : 'WRONG'}.`,
      instrs: [
        { mnemonic: 'ADD x1,x2,x3', status: 'commit' },
        { mnemonic: 'BEQ x1,x0,target (resolved)', status: 'commit' },
        { mnemonic: predictTaken ? 'ADD x10,x11,x12' : 'SUB x4,x5,x6 [WRONG PATH]', status: predictTaken ? 'speculative' : 'flushed' },
        { mnemonic: predictTaken ? 'MUL x13,x14,x15' : 'AND x7,x8,x9 [WRONG PATH]', status: predictTaken ? 'speculative' : 'flushed' },
        { mnemonic: predictTaken ? '...' : '[FLUSH]', status: predictTaken ? 'speculative' : 'flushed' },
        { mnemonic: predictTaken ? 'SUB x4,x5,x6' : 'ADD x10,x11,x12 (target) [REFETCH]', status: 'wait' },
      ],
      highlight: predictTaken ? 'Prediction correct! Speculative work will commit.' : 'Misprediction! Squashing wrong-path instructions.',
      isCorrect: predictTaken,
    },
    {
      cycle: 5, state: predictTaken ? 'commit' : 'rollback',
      description: predictTaken
        ? 'Cycle 5: Correct prediction! Speculative instructions commit in order. Zero penalty — full pipeline throughput.'
        : 'Cycle 5: Rollback in progress. Architectural state restored to post-branch checkpoint. Fetching correct path from branch target.',
      instrs: predictTaken
        ? [
            { mnemonic: 'ADD x1,x2,x3', status: 'commit' },
            { mnemonic: 'BEQ x1,x0,target', status: 'commit' },
            { mnemonic: 'ADD x10,x11,x12', status: 'commit' },
            { mnemonic: 'MUL x13,x14,x15', status: 'commit' },
            { mnemonic: '...', status: 'executing' },
            { mnemonic: 'Next instruction', status: 'executing' },
          ]
        : [
            { mnemonic: 'ADD x1,x2,x3', status: 'commit' },
            { mnemonic: 'BEQ x1,x0,target', status: 'commit' },
            { mnemonic: '[FLUSHED] SUB x4,x5,x6', status: 'flushed' },
            { mnemonic: '[FLUSHED] AND x7,x8,x9', status: 'flushed' },
            { mnemonic: 'ADD x10,x11,x12 (target)', status: 'executing' },
            { mnemonic: 'Next...', status: 'wait' },
          ],
      highlight: predictTaken ? 'Committed! No wasted cycles.' : `Penalty: 3 flushed cycles. CPI impact: +3/(branch frequency)`,
      isCorrect: predictTaken,
    },
  ];

  return steps;
}

const STATUS_STYLES: Record<string, string> = {
  commit: 'bg-green-500/20 text-green-400 border-green-500/40',
  speculative: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  flushed: 'bg-red-500/20 text-red-400 border-red-500/40 line-through',
  wait: 'bg-muted text-muted-foreground border-border opacity-40',
  executing: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
};

const STATE_LABELS: Record<SpecState, string> = {
  idle: 'Idle', predicting: 'Branch Detected', executing_speculative: 'Executing Speculatively',
  resolving: 'Branch Resolving', commit: 'Committing', rollback: 'Rolling Back',
};

export default function Speculative() {
  const [predictTaken, setPredictTaken] = useState(true);
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);
  const trace = buildTrace(predictTaken);
  const current = trace[step];

  const next = () => { if (step < trace.length - 1) setStep(s => s + 1); };
  const reset = () => { setStep(0); setRunning(false); };

  const stateColor: Record<SpecState, string> = {
    idle: 'text-muted-foreground', predicting: 'text-blue-400',
    executing_speculative: 'text-amber-400', resolving: 'text-orange-400',
    commit: 'text-green-400', rollback: 'text-red-400',
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-1">Speculative Execution Lab</h1>
        <p className="text-muted-foreground">Watch how a processor executes instructions before knowing a branch outcome — and what happens when it guesses wrong.</p>
      </div>

      {/* Controls */}
      <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-4 flex-wrap">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Branch Prediction</label>
          <div className="flex gap-2">
            <button onClick={() => { setPredictTaken(true); reset(); }}
              className={`px-3 py-1.5 rounded border text-sm font-medium transition-all ${predictTaken ? 'border-green-500 bg-green-500/10 text-green-400' : 'border-border text-muted-foreground'}`}
              data-testid="predict-taken">Predict Taken</button>
            <button onClick={() => { setPredictTaken(false); reset(); }}
              className={`px-3 py-1.5 rounded border text-sm font-medium transition-all ${!predictTaken ? 'border-red-500 bg-red-500/10 text-red-400' : 'border-border text-muted-foreground'}`}
              data-testid="predict-not-taken">Predict Not Taken</button>
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={next} disabled={step >= trace.length - 1}
            className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded text-sm font-medium disabled:opacity-50 hover:bg-primary/90"
            data-testid="button-next-step">
            <StepForward className="w-4 h-4" /> Next Cycle
          </button>
          <button onClick={reset} className="px-3 py-2 border border-border rounded hover:bg-muted"><RotateCcw className="w-4 h-4" /></button>
        </div>
        <div className="text-sm font-mono text-muted-foreground">Cycle {current.cycle}/{trace.length}</div>
      </div>

      {/* Current state header */}
      <div className={`bg-card border rounded-lg p-4 flex items-center gap-3 ${current.state === 'rollback' ? 'border-red-500/40' : current.state === 'commit' ? 'border-green-500/40' : 'border-border'}`}>
        {current.state === 'commit' && <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />}
        {current.state === 'rollback' && <RefreshCw className="w-5 h-5 text-red-400 shrink-0 animate-spin" />}
        {current.state === 'predicting' && <AlertTriangle className="w-5 h-5 text-blue-400 shrink-0" />}
        <div>
          <div className={`font-bold ${stateColor[current.state]}`}>{STATE_LABELS[current.state]}</div>
          <p className="text-sm text-muted-foreground mt-0.5">{current.description}</p>
        </div>
      </div>

      {/* Pipeline view */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="font-semibold mb-4">ROB & Pipeline State</h2>
        <div className="space-y-2">
          {current.instrs.map((instr, i) => (
            <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-sm font-mono ${STATUS_STYLES[instr.status]}`}>
              <span className="text-xs opacity-60 w-4">{i+1}</span>
              <span className="flex-1">{instr.mnemonic}</span>
              <span className="text-xs opacity-75 capitalize">{instr.status === 'flushed' ? 'FLUSHED' : instr.status === 'speculative' ? 'SPECULATIVE' : instr.status === 'commit' ? 'COMMITTED' : instr.status === 'executing' ? 'EXECUTING' : 'WAITING'}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 text-sm font-medium" style={{ color: current.isCorrect === true ? '#10b981' : current.isCorrect === false ? '#f43f5e' : 'hsl(var(--muted-foreground))' }}>
          {current.highlight}
        </div>
      </div>

      {/* Performance analysis */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="font-semibold mb-3">Correct Prediction Outcome</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Speculative work wasted</span><span className="text-green-400">0 instructions</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Pipeline flush</span><span className="text-green-400">None</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Branch penalty</span><span className="text-green-400">0 cycles</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Throughput impact</span><span className="text-green-400">Full IPC maintained</span></div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="font-semibold mb-3">Misprediction Penalty</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Speculative work wasted</span><span className="text-red-400">3 instructions flushed</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Pipeline flush</span><span className="text-red-400">Full squash to branch</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Branch penalty</span><span className="text-red-400">3 cycles</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Throughput impact</span><span className="text-red-400">CPI += 3 × miss_rate</span></div>
          </div>
        </div>
      </div>

      {/* Step progress bar */}
      <div className="flex gap-1">
        {trace.map((t, i) => (
          <button key={i} onClick={() => setStep(i)} className={`flex-1 h-2 rounded-full transition-all ${i <= step ? 'bg-primary' : 'bg-muted'}`} data-testid={`step-${i}`} />
        ))}
      </div>
    </div>
  );
}
