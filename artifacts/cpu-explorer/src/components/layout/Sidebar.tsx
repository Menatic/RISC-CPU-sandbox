import React from 'react';
import { Link, useLocation } from 'wouter';
import { 
  Cpu, LayoutDashboard, GitBranch, Shuffle, Server, 
  Network, Activity, Layers, ActivitySquare, AlertTriangle,
  History, BarChart2, BookOpen, Star, FileSearch, Microchip
} from 'lucide-react';

const routes = [
  { path: '/', label: 'Overview', icon: LayoutDashboard },
  { path: '/ide', label: 'RISC-V IDE', icon: Cpu },
  { path: '/pipeline', label: '5-Stage Pipeline', icon: Activity },
  { path: '/evolution', label: 'CPU Evolution', icon: History },
  { path: '/hazards', label: 'Hazard Lab', icon: AlertTriangle },
  { path: '/forwarding', label: 'Forwarding Lab', icon: ActivitySquare },
  { path: '/branch', label: 'Branch Predictor', icon: GitBranch },
  { path: '/cache', label: 'Cache Hierarchy', icon: Server },
  { path: '/superscalar', label: 'Superscalar', icon: Layers },
  { path: '/ooo', label: 'Out of Order', icon: Shuffle },
  { path: '/speculative', label: 'Speculative', icon: FileSearch },
  { path: '/blueprint', label: 'Blueprint', icon: Cpu },
  { path: '/verilog', label: 'Verilog HDL', icon: Microchip },
  { path: '/timeline', label: 'Timeline Gantt', icon: BarChart2 },
  { path: '/analytics', label: 'Analytics', icon: BarChart2 },
  { path: '/compare', label: 'Compare Lab', icon: Layers },
  { path: '/sandbox', label: 'Sandbox', icon: Network },
  { path: '/interview', label: 'Interview Prep', icon: BookOpen },
  { path: '/showcase', label: 'Showcase', icon: Star },
];

export function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="w-64 border-r border-border bg-card h-screen flex flex-col fixed left-0 top-0 pt-16 z-40">
      <div className="flex-1 py-4 overflow-y-auto">
        <nav className="space-y-1 px-2">
          {routes.map((route) => {
            const isActive = location === route.path;
            const Icon = route.icon;
            return (
              <Link 
                key={route.path} 
                href={route.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive 
                    ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary' 
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground border-l-2 border-transparent'
                }`}
              >
                <Icon className="w-4 h-4" />
                {route.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
