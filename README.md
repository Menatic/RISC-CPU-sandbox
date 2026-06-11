# Modern CPU Explorer

An interactive computer architecture laboratory in the browser — plus **real synthesizable Verilog RTL** for RV32I cores. Write RISC-V assembly, execute programs cycle-by-cycle, visualize pipeline behavior, explore hazards and forwarding, study branch prediction and caches, and browse industry-style HDL with in-browser testbench waveforms.

Built for students, educators, hardware engineers, and anyone who wants to understand what actually happens inside a CPU.

---

## Live Demo

- **https://cpu-sandbox-with-hdl.vercel.app/**
- **https://cpu-tool-educational-sim.vercel.app/**

Key routes:

| Route | Module |
|-------|--------|
| `/` | Overview & landing |
| `/ide` | RISC-V IDE (Monaco editor + cycle/step execution) |
| `/pipeline` | 5-stage pipeline visualizer |
| `/hazards` | Hazard analysis lab |
| `/forwarding` | Data forwarding visualizer |
| `/branch` | Branch predictor lab |
| `/cache` | Cache hierarchy simulator |
| `/superscalar` | Superscalar execution explorer |
| `/ooo` | Out-of-order / Tomasulo-style lab |
| `/speculative` | Speculative execution explorer |
| `/blueprint` | CPU datapath blueprint |
| `/verilog` | **Verilog HDL cores + GTKWave-style live sim** |
| `/evolution` | CPU evolution timeline |
| `/timeline` | Pipeline timeline / Gantt view |
| `/analytics` | IPC, CPI, stall & flush metrics |
| `/compare` | Architecture comparison lab |
| `/sandbox` | Interactive architecture sandbox |
| `/interview` | Interview prep module |
| `/showcase` | Project showcase |

---

## Vision

**"What if learning computer architecture felt like using a professional engineering tool instead of reading a textbook?"**

The platform unifies:

- Interactive simulation (browser-native, zero install)
- Visual learning (pipeline motion, hazards, forwarding paths)
- Performance analysis (IPC, CPI, stalls, utilization)
- Architecture exploration (branch prediction → OOO → speculative execution)
- **Hardware credibility** (synthesizable Verilog, testbenches, VCD waveforms)

---

## What Makes This Project Different

Most CPU learning tools are either:

- A pretty pipeline animation with no real programs, or
- A Verilog repo with no accessible UI

Modern CPU Explorer is **both**:

| Layer | What you get |
|-------|----------------|
| **Browser lab** | RISC-V IDE, 15+ interactive modules, cycle-accurate pipeline engine |
| **RTL in repo** | 26+ Verilog modules, Makefiles, self-checking testbenches |
| **Bridge** | `/verilog` page runs the same `tb_riscv_core.v` program in-browser with GTKWave-style signal traces |

---

## Core Features

### Interactive RISC-V IDE (`/ide`)

Monaco Editor–powered assembly environment.

- Write and run custom RV32I programs
- Step cycle-by-cycle or run to completion
- Inspect registers, memory, and instruction encoding
- Built-in examples: Fibonacci, bubble sort, binary search, primes, matrix ops

### 5-Stage Pipeline Engine (`/pipeline`)

Classic **IF → ID → EX → MEM → WB** visualization tied to the simulation engine.

- Live instruction movement through stages
- Stall bubbles, branch flushes, forwarding highlights
- Retirement tracking and per-cycle explanations

### Hazard Analysis Lab (`/hazards`)

- **Data hazards:** RAW, WAR, WAW
- **Control hazards:** branches, pipeline flushes
- **Structural hazards:** resource conflicts
- Visual indicators for where and why hazards occur

### Forwarding Visualizer (`/forwarding`)

- EX/MEM → EX and MEM/WB → EX bypass paths
- Active forwarding highlighted during execution
- Demonstrates throughput improvement vs stall-only designs

### Advanced Microarchitecture Labs

| Module | Topics |
|--------|--------|
| `/branch` | Branch prediction (BTB, saturating counters) |
| `/cache` | L1/L2 hierarchy, latency, locality |
| `/superscalar` | Multiple issue, IPC > 1 concepts |
| `/ooo` | Out-of-order execution, rename, ROB |
| `/speculative` | Speculation, misprediction recovery |
| `/blueprint` | Datapath block diagram |
| `/evolution` | Historical CPU architecture progression |

### Performance & Analysis

