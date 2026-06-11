# RV32I 5-Stage Pipelined Core (Verilog RTL)

Synthesizable Verilog-2001 implementation of a single-issue **RV32I** processor with a classic **IF → ID → EX → MEM → WB** pipeline. This RTL ships alongside the browser-based CPU Explorer and mirrors the same architectural concepts shown in the Pipeline, Hazard, and Forwarding labs.

## Features

| Capability | Implementation |
|---|---|
| ISA | RV32I (47 base integer instructions) |
| Pipeline | 5 stages with pipeline registers |
| Hazards | Load-use stall (1 bubble) |
| Forwarding | EX/MEM and MEM/WB bypass to EX |
| Control | Combinational decoder + pipelined control signals |
| Memories | Byte-addressable IMEM/DMEM with LB/LH/LW/LBU/LHU/SB/SH/SW |
| Branches | BEQ, BNE, BLT, BGE, BLTU, BGEU with flush |
| Jumps | JAL, JALR with link register (rd = pc+4) |

## Module hierarchy

```
riscv_core
├── pc_reg
├── instr_mem
├── if_id_reg
├── control_unit
├── imm_gen
├── regfile
├── id_ex_reg
├── forwarding_unit
├── hazard_unit
├── alu
├── branch_comp
├── ex_mem_reg
├── data_mem
└── mem_wb_reg
```

## Simulation

Requires [Icarus Verilog](http://iverilog.icarus.com/):

```bash
cd hdl/riscv-pipeline
make sim
```

Expected output:

```
[PASS] RV32I pipeline core: x3=8 x4=8
```

View waveforms:

```bash
make wave
```

## Synthesis

The RTL uses standard synchronous design (posedge clock, active-low async reset) and is intended for FPGA flows (Vivado, Quartus) and ASIC synthesis. No latches; combinational blocks use `always @(*)`.

## Relation to the browser simulator

| Browser (TypeScript) | This RTL |
|---|---|
| Cycle-steppable pipeline view | Cycle-accurate hardware model |
| Educational explanations | Gate-level module boundaries |
| Instant browser access | `make sim` / FPGA deployment |

Both implement the same textbook 5-stage organization from *Computer Organization and Design: RISC-V Edition*.
