import React from 'react';
import { Link } from 'wouter';
import { Play, Cpu, Zap, Box, Server, Activity, Shuffle, Hash, GitBranch } from 'lucide-react';
import { useSimulatorStore } from '../store/simulatorStore';

export default function Landing() {
  const { currentCycle } = useSimulatorStore();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-8">
      <div className="max-w-4xl text-center space-y-8">
        <Cpu className="w-24 h-24 text-primary mx-auto" />
        <h1 className="text-5xl font-bold tracking-tight">Modern CPU Explorer</h1>
        <p className="text-xl text-muted-foreground">
          The most advanced browser-based CPU architecture simulator.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12">
          <Link href="/ide" className="group p-6 border rounded-xl hover:border-primary transition-colors flex flex-col items-center text-center space-y-4 bg-card">
            <Play className="w-8 h-8 text-primary" />
            <h3 className="text-lg font-semibold">RISC-V IDE</h3>
            <p className="text-sm text-muted-foreground">Write and execute assembly code live in the browser.</p>
          </Link>
          <Link href="/pipeline" className="group p-6 border rounded-xl hover:border-primary transition-colors flex flex-col items-center text-center space-y-4 bg-card">
            <Activity className="w-8 h-8 text-primary" />
            <h3 className="text-lg font-semibold">5-Stage Pipeline</h3>
            <p className="text-sm text-muted-foreground">Visualize instruction flow and hazard detection.</p>
          </Link>
          <Link href="/ooo" className="group p-6 border rounded-xl hover:border-primary transition-colors flex flex-col items-center text-center space-y-4 bg-card">
            <Shuffle className="w-8 h-8 text-primary" />
            <h3 className="text-lg font-semibold">Out of Order</h3>
            <p className="text-sm text-muted-foreground">Explore Tomasulo's algorithm and dynamic scheduling.</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
