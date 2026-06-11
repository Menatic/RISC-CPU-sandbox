import { useCallback, useState } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap, addEdge,
  useNodesState, useEdgesState, Node, Edge, Connection,
  Handle, Position, NodeProps, BackgroundVariant
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Cpu, Plus, RotateCcw, Save, Upload, Info, X } from 'lucide-react';

type ComponentDef = { type: string; label: string; color: string; category: string; description: string; inputs: string[]; outputs: string[] };

const COMPONENTS: ComponentDef[] = [
  { type: 'pc_node', label: 'Program Counter', color: '#06b6d4', category: 'Fetch', description: 'Holds address of next instruction', inputs: ['Next PC'], outputs: ['PC Address'] },
  { type: 'imem_node', label: 'Instr Memory', color: '#3b82f6', category: 'Fetch', description: 'Read-only instruction ROM/L1I Cache', inputs: ['Address'], outputs: ['Instruction[31:0]'] },
  { type: 'regfile_node', label: 'Register File', color: '#8b5cf6', category: 'Decode', description: '32×32-bit register file (x0–x31)', inputs: ['RS1 addr', 'RS2 addr', 'RD addr', 'Write data'], outputs: ['RS1 data', 'RS2 data'] },
  { type: 'ctrl_node', label: 'Control Unit', color: '#f43f5e', category: 'Decode', description: 'Decodes opcode → control signals', inputs: ['Opcode[6:0]', 'Funct3/7'], outputs: ['RegWrite', 'MemRead', 'MemWrite', 'ALUSrc', 'Branch'] },
  { type: 'alu_node', label: 'ALU', color: '#f59e0b', category: 'Execute', description: 'Arithmetic and logic operations', inputs: ['Operand A', 'Operand B', 'ALU Op'], outputs: ['Result', 'Zero flag'] },
  { type: 'mux_node', label: 'MUX 2:1', color: '#64748b', category: 'Routing', description: '2-to-1 multiplexer', inputs: ['Input 0', 'Input 1', 'Select'], outputs: ['Output'] },
  { type: 'adder_node', label: 'Adder', color: '#64748b', category: 'Routing', description: 'Simple 32-bit adder (PC+4, branch addr)', inputs: ['A', 'B'], outputs: ['A+B'] },
  { type: 'signext_node', label: 'Sign Extend', color: '#475569', category: 'Decode', description: 'Extends 12-bit immediate to 32 bits', inputs: ['Imm[11:0]'], outputs: ['Imm[31:0]'] },
  { type: 'dmem_node', label: 'Data Memory', color: '#10b981', category: 'Memory', description: 'L1 Data Cache / main memory', inputs: ['Address', 'Write data', 'MemRead', 'MemWrite'], outputs: ['Read data'] },
  { type: 'hazunit_node', label: 'Hazard Unit', color: '#ef4444', category: 'Control', description: 'Detects load-use hazards', inputs: ['ID/EX.rd', 'IF/ID.rs1/rs2', 'MemRead'], outputs: ['Stall signals'] },
  { type: 'fwdunit_node', label: 'Forward Unit', color: '#06b6d4', category: 'Control', description: 'Selects forwarding paths for ALU inputs', inputs: ['EX/MEM.rd', 'MEM/WB.rd', 'ID/EX.rs1/rs2'], outputs: ['ForwardA', 'ForwardB'] },
  { type: 'brpred_node', label: 'Branch Predictor', color: '#a855f7', category: 'Control', description: '2-bit saturating counter predictor', inputs: ['PC', 'Branch outcome'], outputs: ['Prediction', 'Target PC'] },
  { type: 'rob_node', label: 'Reorder Buffer', color: '#ec4899', category: 'OOO', description: 'In-order commit buffer for OOO execution', inputs: ['Issue', 'Write results'], outputs: ['Commit (in order)'] },
  { type: 'rs_node', label: 'Reservation Stations', color: '#f97316', category: 'OOO', description: 'Hold instructions waiting for operands', inputs: ['Issue', 'CDB broadcast'], outputs: ['Dispatch to FU'] },
];

