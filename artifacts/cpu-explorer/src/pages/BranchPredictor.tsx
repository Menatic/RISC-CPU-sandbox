import { useState, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar, ResponsiveContainer } from 'recharts';
import { createPredictor, PredictorType } from '../engine/branchPredictor';
import { Play, RotateCcw, TrendingUp, Target, Zap } from 'lucide-react';

const PREDICTORS: { id: PredictorType; label: string; description: string }[] = [
  { id: 'static_not_taken', label: 'Always Not Taken', description: 'Statically predict branch as not taken. Simple, zero hardware cost.' },
  { id: 'static_taken', label: 'Always Taken', description: 'Statically predict branch as taken. Works well for loops (backward branches).' },
  { id: 'one_bit', label: '1-Bit Predictor', description: 'Single bit: last outcome. Flips prediction on misprediction. Fast but inaccurate at loop boundaries.' },
  { id: 'two_bit_saturating', label: '2-Bit Saturating Counter', description: '4-state FSM: Strongly/Weakly Taken/Not-Taken. Handles loop boundary mispredictions better.' },
  { id: 'gshare', label: 'GShare Predictor', description: 'Global history XORed with PC to index pattern history table. Captures correlated branch behavior.' },
  { id: 'tournament', label: 'Tournament Predictor', description: 'Meta-predictor that chooses between local and global predictors per branch. Used in Alpha 21264.' },
];

const BRANCH_PATTERNS = [
  { id: 'loop', label: 'Loop (10 iterations)', description: 'TTTTTTTTTF — a simple counted loop', sequence: Array.from({length: 20}, (_, i) => i < 9 ? true : (i === 9 ? false : (i < 19 ? true : false))) },
  { id: 'alternating', label: 'Alternating', description: 'TFTFTFTFTF — every other branch taken', sequence: Array.from({length: 20}, (_, i) => i % 2 === 0) },
  { id: 'mostly_taken', label: 'Mostly Taken (80%)', description: 'Realistic branch mixture biased toward taken', sequence: Array.from({length: 20}, (_, i) => [0,2,4,6,8,10,12,14,16,18,1,3,5,7,9,11,13,15,19].includes(i) ) },
  { id: 'random', label: 'Random (50%)', description: 'Unpredictable branch pattern', sequence: [true,false,true,true,false,false,true,false,true,false,false,true,false,true,false,true,true,false,false,true] },
  { id: 'nested_loop', label: 'Nested Loop', description: 'TTF TTF TTF — inner loop with 3 iterations', sequence: Array.from({length: 21}, (_, i) => i % 3 !== 2) },
];

type SimResult = {
  predictor: string;
  accuracy: number;
  correct: number;
  wrong: number;
  perCycle: { cycle: number; correct: boolean; prediction: boolean; actual: boolean }[];
};

