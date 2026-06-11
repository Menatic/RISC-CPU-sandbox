`include "include/riscv_defs.vh"

// Byte-addressable data memory with LB/LH/LW/LBU/LHU and SB/SH/SW.
module data_mem #(
    parameter ADDR_WIDTH = 10
) (
    input  wire        clk,
    input  wire        mem_read,
    input  wire        mem_write,
    input  wire [2:0]  funct3,
    input  wire [31:0] addr,
    input  wire [31:0] wdata,
    output reg  [31:0] rdata
);
    reg [7:0] mem [0:(1<<(ADDR_WIDTH+2))-1];
    integer i;

    initial begin
        for (i = 0; i < (1<<(ADDR_WIDTH+2)); i = i + 1)
            mem[i] = 8'd0;
    end

    wire [31:0] word_addr = {addr[31:2], 2'b00};
    wire [1:0]  byte_off  = addr[1:0];

    function [31:0] load_ext;
        input [2:0] f3;
        input [1:0] off;
        input [31:0] base;
        reg [7:0] b0, b1;
        reg [15:0] h;
        reg [31:0] w;
        begin
            w = {mem[base+3], mem[base+2], mem[base+1], mem[base]};
            case (f3)
                `F3_LB: begin
                    b0 = mem[base + off];
                    load_ext = {{24{b0[7]}}, b0};
                end
                `F3_LH: begin
                    h = {mem[base + off + 1], mem[base + off]};
                    load_ext = {{16{h[15]}}, h};
                end
                `F3_LW:  load_ext = w;
                `F3_LBU: load_ext = {24'd0, mem[base + off]};
                `F3_LHU: begin
                    h = {mem[base + off + 1], mem[base + off]};
                    load_ext = {16'd0, h};
                end
                default: load_ext = w;
            endcase
        end
    endfunction

    always @(posedge clk) begin
        if (mem_write) begin
            case (funct3)
                `F3_SB: mem[word_addr + byte_off] <= wdata[7:0];
                `F3_SH: begin
                    mem[word_addr + byte_off]     <= wdata[7:0];
                    mem[word_addr + byte_off + 1] <= wdata[15:8];
                end
                `F3_SW: begin
                    mem[word_addr]     <= wdata[7:0];
                    mem[word_addr + 1] <= wdata[15:8];
                    mem[word_addr + 2] <= wdata[23:16];
                    mem[word_addr + 3] <= wdata[31:24];
                end
                default: ;
            endcase
        end
    end

    always @(*) begin
        if (mem_read)
            rdata = load_ext(funct3, byte_off, word_addr);
        else
            rdata = 32'd0;
    end
endmodule