const CATEGORY_COLORS: Record<string, string> = {
  Fetch: '#3b82f6', Decode: '#8b5cf6', Execute: '#f59e0b', Memory: '#10b981', Routing: '#64748b', Control: '#ef4444', OOO: '#ec4899'
};

// Generic CPU component node
function CPUNode({ data }: NodeProps) {
  const d = data as ComponentDef & { label: string };
  const comp = COMPONENTS.find(c => c.label === d.label) ?? COMPONENTS[0];
  return (
    <div className="rounded-lg border-2 min-w-[120px] text-xs font-mono" style={{ borderColor: comp.color, backgroundColor: comp.color + '18' }}>
      {comp.inputs.map((inp, i) => (
        <Handle key={`in-${i}`} type="target" position={Position.Left}
          id={`in-${i}`} style={{ top: `${(i + 1) * (100 / (comp.inputs.length + 1))}%`, background: comp.color }} />
      ))}
      <div className="px-3 py-2">
        <div className="font-bold text-center mb-1" style={{ color: comp.color }}>{d.label}</div>
        <div className="text-center opacity-60" style={{ fontSize: '9px' }}>{comp.category}</div>
      </div>
      {comp.outputs.map((out, i) => (
        <Handle key={`out-${i}`} type="source" position={Position.Right}
          id={`out-${i}`} style={{ top: `${(i + 1) * (100 / (comp.outputs.length + 1))}%`, background: comp.color }} />
      ))}
    </div>
  );
}

const nodeTypes = { cpu_component: CPUNode };

// Starter datapath: basic 5-stage pipeline
const INITIAL_NODES: Node[] = [
  { id: 'pc1', type: 'cpu_component', position: { x: 40, y: 200 }, data: { label: 'Program Counter' } },
  { id: 'imem1', type: 'cpu_component', position: { x: 180, y: 180 }, data: { label: 'Instr Memory' } },
  { id: 'regfile1', type: 'cpu_component', position: { x: 360, y: 160 }, data: { label: 'Register File' } },
  { id: 'ctrl1', type: 'cpu_component', position: { x: 360, y: 320 }, data: { label: 'Control Unit' } },
  { id: 'alu1', type: 'cpu_component', position: { x: 540, y: 180 }, data: { label: 'ALU' } },
  { id: 'dmem1', type: 'cpu_component', position: { x: 700, y: 180 }, data: { label: 'Data Memory' } },
  { id: 'mux1', type: 'cpu_component', position: { x: 480, y: 320 }, data: { label: 'MUX 2:1' } },
];

const INITIAL_EDGES: Edge[] = [
  { id: 'e-pc-imem', source: 'pc1', target: 'imem1', sourceHandle: 'out-0', targetHandle: 'in-0', label: 'PC addr', style: { stroke: '#3b82f6' } },
  { id: 'e-imem-reg', source: 'imem1', target: 'regfile1', sourceHandle: 'out-0', targetHandle: 'in-0', label: 'instr', style: { stroke: '#3b82f6' } },
  { id: 'e-imem-ctrl', source: 'imem1', target: 'ctrl1', sourceHandle: 'out-0', targetHandle: 'in-0', label: 'opcode', style: { stroke: '#f43f5e' } },
  { id: 'e-reg-alu', source: 'regfile1', target: 'alu1', sourceHandle: 'out-0', targetHandle: 'in-0', label: 'rs1', style: { stroke: '#8b5cf6' } },
  { id: 'e-mux-alu', source: 'mux1', target: 'alu1', sourceHandle: 'out-0', targetHandle: 'in-1', label: 'rs2/imm', style: { stroke: '#64748b' } },
  { id: 'e-alu-dmem', source: 'alu1', target: 'dmem1', sourceHandle: 'out-0', targetHandle: 'in-0', label: 'addr', style: { stroke: '#f59e0b' } },
];

