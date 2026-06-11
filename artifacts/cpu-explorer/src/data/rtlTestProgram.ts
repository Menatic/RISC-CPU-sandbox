/** Assembly matching `hdl/.../programs/test_program.mem` — RTL testbench golden program. */
export const RTL_TESTBENCH_ASM = `# RTL testbench program (tb_riscv_core.v)
# PASS when x3 == 8 and x4 == 8 after load from memory.

ADDI  x1, zero, 5
ADDI  x2, zero, 3
ADD   x3, x1, x2
SW    x3, 0(zero)
LW    x4, 0(zero)
`;

export const RTL_PASS_REGS = { x3: 8, x4: 8 } as const;