export default function BranchPredictor() {
  const [selectedPredictors, setSelectedPredictors] = useState<PredictorType[]>(['two_bit_saturating', 'gshare']);
  const [selectedPattern, setSelectedPattern] = useState('loop');
  const [results, setResults] = useState<SimResult[]>([]);
  const [ran, setRan] = useState(false);

  const togglePredictor = (id: PredictorType) => {
    setSelectedPredictors(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const runSimulation = useCallback(() => {
    const pattern = BRANCH_PATTERNS.find(p => p.id === selectedPattern)!;
    const newResults: SimResult[] = [];

    for (const predType of selectedPredictors) {
      const predictor = createPredictor(predType);
      const perCycle: SimResult['perCycle'] = [];
      let correct = 0;

      for (let i = 0; i < pattern.sequence.length; i++) {
        const pc = 0x1000 + i * 4;
        const prediction = predictor.predict(pc);
        const actual = pattern.sequence[i];
        const isCorrect = prediction === actual;
        if (isCorrect) correct++;
        predictor.update(pc, actual);
        perCycle.push({ cycle: i + 1, correct: isCorrect, prediction, actual });
      }

      newResults.push({
        predictor: PREDICTORS.find(p => p.id === predType)!.label,
        accuracy: Math.round((correct / pattern.sequence.length) * 100),
        correct,
        wrong: pattern.sequence.length - correct,
        perCycle,
      });
    }

    setResults(newResults);
    setRan(true);
  }, [selectedPredictors, selectedPattern]);

  const reset = () => { setResults([]); setRan(false); };

  const chartData = results.length > 0
    ? results[0].perCycle.map((_, i) => {
        const pt: Record<string, number | string> = { cycle: i + 1 };
        results.forEach(r => { pt[r.predictor] = r.perCycle[i].correct ? 1 : 0; });
        return pt;
      })
    : [];

  const barData = results.map(r => ({
    name: r.predictor.replace(' Predictor', '').replace(' Counter', '').replace(' Saturating', ''),
    accuracy: r.accuracy,
    correct: r.correct,
    wrong: r.wrong,
  }));

  const COLORS = ['#06b6d4', '#f59e0b', '#10b981', '#f43f5e', '#8b5cf6', '#64748b'];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-1">Branch Predictor Lab</h1>
        <p className="text-muted-foreground">Compare prediction algorithms across realistic branch patterns. See why 2-bit predictors became the industry standard in the 1990s.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Predictor Selection */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-4">
          <h2 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">Select Predictors</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PREDICTORS.map((p, i) => (
              <button
                key={p.id}
                onClick={() => togglePredictor(p.id)}
                data-testid={`predictor-${p.id}`}
                className={`text-left p-3 rounded-lg border transition-all ${
                  selectedPredictors.includes(p.id)
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border bg-background hover:border-primary/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                  <span className="font-medium text-sm">{p.label}</span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Pattern Selection */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">Branch Pattern</h2>
          <div className="space-y-2">
            {BRANCH_PATTERNS.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedPattern(p.id)}
                data-testid={`pattern-${p.id}`}
                className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                  selectedPattern === p.id
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                <div className="font-medium text-sm">{p.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{p.description}</div>
              </button>
            ))}
          </div>

          <div className="flex gap-2 mt-4">
            <button onClick={runSimulation} disabled={selectedPredictors.length === 0}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm disabled:opacity-50 hover:bg-primary/90 transition-colors"
              data-testid="button-run-simulation">
              <Play className="w-4 h-4" /> Simulate
            </button>
            <button onClick={reset}
              className="px-3 py-2 border border-border rounded-lg hover:bg-muted transition-colors"
              data-testid="button-reset">
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {ran && results.length > 0 && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {results.map((r, i) => (
              <div key={r.predictor} className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                  <span className="text-xs text-muted-foreground truncate">{r.predictor}</span>
                </div>
                <div className="text-3xl font-bold" style={{ color: COLORS[i] }}>{r.accuracy}%</div>
                <div className="text-xs text-muted-foreground mt-1">{r.correct} correct / {r.wrong} wrong</div>
                <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${r.accuracy}%`, backgroundColor: COLORS[i] }} />
                </div>
              </div>
            ))}
          </div>

          {/* Accuracy comparison bar chart */}
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Accuracy Comparison</h3>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(val: number) => [`${val}%`, 'Accuracy']} />
                <Bar dataKey="accuracy" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Per-cycle accuracy timeline */}
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Per-Cycle Prediction Outcome</h3>
              <span className="text-xs text-muted-foreground ml-2">(1 = correct, 0 = miss)</span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="cycle" tick={{ fontSize: 11 }} label={{ value: 'Branch #', position: 'insideBottom', offset: -2 }} />
                <YAxis domain={[0, 1]} ticks={[0, 1]} tickFormatter={v => v === 1 ? 'Hit' : 'Miss'} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                {results.map((r, i) => (
                  <Line key={r.predictor} type="stepAfter" dataKey={r.predictor} stroke={COLORS[i]} dot={false} strokeWidth={2} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Cycle-by-cycle table for first predictor */}
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Detailed Trace — {results[0].predictor}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-mono">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left pb-2 pr-4">Branch #</th>
                    <th className="text-left pb-2 pr-4">Predicted</th>
                    <th className="text-left pb-2 pr-4">Actual</th>
                    <th className="text-left pb-2">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {results[0].perCycle.map((row, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-1.5 pr-4 text-muted-foreground">{row.cycle}</td>
                      <td className="py-1.5 pr-4">{row.prediction ? <span className="text-green-400">Taken</span> : <span className="text-muted-foreground">Not Taken</span>}</td>
                      <td className="py-1.5 pr-4">{row.actual ? <span className="text-green-400">Taken</span> : <span className="text-muted-foreground">Not Taken</span>}</td>
                      <td className="py-1.5">{row.correct
                        ? <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">HIT</span>
                        : <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs">MISS</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!ran && (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium mb-2">Select predictors and a branch pattern, then run the simulation</p>
          <p className="text-muted-foreground text-sm">Compare how different algorithms handle loops, alternating branches, and random patterns</p>
        </div>
      )}
    </div>
  );
}
