`include "include/riscv_defs.vh"

// RV32I integer ALU — arithmetic, logic, and shifts.
module alu (
    input  wire [31:0] a,
    input  wire [31:0] b,
    input  wire [3:0]  alu_op,
    output reg  [31:0] result,
    output wire        zero
);
    wire signed [31:0] as = a;
    wire signed [31:0] bs = b;
    wire [4:0] shamt = b[4:0];

    always @(*) begin
        case (alu_op)
            `ALU_ADD:   result = a + b;
            `ALU_SUB:   result = a - b;
            `ALU_SLL:   result = a << shamt;
            `ALU_SLT:   result = (as < bs) ? 32'd1 : 32'd0;
            `ALU_SLTU:  result = (a < b) ? 32'd1 : 32'd0;
            `ALU_XOR:   result = a ^ b;
            `ALU_SRL:   result = a >> shamt;
            `ALU_SRA:   result = as >>> shamt;
            `ALU_OR:    result = a | b;
            `ALU_AND:   result = a & b;
            `ALU_PASSB: result = b;
            default:    result = 32'd0;
        endcase
    end

    assign zero = (result == 32'd0);
endmodule
