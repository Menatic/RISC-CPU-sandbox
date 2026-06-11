# RV32I 15-Stage High-Performance Pipeline (Verilog RTL)

Industry-depth microarchitecture accompanying the CPU Explorer browser simulator. This core models the **pipeline depth and backend complexity** found in modern x86 and high-performance RISC-V designs (Intel Core, AMD Zen-class organization).

## Why 15 stages?

Textbook 5-stage pipelines teach fundamentals. Real silicon uses **deeper front-ends** (branch prediction, decoupled fetch, instruction queues) and **wider backends** (rename, dispatch, multi-cycle caches, reorder buffers) to hit GHz frequencies. This RTL exposes that full structure in synthesizable Verilog.

## Pipeline map

| Stage | Name | Industry analogue |
|------:|------|-------------------|
| S0 | **PC_GEN** | Next-PC mux + BTB/BHT (branch prediction) |
| S1 | **IF1** | L1I tag / index access |
| S2 | **IF2** | L1I data return + align |
| S3 | **IQ** | Instruction queue (decoupled front-end) |
| S4 | **DECODE** | Opcode decode + immediate expand |
| S5 | **RENAME** | RAT + physical register allocation |
| S6 | **DISPATCH** | ROB / LSQ slot allocation |
| S7 | **ISSUE** | Reservation-station style issue |
| S8 | **REGREAD** | Physical register file read |
| S9 | **EXE** | ALU + branch resolution |
| S10 | **AGU** | Address generation unit |
| S11 | **DC1** | L1 D-cache pipe stage 1 |
| S12 | **DC2** | L1 D-cache pipe stage 2 |
| S13 | **WB** | Physical register / ROB write |
| S14 | **RETIRE** | Architectural commit |

## Module hierarchy

```
riscv_core_15stage
├── btb_bht           (64-entry BTB + 128-entry 2-bit BHT)
├── instr_queue       (8-entry decoupled IQ)
├── rename_unit       (RAT + 64-entry physical reg file backing)
├── rob               (32-entry reorder buffer)
├── lsq               (8-entry load-store queue)
├── phy_regfile       (64 × 32-bit physical registers)
├── arch_regfile      (architectural x0–x31, commit-only writes)
├── pipe_lane_reg × 8 (backend pipeline registers)
└── [shared ALU, decoder, memories from ../riscv-pipeline]
```

## Simulation

```bash
cd hdl/riscv-pipeline-15stage
make sim
```

Requires [Icarus Verilog](http://iverilog.icarus.com/). Expected:

```
[PASS] 15-stage RV32I core: x3=8 x4=8
```

## Comparison with 5-stage core

| | 5-stage (`../riscv-pipeline`) | 15-stage (this) |
|---|---|---|
| Target | Education / baseline | Industry-style depth |
| Front-end | Single fetch | BTB + IQ + 2-cycle I-cache |
| Rename | None | RAT + physical registers |
| Commit | Direct WB | ROB retire |
| Min latency | 5 cycles | 15 cycles |
| Use case | Patterson & Hennessy | Interview / architecture review |

## Synthesis notes

- Synchronous design, active-low async reset
- No latches; `always @(*)` for combinational logic
- Compatible with Vivado, Quartus, Verilator lint
- RV32I ISA subset (same as browser simulator)
