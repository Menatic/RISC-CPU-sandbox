import React from 'react';
import { Cpu } from 'lucide-react';

export function TopBar() {
  return (
    <div className="h-16 border-b border-border bg-card/80 backdrop-blur-md fixed top-0 w-full z-50 flex items-center px-4 justify-between">
      <div className="flex items-center gap-2 text-primary font-bold text-lg">
        <Cpu className="w-6 h-6" />
        <span>Modern CPU Explorer</span>
      </div>
      <div className="flex items-center gap-4 text-sm font-mono text-muted-foreground">
        <div>RV32I Core</div>
        <div className="w-px h-4 bg-border"></div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500"></div> System Ready
        </div>
      </div>
    </div>
  );
}
