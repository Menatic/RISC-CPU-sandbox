export type VerilogCoreId = '5stage' | '15stage';

export type VerilogModuleMeta = {
  id: string;
  file: string;
  label: string;
  category: string;
  description: string;
  stage?: number;
  lines?: number;
  relatedPage?: string;
};

export const CORE_PROFILES: Record<
  VerilogCoreId,
  {
    name: string;
    subtitle: string;
    stages: number;
    path: string;
    highlights: string[];
    industryNote: string;
  }
> = {
  '5stage': {
    name: 'RV32I 5-Stage Pipeline',
    subtitle: 'Patterson & Hennessy baseline — educational reference',
    stages: 5,
    path: 'artifacts/cpu-explorer/hdl/riscv-pipeline',
    highlights: [
      'Classic IF → ID → EX → MEM → WB',
      'Data forwarding (EX/MEM, MEM/WB)',
      'Load-use hazard detection',
      'Branch flush in EX stage',
      'Synthesizable Verilog-2001',
    ],
    industryNote:
      'The same organization taught in CO&D (RISC-V Edition). Ideal for correlating with the browser pipeline simulator.',
  },
  '15stage': {
    name: 'RV32I 15-Stage High-Performance Core',
    subtitle: 'Industry-depth front-end + OOO-ready backend',
    stages: 15,
    path: 'artifacts/cpu-explorer/hdl/riscv-pipeline-15stage',
    highlights: [
      'BTB + 2-bit BHT branch prediction (S0)',
      'Decoupled 8-entry instruction queue (S3)',
      'Register renaming with 64-entry physical RF (S5)',
      '32-entry reorder buffer + retire (S6/S14)',
      '2-cycle L1 D-cache pipeline (S11–S12)',
      'Load-store queue interface (S6)',
    ],
    industryNote:
      'Pipeline depth and unit boundaries mirror modern Intel/AMD-style cores: deep fetch, rename/dispatch, split cache pipes, in-order retire.',
  },
};

export const STAGES_15 = [
  { n: 0, id: 'PC_GEN', name: 'PC Generation', analog: 'Next-PC + BTB/BHT' },
  { n: 1, id: 'IF1', name: 'I-Cache Tag', analog: 'L1I index (cycle 1)' },
  { n: 2, id: 'IF2', name: 'I-Cache Data', analog: 'L1I return (cycle 2)' },
  { n: 3, id: 'IQ', name: 'Instr Queue', analog: 'Decoupled front-end' },
  { n: 4, id: 'DECODE', name: 'Decode', analog: 'Control ROM / decode' },
  { n: 5, id: 'RENAME', name: 'Rename', analog: 'RAT + free list' },
  { n: 6, id: 'DISPATCH', name: 'Dispatch', analog: 'ROB / LSQ alloc' },
  { n: 7, id: 'ISSUE', name: 'Issue', analog: 'RS pick' },
  { n: 8, id: 'REGREAD', name: 'Reg Read', analog: 'Physical RF read' },
  { n: 9, id: 'EXE', name: 'Execute', analog: 'ALU / branch resolve' },
  { n: 10, id: 'AGU', name: 'AGU', analog: 'Effective address' },
  { n: 11, id: 'DC1', name: 'D-Cache 1', analog: 'L1D pipe stage 1' },
  { n: 12, id: 'DC2', name: 'D-Cache 2', analog: 'L1D pipe stage 2' },
  { n: 13, id: 'WB', name: 'Writeback', analog: 'PRF / ROB data' },
  { n: 14, id: 'RETIRE', name: 'Retire', analog: 'Architectural commit' },
];

