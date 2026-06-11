# RV32I 5-stage pipeline — simulation with Icarus Verilog
IVERILOG = iverilog
VVP      = vvp
GTKWAVE  = gtkwave

SRCS = \
	include/riscv_defs.vh \
	regfile.v alu.v control_unit.v imm_gen.v branch_comp.v \
	forwarding_unit.v hazard_unit.v \
	if_id_reg.v id_ex_reg.v ex_mem_reg.v mem_wb_reg.v \
	pc_reg.v instr_mem.v data_mem.v riscv_core.v

TB = tb_riscv_core.v

.PHONY: all sim wave clean lint

all: sim

sim: riscv_core.vvp
	$(VVP) riscv_core.vvp

riscv_core.vvp: $(SRCS) $(TB)
	$(IVERILOG) -g2012 -I. -o $@ $(SRCS) $(TB)

wave: sim
	$(GTKWAVE) riscv_core.vcd &

lint:
	verilator --lint-only -Wall $(SRCS) 2>/dev/null || echo "Install Verilator for lint: https://verilator.org"

clean:
	rm -f riscv_core.vvp riscv_core.vcd
