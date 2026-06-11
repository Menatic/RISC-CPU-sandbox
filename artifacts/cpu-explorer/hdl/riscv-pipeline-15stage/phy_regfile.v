`include "include/pipe_types.vh"

// Physical register file (64 entries) — backend of register renaming.
module phy_regfile (
    input  wire        clk,
    input  wire        rst_n,
    input  wire        we,
    input  wire [5:0]  waddr,
    input  wire [31:0] wdata,
    input  wire [5:0]  raddr1,
    input  wire [5:0]  raddr2,
    output wire [31:0] rdata1,
    output wire [31:0] rdata2
);
    reg [31:0] regs [1:`PREG_COUNT-1];

    assign rdata1 = (raddr1 == 0) ? 32'd0 : regs[raddr1];
    assign rdata2 = (raddr2 == 0) ? 32'd0 : regs[raddr2];

    integer i;
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            for (i = 1; i < `PREG_COUNT; i = i + 1)
                regs[i] <= 32'd0;
        end else if (we && waddr != 0) begin
            regs[waddr] <= wdata;
        end
    end
endmodule
