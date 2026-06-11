// Architectural register file — updated only at retirement (industry commit stage).
module arch_regfile (
    input  wire        clk,
    input  wire        rst_n,
    input  wire        we,
    input  wire [4:0]  waddr,
    input  wire [31:0] wdata,
    output wire [31:0] rdata1,
    output wire [31:0] rdata2,
    input  wire [4:0]  raddr1,
    input  wire [4:0]  raddr2
);
    reg [31:0] regs [1:31];

    assign rdata1 = (raddr1 == 0) ? 32'd0 : regs[raddr1];
    assign rdata2 = (raddr2 == 0) ? 32'd0 : regs[raddr2];

    integer i;
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            for (i = 1; i < 32; i = i + 1)
                regs[i] <= 32'd0;
        end else if (we && waddr != 0) begin
            regs[waddr] <= wdata;
        end
    end
endmodule
