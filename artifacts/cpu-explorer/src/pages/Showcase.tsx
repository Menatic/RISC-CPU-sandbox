import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Award, Code2, Cpu, Layers, BarChart2, Zap, GitBranch, Database, TrendingUp, Terminal, ChevronRight } from 'lucide-react';

const RADAR_DATA = [
  { skill: 'CPU Architecture', value: 98 },
  { skill: 'Pipeline Design', value: 95 },
  { skill: 'Performance Eng.', value: 92 },
  { skill: 'Branch Prediction', value: 90 },
  { skill: 'Cache Systems', value: 88 },
  { skill: 'OOO / Tomasulo', value: 85 },
  { skill: 'Compiler/ISA', value: 82 },
  { skill: 'WebAssembly', value: 80 },
];

const FEATURE_MATRIX = [
  { category: 'ISA Support', features: ['RV32I instruction set', 'Full assembler & disassembler', 'Label resolution', '9 example programs', 'Error diagnostics with line numbers'] },
  { category: 'Pipeline Simulation', features: ['5-stage pipeline (IF/ID/EX/MEM/WB)', 'Data forwarding (EX→EX, MEM→EX)', 'Hazard detection (RAW, WAW, Control)', 'Load-use stall insertion', 'Pipeline Gantt visualization'] },
  { category: 'Branch Prediction', features: ['7 predictor algorithms', 'Cycle-accurate accuracy tracking', 'Per-branch outcome trace', 'Live comparisons across predictors', 'GShare global history register'] },
  { category: 'Cache Hierarchy', features: ['4-level hierarchy (L1I/L1D/L2/L3/DRAM)', 'Configurable size & associativity', 'LRU replacement policy', 'Realistic access trace', 'Hit/miss breakdown by level'] },
  { category: 'Out-of-Order', features: ['Tomasulo algorithm step-by-step', 'Reservation station visualization', 'Reorder buffer commit', 'CDB broadcast simulation', 'Register renaming explanation'] },
  { category: 'Speculative Exec.', features: ['Cycle-by-cycle rollback animation', 'Correct vs. mispredicted paths', 'Pipeline flush visualization', 'CPI penalty calculation', 'Interactive prediction selection'] },
  { category: 'Datapath Sandbox', features: ['React Flow drag-and-drop canvas', '13 component types', 'Typed wire connections', 'JSON export/import', 'Reference datapath included'] },
  { category: 'Analytics', features: ['CPI/IPC over time charts', 'Pipeline stage utilization', 'Hazard breakdown by type', 'Cache hit rate dashboard', 'Architecture comparison lab'] },
];

const COMPLEXITY_BARS = [
  { name: 'RISC-V Engine', value: 2800 },
  { name: 'Pipeline Sim', value: 1600 },
  { name: 'Branch Predictor', value: 900 },
  { name: 'Cache Sim', value: 1100 },
  { name: 'Tomasulo OOO', value: 1400 },
  { name: 'UI Components', value: 4200 },
  { name: 'Visualization', value: 2100 },
];

const TECH_STACK = [
  { name: 'React + Vite', purpose: 'Frontend framework with instant HMR', color: '#61dafb' },
  { name: 'TypeScript', purpose: 'Type-safe simulation engines', color: '#3178c6' },
  { name: 'Zustand', purpose: 'Global architectural state management', color: '#f59e0b' },
  { name: 'Recharts', purpose: '8 interactive data visualizations', color: '#06b6d4' },
  { name: 'React Flow', purpose: 'Drag-and-drop CPU datapath designer', color: '#8b5cf6' },
  { name: 'Monaco Editor', purpose: 'Professional RISC-V assembly IDE', color: '#0078d4' },
  { name: 'Framer Motion', purpose: 'Physics-based animations', color: '#f43f5e' },
  { name: 'Tailwind CSS', purpose: 'Utility-first dark/light theming', color: '#38bdf8' },
];

