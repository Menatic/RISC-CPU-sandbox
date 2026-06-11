`timescale 1ns/1ps

module tb_riscv_core_15stage;
    reg         clk = 0;
    reg         rst_n = 0;
    wire [31:0] pc_debug;
    wire [3:0]  stage_debug;
    wire [3:0]  iq_occupancy_debug;
    wire [4:0]  rob_count_debug;

    always #5 clk = ~clk;

    riscv_core_15stage #(
        .IMEM_INIT_FILE("../riscv-pipeline/programs/test_program.mem")
    ) dut (
        .clk(clk), .rst_n(rst_n),
        .pc_debug(pc_debug), .stage_debug(stage_debug),
        .iq_occupancy_debug(iq_occupancy_debug),
        .rob_count_debug(rob_count_debug)
    );

    initial begin
        $dumpfile("riscv_core_15stage.vcd");
        $dumpvars(0, tb_riscv_core_15stage);
    end

    initial begin
        rst_n = 0;
        repeat (6) @(posedge clk);
        rst_n = 1;

        // 15-stage pipeline needs deeper fill/drain than 5-stage
        repeat (200) @(posedge clk);

        if (dut.u_arf.regs[3] === 32'd8 && dut.u_arf.regs[4] === 32'd8) begin
            $display("[PASS] 15-stage RV32I core: x3=%0d x4=%0d", dut.u_arf.regs[3], dut.u_arf.regs[4]);
        end else begin
            $display("[FAIL] Expected x3=8 x4=8, got x3=%0d x4=%0d",
                     dut.u_arf.regs[3], dut.u_arf.regs[4]);
        end
        $finish;
    end
endmodule