export const MODULES_5STAGE: VerilogModuleMeta[] = [
  { id: 'riscv_core', file: 'riscv_core.v', label: 'riscv_core', category: 'Top', description: 'Top-level 5-stage RV32I core integrating all units.', relatedPage: '/pipeline' },
  { id: 'control_unit', file: 'control_unit.v', label: 'control_unit', category: 'Control', description: 'Combinational decoder: opcode → control signals.', relatedPage: '/blueprint' },
  { id: 'hazard_unit', file: 'hazard_unit.v', label: 'hazard_unit', category: 'Control', description: 'Load-use stall + branch flush detection.', relatedPage: '/hazards' },
  { id: 'forwarding_unit', file: 'forwarding_unit.v', label: 'forwarding_unit', category: 'Control', description: 'EX/MEM and MEM/WB bypass mux select.', relatedPage: '/forwarding' },
  { id: 'alu', file: 'alu.v', label: 'alu', category: 'Datapath', description: 'RV32I integer ALU (ADD/SUB/logic/shifts).', relatedPage: '/blueprint' },
  { id: 'regfile', file: 'regfile.v', label: 'regfile', category: 'Datapath', description: '32×32 architectural register file.', relatedPage: '/ide' },
  { id: 'branch_comp', file: 'branch_comp.v', label: 'branch_comp', category: 'Datapath', description: 'Branch condition evaluation in EX.', relatedPage: '/branch' },
  { id: 'if_id_reg', file: 'if_id_reg.v', label: 'if_id_reg', category: 'Pipeline', description: 'IF/ID pipeline register with flush.', relatedPage: '/pipeline' },
  { id: 'id_ex_reg', file: 'id_ex_reg.v', label: 'id_ex_reg', category: 'Pipeline', description: 'ID/EX pipeline register carrying control.', relatedPage: '/pipeline' },
  { id: 'ex_mem_reg', file: 'ex_mem_reg.v', label: 'ex_mem_reg', category: 'Pipeline', description: 'EX/MEM pipeline register.', relatedPage: '/pipeline' },
  { id: 'mem_wb_reg', file: 'mem_wb_reg.v', label: 'mem_wb_reg', category: 'Pipeline', description: 'MEM/WB pipeline register.', relatedPage: '/pipeline' },
  { id: 'tb', file: 'tb_riscv_core.v', label: 'tb_riscv_core', category: 'Verification', description: 'Self-checking testbench with VCD dump.' },
];

export const MODULES_15STAGE: VerilogModuleMeta[] = [
  { id: 'riscv_core_15', file: 'riscv_core_15stage.v', label: 'riscv_core_15stage', category: 'Top', description: '15-stage top-level integrating front-end, backend, and commit.', stage: -1, relatedPage: '/pipeline' },
  { id: 'btb_bht', file: 'btb_bht.v', label: 'btb_bht', category: 'Front-end', description: '64-entry BTB + 128-entry 2-bit saturating BHT.', stage: 0, relatedPage: '/branch' },
  { id: 'instr_queue', file: 'instr_queue.v', label: 'instr_queue', category: 'Front-end', description: '8-entry instruction queue — decouples fetch from decode.', stage: 3 },
  { id: 'rename_unit', file: 'rename_unit.v', label: 'rename_unit', category: 'Backend', description: 'Register alias table + physical register allocation.', stage: 5, relatedPage: '/ooo' },
  { id: 'rob', file: 'rob.v', label: 'rob', category: 'Backend', description: '32-entry reorder buffer for in-order retire.', stage: 6, relatedPage: '/ooo' },
  { id: 'lsq', file: 'lsq.v', label: 'lsq', category: 'Backend', description: '8-entry load-store queue for memory disambiguation.', stage: 6 },
  { id: 'phy_regfile', file: 'phy_regfile.v', label: 'phy_regfile', category: 'Backend', description: '64-entry physical register file.', stage: 8 },
  { id: 'arch_regfile', file: 'arch_regfile.v', label: 'arch_regfile', category: 'Commit', description: 'Architectural RF — written only at retirement.', stage: 14 },
  { id: 'pipe_lane_reg', file: 'pipe_lane_reg.v', label: 'pipe_lane_reg', category: 'Pipeline', description: 'Universal pipeline register between backend stages.', stage: -1 },
  { id: 'tb15', file: 'tb_riscv_core_15stage.v', label: 'tb_riscv_core_15stage', category: 'Verification', description: 'Self-checking testbench for 15-stage core.' },
];

// Eager-load HDL sources at build time (must live under Vite project root: artifacts/cpu-explorer/hdl/)
const files5 = import.meta.glob('/hdl/riscv-pipeline/**/*.{v,vh}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const files15 = import.meta.glob('/hdl/riscv-pipeline-15stage/**/*.{v,vh}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

export function getSourceForModule(core: VerilogCoreId, file: string): string {
  const map = core === '5stage' ? files5 : files15;
  const suffix = `/${file}`;
  const key = Object.keys(map).find((k) => normalizePath(k).endsWith(suffix));
  if (key) return map[key];
  const keys = Object.keys(map);
  if (keys.length === 0) {
    return `// HDL bundle empty — rebuild required.\n// Expected: ${CORE_PROFILES[core].path}/${file}`;
  }
  return `// Source not found: ${file}\n// Available: ${keys.map((k) => normalizePath(k).split('/').pop()).join(', ')}`;
}

export function countHdlLines(core: VerilogCoreId): number {
  const map = core === '5stage' ? files5 : { ...files5, ...files15 };
  const sources = core === '5stage' ? files5 : files15;
  return Object.values(sources).reduce((n, src) => n + src.split('\n').length, 0);
}

export function totalModuleCount(): number {
  return Object.keys(files5).length + Object.keys(files15).length;
}
