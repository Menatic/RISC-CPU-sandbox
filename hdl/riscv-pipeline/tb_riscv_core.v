`timescale 1ns/1ps

// Self-checking testbench for the RV32I 5-stage pipelined core.
// Program: ADDI x1,0,5 | ADDI x2,0,3 | ADD x3,x1,x2 | SW x3,0(x0) | LW x4,0(x0)
module tb_riscv_core;
    reg         clk = 0;
    reg         rst_n = 0;
    wire [31:0] pc_debug;
    wire [31:0] instr_debug;
    wire        stall_debug;
    wire        flush_debug;

    always #5 clk = ~clk;

    riscv_core #(
        .IMEM_INIT_FILE("programs/test_program.mem")
    ) dut (
        .clk(clk),
        .rst_n(rst_n),
        .pc_debug(pc_debug),
        .instr_debug(instr_debug),
        .stall_debug(stall_debug),
        .flush_debug(flush_debug)
    );

    initial begin
        $dumpfile("riscv_core.vcd");
        $dumpvars(0, tb_riscv_core);
    end

    initial begin
        rst_n = 0;
        repeat (4) @(posedge clk);
        rst_n = 1;

        // Run until NOP slide completes program (~40 cycles with pipeline fill/drain)
        repeat (80) @(posedge clk);

        if (dut.u_regfile.regs[3] === 32'd8 && dut.u_regfile.regs[4] === 32'd8) begin
            $display("[PASS] RV32I pipeline core: x3=%0d x4=%0d", dut.u_regfile.regs[3], dut.u_regfile.regs[4]);
        end else begin
            $display("[FAIL] Expected x3=8 x4=8, got x3=%0d x4=%0d",
                     dut.u_regfile.regs[3], dut.u_regfile.regs[4]);
        end
        $finish;
    end
endmodule
