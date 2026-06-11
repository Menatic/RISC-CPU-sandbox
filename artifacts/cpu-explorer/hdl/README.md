# Hardware Description Language (Verilog RTL)

This directory contains **synthesizable Verilog** RISC-V processor cores that accompany the CPU Explorer browser simulator.

| Core | Path | Stages | Purpose |
|------|------|--------|---------|
| **Baseline** | [`riscv-pipeline/`](riscv-pipeline/) | 5 | Patterson & Hennessy educational reference |
| **High-performance** | [`riscv-pipeline-15stage/`](riscv-pipeline-15stage/) | 15 | Industry-depth front-end + rename/ROB backend |

Both cores implement **RV32I** and can be simulated with Icarus Verilog (`make sim` in each subdirectory).

The in-app **Verilog HDL** page (`/verilog`) browses all sources with syntax highlighting and links each module to the interactive simulation labs.