export default function Sandbox() {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [selectedComp, setSelectedComp] = useState<ComponentDef | null>(null);
  const [infoComp, setInfoComp] = useState<ComponentDef | null>(null);
  let nodeId = nodes.length + 1;

  const onConnect = useCallback((params: Connection) => setEdges(eds => addEdge({
    ...params,
    style: { stroke: '#06b6d4', strokeWidth: 2 },
    animated: true,
  }, eds)), [setEdges]);

  const addComponent = useCallback((comp: ComponentDef) => {
    const id = `${comp.type}_${Date.now()}`;
    setNodes(ns => [...ns, {
      id,
      type: 'cpu_component',
      position: { x: 200 + Math.random() * 300, y: 100 + Math.random() * 300 },
      data: { label: comp.label },
    }]);
  }, [setNodes]);

  const reset = useCallback(() => { setNodes(INITIAL_NODES); setEdges(INITIAL_EDGES); }, []);

  const saveJSON = useCallback(() => {
    const data = JSON.stringify({ nodes, edges }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'cpu-datapath.json'; a.click();
  }, [nodes, edges]);

  const categories = [...new Set(COMPONENTS.map(c => c.category))];

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0">
      {/* Component palette */}
      <div className="w-56 bg-card border-r border-border flex flex-col overflow-y-auto shrink-0">
        <div className="p-3 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <Cpu className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">Component Palette</span>
          </div>
          <p className="text-xs text-muted-foreground">Drag or click to add components to the canvas</p>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {categories.map(cat => (
            <div key={cat} className="mb-3">
              <div className="text-xs font-semibold uppercase tracking-wider mb-1.5 px-1" style={{ color: CATEGORY_COLORS[cat] }}>{cat}</div>
              {COMPONENTS.filter(c => c.category === cat).map(comp => (
                <div key={comp.type} className="flex items-center justify-between group mb-1">
                  <button
                    onClick={() => addComponent(comp)}
                    data-testid={`add-${comp.type}`}
                    className="flex-1 text-left px-2 py-1.5 rounded text-xs font-mono border border-transparent hover:border-border hover:bg-muted transition-all"
                    style={{ color: comp.color }}
                  >
                    {comp.label}
                  </button>
                  <button onClick={() => setInfoComp(infoComp?.type === comp.type ? null : comp)}
                    className="p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Info className="w-3 h-3 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="p-2 border-t border-border space-y-1">
          <button onClick={reset} className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted border border-border" data-testid="reset-sandbox">
            <RotateCcw className="w-3 h-3" /> Reset to Default
          </button>
          <button onClick={saveJSON} className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted border border-border" data-testid="save-datapath">
            <Save className="w-3 h-3" /> Export JSON
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        {/* Info panel overlay */}
        {infoComp && (
          <div className="absolute top-3 right-3 z-10 bg-card border border-border rounded-lg p-3 w-60 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-sm" style={{ color: infoComp.color }}>{infoComp.label}</span>
              <button onClick={() => setInfoComp(null)}><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
            </div>
            <p className="text-xs text-muted-foreground mb-2">{infoComp.description}</p>
            <div className="text-xs space-y-1">
              <div className="text-green-400 font-medium">Inputs: {infoComp.inputs.join(', ')}</div>
              <div className="text-blue-400 font-medium">Outputs: {infoComp.outputs.join(', ')}</div>
            </div>
          </div>
        )}

        <div className="absolute top-3 left-3 z-10 bg-card/80 border border-border rounded px-2 py-1 text-xs text-muted-foreground">
          Click palette to add · Drag to move · Connect handles to wire
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          className="bg-slate-950/30"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1e293b" />
          <Controls />
          <MiniMap nodeStrokeWidth={3} pannable zoomable style={{ background: 'hsl(var(--card))' }} />
        </ReactFlow>
      </div>
    </div>
  );
}
