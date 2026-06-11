IVERILOG = iverilog
VVP      = vvp

COMMON = ../riscv-pipeline/regfile.v ../riscv-pipeline/alu.v \
         ../riscv-pipeline/control_unit.v ../riscv-pipeline/imm_gen.v \
         ../riscv-pipeline/branch_comp.v ../riscv-pipeline/pc_reg.v \
         ../riscv-pipeline/instr_mem.v ../riscv-pipeline/data_mem.v

LOCAL = include/pipe_types.vh pipe_lane_reg.v btb_bht.v instr_queue.v \
        rename_unit.v rob.v phy_regfile.v lsq.v arch_regfile.v \
        riscv_core_15stage.v

TB = tb_riscv_core_15stage.v

.PHONY: all sim wave clean

all: sim

sim: riscv_core_15stage.vvp
	$(VVP) riscv_core_15stage.vvp

riscv_core_15stage.vvp: $(COMMON) $(LOCAL) $(TB)
	$(IVERILOG) -g2012 -I. -I../riscv-pipeline -o $@ $(COMMON) $(LOCAL) $(TB)

wave: sim
	gtkwave riscv_core_15stage.vcd &

clean:
	rm -f riscv_core_15stage.vvp riscv_core_15stage.vcd
