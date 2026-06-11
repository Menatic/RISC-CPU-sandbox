`include "include/riscv_defs.vh"

// Branch condition evaluation in EX stage.
module branch_comp (
    input  wire [2:0]  funct3,
    input  wire [31:0] rs1_val,
    input  wire [31:0] rs2_val,
    output reg         taken
);
    wire signed [31:0] s1 = rs1_val;
    wire signed [31:0] s2 = rs2_val;

    always @(*) begin
        taken = 1'b0;
        case (funct3)
            `F3_BEQ:  taken = (rs1_val == rs2_val);
            `F3_BNE:  taken = (rs1_val != rs2_val);
            `F3_BLT:  taken = (s1 < s2);
            `F3_BGE:  taken = (s1 >= s2);
            `F3_BLTU: taken = (rs1_val < rs2_val);
            `F3_BGEU: taken = (rs1_val >= rs2_val);
            default:  taken = 1'b0;
        endcase
    end
endmodule
