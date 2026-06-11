import React from 'react';
import { useSimulatorStore } from '../store/simulatorStore';
import { Activity, GitBranch } from 'lucide-react';

export default function Pipeline() {
  const { pipelineStages, currentCycle } = useSimulatorStore();

  const stages = [
    { id: 'IF', name: 'Instruction Fetch', color: 'bg-blue-900/40 border-blue-500' },
    { id: 'ID', name: 'Instruction Decode', color: 'bg-purple-900/40 border-purple-500' },
    { id: 'EX', name: 'Execute', color: 'bg-pink-900/40 border-pink-500' },
    { id: 'MEM', name: 'Memory Access', color: 'bg-emerald-900/40 border-emerald-500' },
    { id: 'WB', name: 'Write Back', color: 'bg-amber-900/40 border-amber-500' },
  ];

  return (
    <div className="p-8">
      <div className="flex items-center gap-4 mb-8">
        <Activity className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold">5-Stage Pipeline</h1>
      </div>
      
      <div className="flex justify-between items-center mb-8 bg-card p-4 rounded-xl border border-border">
        <div className="text-lg">Cycle: <span className="font-mono text-cyan-400 text-2xl">{currentCycle}</span></div>
        <div className="text-lg">CPI: <span className="font-mono text-emerald-400 text-2xl">1.0</span></div>
        <div className="text-lg">Stalls: <span className="font-mono text-amber-400 text-2xl">0</span></div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {stages.map((stage) => (
          <div key={stage.id} className={`p-6 rounded-xl border-2 flex flex-col h-64 relative ${stage.color}`}>
            <div className="text-sm font-bold uppercase tracking-wider mb-4 opacity-70">{stage.name}</div>
            <div className="flex-1 flex items-center justify-center">
              {pipelineStages[stage.id as keyof typeof pipelineStages] ? (
                <div className="text-xl font-mono p-3 bg-black/50 rounded shadow-inner">
                  {pipelineStages[stage.id as keyof typeof pipelineStages]?.instruction.mnemonic}
                </div>
              ) : (
                <div className="text-muted-foreground italic">Idle</div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-12 p-6 bg-card border border-border rounded-xl">
        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2"><GitBranch className="w-5 h-5" /> Pipeline History</h3>
        <p className="text-muted-foreground">Run a program in the IDE to see the pipeline visualization populate here.</p>
      </div>
    </div>
  );
}
