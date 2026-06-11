// IF/ID pipeline register with synchronous flush.
module if_id_reg (
    input  wire        clk,
    input  wire        rst_n,
    input  wire        write_enable,
    input  wire        flush,
    input  wire [31:0] pc_in,
    input  wire [31:0] pc_plus4_in,
    input  wire [31:0] instr_in,
    output reg  [31:0] pc_out,
    output reg  [31:0] pc_plus4_out,
    output reg  [31:0] instr_out
);
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            pc_out        <= 32'd0;
            pc_plus4_out  <= 32'd0;
            instr_out     <= 32'h00000013; // NOP (ADDI x0,x0,0)
        end else if (flush) begin
            pc_out        <= 32'd0;
            pc_plus4_out  <= 32'd0;
            instr_out     <= 32'h00000013;
        end else if (write_enable) begin
            pc_out        <= pc_in;
            pc_plus4_out  <= pc_plus4_in;
            instr_out     <= instr_in;
        end
    end
endmodule