- **Analytics** (`/analytics`): cycles, instructions, IPC, CPI, hazard counts
- **Timeline** (`/timeline`): Gantt-style pipeline occupancy
- **Compare** (`/compare`): side-by-side architecture comparison
- **Sandbox** (`/sandbox`): free-form architecture experimentation

### Interview Prep & Showcase

- Curated architecture Q&A and talking points (`/interview`)
- Portfolio-style feature summary (`/showcase`)

---

## Verilog HDL & Hardware Verification (`/verilog`)

Production-style **synthesizable Verilog-2001** ships inside the Vite app at `artifacts/cpu-explorer/hdl/` and is browsable in the browser.

### RV32I 5-Stage Core (`hdl/riscv-pipeline/`)

Patterson & Hennessy baseline — correlates directly with the browser pipeline simulator.

| Capability | Implementation |
|------------|----------------|
| ISA | RV32I (integer base instructions) |
| Pipeline | 5 stages with IF/ID, ID/EX, EX/MEM, MEM/WB registers |
| Hazards | Load-use stall detection |
| Forwarding | EX/MEM and MEM/WB bypass to EX |
| Control | Combinational decoder + pipelined control |
| Memory | Byte-addressable IMEM/DMEM (LB/LH/LW, SB/SH/SW, etc.) |
| Branches | BEQ, BNE, BLT, BGE, BLTU, BGEU with flush |
| Jumps | JAL, JALR with link register |

**Modules:** `riscv_core`, `alu`, `control_unit`, `regfile`, `hazard_unit`, `forwarding_unit`, `branch_comp`, pipeline registers, `instr_mem`, `data_mem`, `imm_gen`, `pc_reg`, `tb_riscv_core.v`

### RV32I 15-Stage Core (`hdl/riscv-pipeline-15stage/`)

Industry-depth microarchitecture modeling modern deep pipelines.

| Stage | Name | Industry analogue |
|------:|------|-------------------|
| S0 | PC_GEN | Next-PC + BTB/BHT |
| S1–S2 | IF1/IF2 | L1 instruction cache pipe |
| S3 | IQ | Decoupled instruction queue |
| S4 | DECODE | Opcode decode |
| S5 | RENAME | RAT + physical register allocation |
| S6 | DISPATCH | ROB / LSQ allocation |
| S7 | ISSUE | Reservation-station style issue |
| S8 | REGREAD | Physical register file read |
| S9 | EXE | ALU + branch resolve |
| S10 | AGU | Address generation |
| S11–S12 | DC1/DC2 | L1 data cache pipeline |
| S13 | WB | Writeback |
| S14 | RETIRE | Architectural commit |

**Modules:** `riscv_core_15stage`, `btb_bht` (64-entry BTB + 128-entry 2-bit BHT), `instr_queue`, `rename_unit`, `rob` (32-entry), `lsq` (8-entry), `phy_regfile` (64-entry), `arch_regfile`, `pipe_lane_reg`, `tb_riscv_core_15stage.v`

### Browser RTL Testbench (Live Sim tab)

In-browser cosimulation aligned with the pipeline engine — **not** Verilator WASM, but architecturally faithful for teaching:

- Runs the same program as `tb_riscv_core.v` / `test_program.mem`
- **Execute** (cycle-by-cycle) or **Full Trace** (instant complete run) — user-initiated only
- **PASS/FAIL** self-check (x3=8, x4=8)
- **GTKWave-style VCD viewer:** 31 hardware signals (clk, PC, pipeline latches, hazard, forwarding, ALU, DMEM, regfile)
- Digital waveforms with signal hierarchy, value-at-cursor column, zoom, and marker

### RTL Source tab

- Monaco Verilog viewer for every module
- Module browser grouped by category (Top, Control, Datapath, Pipeline, Front-end, Backend, Verification)
- Cross-links to related browser labs (`/pipeline`, `/hazards`, `/ooo`, etc.)

### Local HDL Simulation (ground truth)