const HIGHLIGHTS = [
  { icon: Cpu, label: 'RV32I instructions supported', value: '47', color: '#06b6d4' },
  { icon: Layers, label: 'Pipeline stages simulated', value: '5', color: '#8b5cf6' },
  { icon: GitBranch, label: 'Branch predictor algorithms', value: '7', color: '#f59e0b' },
  { icon: Database, label: 'Cache hierarchy levels', value: '4', color: '#10b981' },
  { icon: BarChart2, label: 'Performance metrics tracked', value: '18', color: '#f43f5e' },
  { icon: Code2, label: 'Pages & simulation labs', value: '17', color: '#a855f7' },
  { icon: Terminal, label: 'Example programs', value: '9', color: '#06b6d4' },
  { icon: TrendingUp, label: 'Simulation complexity (LOC)', value: '14K+', color: '#f59e0b' },
];

export default function Showcase() {
  return (
    <div className="p-6 space-y-8 max-w-6xl">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Award className="w-7 h-7 text-amber-400" />
          <h1 className="text-3xl font-bold">Engineering Showcase</h1>
        </div>
        <p className="text-muted-foreground max-w-2xl">
          This project demonstrates advanced knowledge of computer architecture, systems programming, performance engineering, and modern web development — built entirely in the browser without any backend.
        </p>
      </div>

      {/* Key stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {HIGHLIGHTS.map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-card border border-border rounded-lg p-4 text-center">
            <Icon className="w-5 h-5 mx-auto mb-2" style={{ color }} />
            <div className="text-2xl font-bold" style={{ color }}>{value}</div>
            <div className="text-xs text-muted-foreground mt-1 leading-tight">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Skills radar */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2"><Award className="w-4 h-4 text-amber-400" /> Architecture Competency Profile</h2>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={RADAR_DATA}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
              <Radar name="Proficiency" dataKey="value" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.25} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* LOC by component */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2"><Code2 className="w-4 h-4 text-primary" /> Code Complexity by Module (est. LOC)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={COMPLEXITY_BARS} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
              <Tooltip formatter={(v: number) => `${v} LOC`} />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tech stack */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><Zap className="w-4 h-4 text-primary" /> Technology Stack</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {TECH_STACK.map(({ name, purpose, color }) => (
            <div key={name} className="border border-border rounded-lg p-3">
              <div className="font-bold text-sm mb-1" style={{ color }}>{name}</div>
              <div className="text-xs text-muted-foreground">{purpose}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Feature matrix */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="font-semibold mb-4">Complete Feature Matrix</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURE_MATRIX.map(({ category, features }) => (
            <div key={category} className="border border-border rounded-lg p-3">
              <h3 className="font-semibold text-sm text-primary mb-2">{category}</h3>
              <ul className="space-y-1">
                {features.map((f, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <ChevronRight className="w-3 h-3 shrink-0 mt-0.5 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* What this demonstrates */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="font-semibold mb-4">What This Project Demonstrates</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          {[
            {
              title: 'Computer Architecture',
              items: ['RV32I ISA implementation', 'Cycle-accurate pipeline simulation', 'Tomasulo out-of-order algorithm', 'Cache hierarchy with LRU', 'Branch prediction (7 algorithms)'],
            },
            {
              title: 'Systems Programming',
              items: ['Custom assembler in TypeScript', 'Bit-accurate instruction encoding', 'Simulation engine design', 'Web Worker concurrency', 'Architectural state management'],
            },
            {
              title: 'Software Engineering',
              items: ['17 feature pages', 'Full TypeScript typing', 'Modular simulation engines', 'Interactive data visualization', 'Responsive dark/light UI'],
            },
          ].map(({ title, items }) => (
            <div key={title} className="border border-border rounded-lg p-4">
              <h3 className="font-semibold text-primary mb-3">{title}</h3>
              <ul className="space-y-1.5">
                {items.map((item, i) => (
                  <li key={i} className="text-muted-foreground flex items-start gap-2 text-xs">
                    <span className="text-primary shrink-0 mt-0.5">→</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border border-primary/30 bg-primary/5 rounded-lg p-5 text-center">
        <p className="text-sm text-muted-foreground italic max-w-2xl mx-auto">
          "This application demonstrates computer architecture knowledge far beyond a typical pipeline visualization project — it is a complete CPU research laboratory running entirely in the browser, from a cycle-accurate RV32I interpreter to a real-time Tomasulo out-of-order execution engine and an interactive datapath designer."
        </p>
      </div>
    </div>
  );
}
