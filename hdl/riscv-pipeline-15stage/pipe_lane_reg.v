`include "include/pipe_types.vh"

// Universal pipeline register between all 15 stages.
// Carries decoded instruction context from front-end through retirement.
module pipe_lane_reg (
    input  wire        clk,
    input  wire        rst_n,
    input  wire        stall,
    input  wire        flush,
    input  wire        valid_in,
    input  wire [3:0]  stage_id_in,
    input  wire [31:0] pc_in,
    input  wire [31:0] pc_plus4_in,
    input  wire [31:0] instr_in,
    input  wire [31:0] imm_in,
    input  wire [4:0]  rs1_in,
    input  wire [4:0]  rs2_in,
    input  wire [4:0]  rd_in,
    input  wire [5:0]  prs1_in,
    input  wire [5:0]  prs2_in,
    input  wire [5:0]  prd_in,
    input  wire [4:0]  rob_idx_in,
    input  wire [2:0]  rs_slot_in,
    input  wire [2:0]  lsq_slot_in,
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
    input  wire        pred_taken_in,
    input  wire [3:0]  alu_ctrl_in,
    input  wire [31:0] rs1_val_in,
    input  wire [31:0] rs2_val_in,
    input  wire [31:0] alu_result_in,
    input  wire [31:0] mem_rdata_in,
    input  wire        branch_taken_in,
    input  wire [31:0] branch_target_in,
    output reg         valid_out,
    output reg  [3:0]  stage_id_out,
    output reg  [31:0] pc_out,
    output reg  [31:0] pc_plus4_out,
    output reg  [31:0] instr_out,
    output reg  [31:0] imm_out,
    output reg  [4:0]  rs1_out,
    output reg  [4:0]  rs2_out,
    output reg  [4:0]  rd_out,
    output reg  [5:0]  prs1_out,
    output reg  [5:0]  prs2_out,
    output reg  [5:0]  prd_out,
    output reg  [4:0]  rob_idx_out,
    output reg  [2:0]  rs_slot_out,
    output reg  [2:0]  lsq_slot_out,
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
    output reg         pred_taken_out,
    output reg  [3:0]  alu_ctrl_out,
    output reg  [31:0] rs1_val_out,
    output reg  [31:0] rs2_val_out,
    output reg  [31:0] alu_result_out,
    output reg  [31:0] mem_rdata_out,
    output reg         branch_taken_out,
    output reg  [31:0] branch_target_out
);
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            valid_out <= 1'b0;
            stage_id_out <= `STAGE_PC_GEN;
            pc_out <= 32'd0;
            pc_plus4_out <= 32'd0;
            instr_out <= 32'h00000013;
            imm_out <= 32'd0;
            rs1_out <= 5'd0;
            rs2_out <= 5'd0;
            rd_out <= 5'd0;
            prs1_out <= 6'd0;
            prs2_out <= 6'd0;
            prd_out <= 6'd0;
            rob_idx_out <= 5'd0;
            rs_slot_out <= 3'd0;
            lsq_slot_out <= 3'd0;
            funct3_out <= 3'd0;
            reg_write_out <= 1'b0;
            mem_read_out <= 1'b0;
            mem_write_out <= 1'b0;
            mem_to_reg_out <= 1'b0;
            alu_src_out <= 1'b0;
            branch_out <= 1'b0;
            jump_out <= 1'b0;
            is_jalr_out <= 1'b0;
            use_pc_a_out <= 1'b0;
            pred_taken_out <= 1'b0;
            alu_ctrl_out <= 4'd0;
            rs1_val_out <= 32'd0;
            rs2_val_out <= 32'd0;
            alu_result_out <= 32'd0;
            mem_rdata_out <= 32'd0;
            branch_taken_out <= 1'b0;
            branch_target_out <= 32'd0;
        end else if (flush) begin
            valid_out <= 1'b0;
            instr_out <= 32'h00000013;
            reg_write_out <= 1'b0;
            mem_read_out <= 1'b0;
            mem_write_out <= 1'b0;
        end else if (!stall) begin
            valid_out <= valid_in;
            stage_id_out <= stage_id_in;
            pc_out <= pc_in;
            pc_plus4_out <= pc_plus4_in;
            instr_out <= instr_in;
            imm_out <= imm_in;
            rs1_out <= rs1_in;
            rs2_out <= rs2_in;
            rd_out <= rd_in;
            prs1_out <= prs1_in;
            prs2_out <= prs2_in;
            prd_out <= prd_in;
            rob_idx_out <= rob_idx_in;
            rs_slot_out <= rs_slot_in;
            lsq_slot_out <= lsq_slot_in;
            funct3_out <= funct3_in;
            reg_write_out <= reg_write_in;
            mem_read_out <= mem_read_in;
            mem_write_out <= mem_write_in;
            mem_to_reg_out <= mem_to_reg_in;
            alu_src_out <= alu_src_in;
            branch_out <= branch_in;
            jump_out <= jump_in;
            is_jalr_out <= is_jalr_in;
            use_pc_a_out <= use_pc_a_in;
            pred_taken_out <= pred_taken_in;
            alu_ctrl_out <= alu_ctrl_in;
            rs1_val_out <= rs1_val_in;
            rs2_val_out <= rs2_val_in;
            alu_result_out <= alu_result_in;
            mem_rdata_out <= mem_rdata_in;
            branch_taken_out <= branch_taken_in;
            branch_target_out <= branch_target_in;
        end
    end
endmodule