Requires [Icarus Verilog](http://iverilog.icarus.com/):

```bash
# 5-stage core
cd artifacts/cpu-explorer/hdl/riscv-pipeline
make sim          # compile + run self-checking testbench
make wave         # open VCD in GTKWave (if installed)

# 15-stage core
cd artifacts/cpu-explorer/hdl/riscv-pipeline-15stage
make sim
make wave
```

For gate-level proof and every internal wire, use local simulation + GTKWave. The browser viewer provides the same testbench program with a deployable, zero-install experience.

---

## Technical Architecture

### Frontend (`artifacts/cpu-explorer/`)

| Technology | Role |
|------------|------|
| React + TypeScript | UI framework |
| Vite | Build tool, HDL raw bundling via `import.meta.glob` |
| Zustand | Pipeline simulation state |
| Tailwind CSS | Styling |
| Monaco Editor | Assembly + Verilog source viewing |
| Custom SVG engine | GTKWave-style digital waveforms |

### Simulation Engine (`src/engine/`, `src/store/`)

- RISC-V assembler / disassembler
- Cycle-accurate 5-stage pipeline model (stall, flush, forward)
- Waveform trace capture (`waveformTrace.ts`) for RTL cosim viewer
- Per-module educational simulators for branch, cache, OOO, etc.

### Backend (`artifacts/api-server/`)

- Express API with Zod validation
- Optional; frontend sim runs entirely client-side

### Deployment

- **Vercel** with `pnpm` workspace (`packageManager: pnpm@10.34.2`)
- SPA rewrites, custom build copies `artifacts/cpu-explorer/dist` → root `dist`
- Node ≥ 20.19

---

## Repository Structure

```text
artifacts/
├── cpu-explorer/                 # Main Vite React app
│   ├── src/
│   │   ├── pages/                # 18+ route modules
│   │   ├── components/rtl/       # GtkWaveViewer, RtlBrowserSimulator
│   │   ├── engine/               # RISC-V, waveform trace
│   │   ├── store/                # Pipeline simulator
│   │   └── data/                 # Verilog manifest, test programs
│   └── hdl/                      # Bundled synthesizable Verilog
│       ├── riscv-pipeline/       # 5-stage RV32I core + Makefile
│       └── riscv-pipeline-15stage/
├── api-server/                   # Express backend (optional)

lib/                              # Shared API client / Zod schemas
scripts/                          # Build utilities
vercel.json                       # Production deploy config
pnpm-lock.yaml                    # Locked workspace dependencies
```

---

## Local Development

### Prerequisites

- Node.js ≥ 20.19
- pnpm 10.x (`corepack enable`)

### Frontend

```bash
pnpm install
cd artifacts/cpu-explorer
pnpm run dev
```

Open **http://127.0.0.1:4173** (or the port Vite prints).

### Backend (optional)

```bash
cd artifacts/api-server
pnpm install
pnpm run dev
```

Health check: `http://127.0.0.1:5000/api/healthz`

### Production Build

```bash
pnpm --filter @workspace/cpu-explorer run build
```

Output: `artifacts/cpu-explorer/dist`

---

## Educational Impact

| Traditional learning | Modern CPU Explorer |
|----------------------|---------------------|
| Static pipeline diagrams | Cycle-by-cycle execution |
| Textbook assembly snippets | Full RISC-V IDE with examples |
| Verilog in a zip file | In-browser source browser + local `make sim` |
| GTKWave only after toolchain setup | GTKWave-style viewer in the browser |
| Theory separate from implementation | Browser pedagogy + RTL in one repo |

---

## Skills Demonstrated

### Computer Architecture

- RISC-V ISA, pipelining, hazards, forwarding, branching
- Branch prediction, caches, superscalar, OOO, speculation
- IPC/CPI performance analysis

### Digital Design & Verification

- Synthesizable Verilog-2001 (5-stage + 15-stage cores)
- Testbench design, VCD dumps, self-checking PASS/FAIL
- Industry-style units: BTB/BHT, ROB, rename, LSQ, physical regfile

### Software Engineering

- React / TypeScript full-stack UI
- Complex state modeling (pipeline, waveforms)
- Monorepo (pnpm workspaces), Vercel CI/CD
- Monaco integration, custom SVG visualization

---

## Honest Scope Notes

| Component | Nature |
|-----------|--------|
| Browser pipeline engine | Cycle-accurate **architectural** simulator for teaching |
| Advanced labs (OOO, speculative, etc.) | **Educational models** — illustrate concepts, not tape-out RTL |
| Browser GTKWave viewer | Trace of pipeline cosim (31 curated DUT signals) |
| Local `make sim` | **Real** Icarus Verilog simulation with full VCD |

Being clear about this boundary is a feature: pedagogy in the browser, hardware proof in the repo.

---

## Roadmap

Planned enhancements:

- Verilator → WASM for true gate-level browser cosim
- Expanded VCD signal export from local sim into browser
- WebAssembly acceleration for large benchmark runs
- Multi-core / cache-coherence exploration
- Performance benchmarking suite with standard microbenchmarks
- Additional ISA extensions (M, C) in RTL

---

## License

MIT License

---

Built for curious learners, future architects, and engineers who want to see — and prove — what really happens inside a CPU.
