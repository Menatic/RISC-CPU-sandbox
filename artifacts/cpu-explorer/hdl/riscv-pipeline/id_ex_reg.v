`include "include/riscv_defs.vh"

// ID/EX pipeline register — carries decoded control + register operands.
module id_ex_reg (
    input  wire        clk,
    input  wire        rst_n,
    input  wire        flush,
    input  wire [31:0] pc_in,
    input  wire [31:0] pc_plus4_in,
    input  wire [31:0] rs1_data_in,
    input  wire [31:0] rs2_data_in,
    input  wire [31:0] imm_in,
    input  wire [4:0]  rs1_addr_in,
    input  wire [4:0]  rs2_addr_in,
    input  wire [4:0]  rd_addr_in,
    input  wire [2:0]  funct3_in,
    input  wire        reg_write_in,
    input  wire        mem_read_in,
    input  wire        mem_write_in,
    input  wire        mem_to_reg_in,
    input  wire        alu_src_in,
    input  wire        branch_in,
    input  wire        jump_in,
    input  wire        is_jalr_in,
    input  wire        use_pc_a_in,
    input  wire [3:0]  alu_ctrl_in,
    output reg  [31:0] pc_out,
    output reg  [31:0] pc_plus4_out,
    output reg  [31:0] rs1_data_out,
    output reg  [31:0] rs2_data_out,
    output reg  [31:0] imm_out,
    output reg  [4:0]  rs1_addr_out,
    output reg  [4:0]  rs2_addr_out,
    output reg  [4:0]  rd_addr_out,
    output reg  [2:0]  funct3_out,
    output reg         reg_write_out,
    output reg         mem_read_out,
    output reg         mem_write_out,
    output reg         mem_to_reg_out,
    output reg         alu_src_out,
    output reg         branch_out,
    output reg         jump_out,
    output reg         is_jalr_out,
    output reg         use_pc_a_out,
    output reg  [3:0]  alu_ctrl_out
);
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            pc_out <= 0; pc_plus4_out <= 0;
            rs1_data_out <= 0; rs2_data_out <= 0; imm_out <= 0;
            rs1_addr_out <= 0; rs2_addr_out <= 0; rd_addr_out <= 0;
            funct3_out <= 0;
            reg_write_out <= 0; mem_read_out <= 0; mem_write_out <= 0;
            mem_to_reg_out <= 0; alu_src_out <= 0; branch_out <= 0;
            jump_out <= 0; is_jalr_out <= 0; use_pc_a_out <= 0; alu_ctrl_out <= `ALU_ADD;
        end else if (flush) begin
            reg_write_out <= 0; mem_read_out <= 0; mem_write_out <= 0;
            mem_to_reg_out <= 0; alu_src_out <= 0; branch_out <= 0;
            jump_out <= 0; is_jalr_out <= 0; use_pc_a_out <= 0; alu_ctrl_out <= `ALU_ADD;
            rd_addr_out <= 0;
        end else begin
            pc_out <= pc_in; pc_plus4_out <= pc_plus4_in;
            rs1_data_out <= rs1_data_in; rs2_data_out <= rs2_data_in;
            imm_out <= imm_in;
            rs1_addr_out <= rs1_addr_in; rs2_addr_out <= rs2_addr_in;
            rd_addr_out <= rd_addr_in; funct3_out <= funct3_in;
            reg_write_out <= reg_write_in; mem_read_out <= mem_read_in;
            mem_write_out <= mem_write_in; mem_to_reg_out <= mem_to_reg_in;
            alu_src_out <= alu_src_in; branch_out <= branch_in;
            jump_out <= jump_in; is_jalr_out <= is_jalr_in;
            use_pc_a_out <= use_pc_a_in; alu_ctrl_out <= alu_ctrl_in;
        end
    end
endmodule
