// Dual-read, single-write architectural register file (x0 hardwired to zero).
module regfile #(
    parameter ADDR_WIDTH = 5,
    parameter DATA_WIDTH = 32
) (
    input  wire                     clk,
    input  wire                     rst_n,
    input  wire                     we,
    input  wire [ADDR_WIDTH-1:0]    raddr1,
    input  wire [ADDR_WIDTH-1:0]    raddr2,
    input  wire [ADDR_WIDTH-1:0]    waddr,
    input  wire [DATA_WIDTH-1:0]    wdata,
    output wire [DATA_WIDTH-1:0]    rdata1,
    output wire [DATA_WIDTH-1:0]    rdata2
);
    reg [DATA_WIDTH-1:0] regs [1:31];

    assign rdata1 = (raddr1 == {ADDR_WIDTH{1'b0}}) ? {DATA_WIDTH{1'b0}} : regs[raddr1];
    assign rdata2 = (raddr2 == {ADDR_WIDTH{1'b0}}) ? {DATA_WIDTH{1'b0}} : regs[raddr2];

    integer i;
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            for (i = 1; i < 32; i = i + 1)
                regs[i] <= {DATA_WIDTH{1'b0}};
        end else if (we && (waddr != {ADDR_WIDTH{1'b0}})) begin
            regs[waddr] <= wdata;
        end
    end
endmodule
