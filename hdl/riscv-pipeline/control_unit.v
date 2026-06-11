`include "include/riscv_defs.vh"

// Main decoder: instruction opcode/funct fields -> datapath control signals.
module control_unit (
    input  wire [6:0] opcode,
    input  wire [2:0] funct3,
    input  wire [6:0] funct7,
    output reg        reg_write,
    output reg        mem_read,
    output reg        mem_write,
    output reg        mem_to_reg,
    output reg        alu_src,
    output reg        branch,
    output reg        jump,
    output reg [1:0]  alu_op,      // 00=add, 01=branch/sub, 10=R-type, 11=I-type
    output reg [2:0]  imm_type,    // 0=I,1=S,2=B,3=U,4=J
    output reg        is_jalr,
    output reg        use_pc_a,
    output reg [3:0]  alu_ctrl
);
    always @(*) begin
        reg_write  = 1'b0;
        mem_read   = 1'b0;
        mem_write  = 1'b0;
        mem_to_reg = 1'b0;
        alu_src    = 1'b0;
        branch     = 1'b0;
        jump       = 1'b0;
        alu_op     = 2'b00;
        imm_type   = 3'd0;
        is_jalr    = 1'b0;
        use_pc_a   = 1'b0;
        alu_ctrl   = `ALU_ADD;

        case (opcode)
            `OP_LUI: begin
                reg_write  = 1'b1;
                alu_src    = 1'b1;
                alu_op     = 2'b11;
                imm_type   = 3'd3;
                alu_ctrl   = `ALU_PASSB;
            end
            `OP_AUIPC: begin
                reg_write  = 1'b1;
                alu_src    = 1'b1;
                use_pc_a   = 1'b1;
                alu_op     = 2'b00;
                imm_type   = 3'd3;
                alu_ctrl   = `ALU_ADD;
            end
            `OP_JAL: begin
                reg_write  = 1'b1;
                jump       = 1'b1;
                imm_type   = 3'd4;
            end
            `OP_JALR: begin
                reg_write  = 1'b1;
                jump       = 1'b1;
                is_jalr    = 1'b1;
                alu_src    = 1'b1;
                imm_type   = 3'd0;
                alu_ctrl   = `ALU_ADD;
            end
            `OP_BRANCH: begin
                branch   = 1'b1;
                alu_op   = 2'b01;
                imm_type = 3'd2;
                alu_ctrl = `ALU_SUB;
            end
            `OP_LOAD: begin
                reg_write  = 1'b1;
                mem_read   = 1'b1;
                mem_to_reg = 1'b1;
                alu_src    = 1'b1;
                alu_op     = 2'b00;
                imm_type   = 3'd0;
                alu_ctrl   = `ALU_ADD;
            end
            `OP_STORE: begin
                mem_write = 1'b1;
                alu_src   = 1'b1;
                alu_op    = 2'b00;
                imm_type  = 3'd1;
                alu_ctrl  = `ALU_ADD;
            end
            `OP_OP_IMM: begin
                reg_write = 1'b1;
                alu_src   = 1'b1;
                alu_op    = 2'b11;
                imm_type  = 3'd0;
                case (funct3)
                    3'b000: alu_ctrl = `ALU_ADD;
                    3'b010: alu_ctrl = `ALU_SLT;
                    3'b011: alu_ctrl = `ALU_SLTU;
                    3'b100: alu_ctrl = `ALU_XOR;
                    3'b110: alu_ctrl = `ALU_OR;
                    3'b111: alu_ctrl = `ALU_AND;
                    3'b001: alu_ctrl = `ALU_SLL;
                    3'b101: alu_ctrl = (funct7[5]) ? `ALU_SRA : `ALU_SRL;
                    default: alu_ctrl = `ALU_ADD;
                endcase
            end
            `OP_OP: begin
                reg_write = 1'b1;
                alu_op    = 2'b10;
                case (funct3)
                    3'b000: alu_ctrl = (funct7[5]) ? `ALU_SUB : `ALU_ADD;
                    3'b001: alu_ctrl = `ALU_SLL;
                    3'b010: alu_ctrl = `ALU_SLT;
                    3'b011: alu_ctrl = `ALU_SLTU;
                    3'b100: alu_ctrl = `ALU_XOR;
                    3'b101: alu_ctrl = (funct7[5]) ? `ALU_SRA : `ALU_SRL;
                    3'b110: alu_ctrl = `ALU_OR;
                    3'b111: alu_ctrl = `ALU_AND;
                    default: alu_ctrl = `ALU_ADD;
                endcase
            end
            default: ;
        endcase
    end
endmodule
