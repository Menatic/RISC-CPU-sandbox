`include "../riscv-pipeline/include/riscv_defs.vh"
`include "include/pipe_types.vh"

// ============================================================================
// RV32I 15-STAGE HIGH-PERFORMANCE PIPELINE CORE
// ============================================================================
// Industry-style microarchitecture (Intel/AMD-class depth):
//   S0  PC_GEN    — Next-PC mux + BTB/BHT prediction
//   S1  IF1       — I-cache tag / index (registered fetch)
//   S2  IF2       — I-cache data return + align
//   S3  IQ        — Instruction queue dequeue (decoupled front-end)
//   S4  DECODE    — Opcode decode + immediate generation
//   S5  RENAME    — RAT lookup + physical register allocation
//   S6  DISPATCH  — ROB / LSQ slot allocation
//   S7  ISSUE     — Operand readiness / reservation station pick
//   S8  REGREAD   — Physical register file read
//   S9  EXE       — ALU / branch condition evaluation
//   S10 AGU       — Address generation for loads & stores
//   S11 DC1       — L1 D-cache pipe stage 1
//   S12 DC2       — L1 D-cache pipe stage 2 + data return
//   S13 WB        — Write physical register / ROB value field
//   S14 RETIRE    — Architectural commit at ROB head
// ============================================================================
module riscv_core_15stage #(
    parameter IMEM_ADDR_WIDTH = 10,
    parameter DMEM_ADDR_WIDTH = 10,
    parameter RESET_PC        = 32'h0000_0000,
    parameter IMEM_INIT_FILE  = ""
) (
    input  wire        clk,
    input  wire        rst_n,
    output wire [31:0] pc_debug,
    output wire [3:0]  stage_debug,
    output wire [3:0]  iq_occupancy_debug,
    output wire [4:0]  rob_count_debug
);
    // ===================== Global control =====================
    wire branch_resolved, branch_taken_res, branch_mispredict;
    wire [31:0] branch_pc, branch_target_res, redirect_pc;
    wire        btb_taken, btb_hit;
    wire [31:0] btb_target;

    wire global_stall = rob_full;
    wire global_flush = branch_mispredict;

    // ===================== S0: PC Generation =====================
    wire [31:0] pc, pc_plus4, next_pc;
    wire        pc_write = ~global_stall;

    pc_reg #(.RESET_PC(RESET_PC)) u_pc (
        .clk(clk), .rst_n(rst_n), .write_enable(pc_write),
        .next_pc(next_pc), .pc(pc)
    );
    assign pc_plus4 = pc + 32'd4;

    btb_bht u_predictor (
        .clk(clk), .rst_n(rst_n), .fetch_pc(pc),
        .update_valid(branch_resolved), .update_pc(branch_pc),
        .update_taken(branch_taken_res), .update_target(branch_target_res),
        .pred_taken(btb_taken), .pred_target(btb_target), .pred_valid(btb_hit)
    );

    assign next_pc = global_flush ? redirect_pc :
                     (btb_hit && btb_taken) ? btb_target : pc_plus4;

  assign pc_debug = pc;

    // ===================== S1-S2: Instruction Fetch =====================
    wire [31:0] instr_fetched;
    instr_mem #(.ADDR_WIDTH(IMEM_ADDR_WIDTH), .INIT_FILE(IMEM_INIT_FILE)) u_imem (
        .addr(pc), .instr(instr_fetched)
    );

    reg [31:0] if1_pc, if2_pc, if2_instr;
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            if1_pc <= RESET_PC;
            if2_pc <= RESET_PC;
            if2_instr <= 32'h00000013;
        end else if (!global_stall) begin
            if1_pc <= pc;
            if2_pc <= if1_pc;
            if2_instr <= instr_fetched;
        end
    end

    // ===================== S3: Instruction Queue =====================
    wire iq_enq_ready, iq_deq_valid;
    wire [31:0] iq_deq_pc, iq_deq_instr;

    instr_queue u_iq (
        .clk(clk), .rst_n(rst_n),
        .enq_valid(pc_write), .enq_pc(if2_pc), .enq_instr(if2_instr),
        .deq_ready(~global_stall), .enq_ready(iq_enq_ready),
        .deq_valid(iq_deq_valid), .deq_pc(iq_deq_pc), .deq_instr(iq_deq_instr),
        .occupancy(iq_occupancy_debug)
    );

    // ===================== S4: Decode (combinational) =====================
    wire [6:0] dec_opcode = iq_deq_instr[6:0];
    wire [4:0] dec_rd     = iq_deq_instr[11:7];
    wire [2:0] dec_funct3 = iq_deq_instr[14:12];
    wire [4:0] dec_rs1    = iq_deq_instr[19:15];
    wire [4:0] dec_rs2    = iq_deq_instr[24:20];
    wire [6:0] dec_funct7 = iq_deq_instr[31:25];

    wire d_reg_write, d_mem_read, d_mem_write, d_mem_to_reg, d_alu_src;
    wire d_branch, d_jump, d_is_jalr, d_use_pc_a;
    wire [2:0] d_imm_type;
    wire [3:0] d_alu_ctrl;
    wire [31:0] dec_imm;

    control_unit u_ctrl (
        .opcode(dec_opcode), .funct3(dec_funct3), .funct7(dec_funct7),
        .reg_write(d_reg_write), .mem_read(d_mem_read), .mem_write(d_mem_write),
        .mem_to_reg(d_mem_to_reg), .alu_src(d_alu_src), .branch(d_branch),
        .jump(d_jump), .alu_op(), .imm_type(d_imm_type),
        .is_jalr(d_is_jalr), .use_pc_a(d_use_pc_a), .alu_ctrl(d_alu_ctrl)
    );

    imm_gen u_imm (.instr(iq_deq_instr), .imm_type(d_imm_type), .imm(dec_imm));

    // ===================== S5: Rename =====================
    wire [5:0] ren_prs1, ren_prs2, ren_prd;
    wire ren_stall;

    rename_unit u_rename (
        .clk(clk), .rst_n(rst_n), .alloc_valid(iq_deq_valid && !global_stall),
        .rs1_arch(dec_rs1), .rs2_arch(dec_rs2), .rd_arch(dec_rd),
        .rd_writes(d_reg_write), .prs1(ren_prs1), .prs2(ren_prs2), .prd(ren_prd),
        .stall_rename(ren_stall)
    );

    // ===================== S6: Dispatch / ROB alloc =====================
    wire [4:0] rob_alloc_idx;
    wire rob_full, rob_commit_valid;
    wire [4:0] rob_commit_rd;
    wire [31:0] rob_commit_val;

    rob u_rob (
        .clk(clk), .rst_n(rst_n),
        .alloc_valid(iq_deq_valid && !global_stall && !rob_full),
        .alloc_rd(dec_rd), .alloc_prd(ren_prd),
        .complete_valid(pipe_wb_valid), .complete_idx(pipe_wb_rob),
        .complete_value(pipe_wb_wdata),
        .commit_ready(1'b1),
        .alloc_idx(rob_alloc_idx), .commit_valid(rob_commit_valid),
        .commit_rd(rob_commit_rd), .commit_value(rob_commit_val),
        .rob_full(rob_full)
    );

    reg [4:0] rob_count_r;
    always @(posedge clk) rob_count_r <= rob_alloc_idx;
    assign rob_count_debug = rob_count_r;

    // ===================== Pipeline lane S7→S14 (8 registers) =====================
    // Pack dispatch bundle into first pipe stage input
    wire pipe_in_valid = iq_deq_valid && !rob_full;
    wire [31:0] pipe_in_pc = iq_deq_pc;
    wire [31:0] pipe_in_pc_plus4 = iq_deq_pc + 32'd4;
    wire [31:0] pipe_in_instr = iq_deq_instr;

    // Lane wires — declare stage 7 input and stage 14 output
    wire        p7_v, p8_v, p9_v, p10_v, p11_v, p12_v, p13_v, p14_v;
    wire [3:0]  p7_sid, p8_sid, p9_sid, p10_sid, p11_sid, p12_sid, p13_sid, p14_sid;
    wire [31:0] p7_pc, p8_pc, p9_pc, p10_pc, p11_pc, p12_pc, p13_pc, p14_pc;
    wire [31:0] p7_p4, p8_p4, p9_p4, p10_p4, p11_p4, p12_p4, p13_p4, p14_p4;
    wire [31:0] p7_instr, p8_instr, p9_instr, p10_instr, p11_instr, p12_instr, p13_instr, p14_instr;
    wire [31:0] p7_imm, p8_imm, p9_imm, p10_imm, p11_imm, p12_imm, p13_imm, p14_imm;
    wire [4:0]  p7_rs1, p8_rs1, p9_rs1, p10_rs1, p11_rs1, p12_rs1, p13_rs1, p14_rs1;
    wire [4:0]  p7_rs2, p8_rs2, p9_rs2, p10_rs2, p11_rs2, p12_rs2, p13_rs2, p14_rs2;
    wire [4:0]  p7_rd, p8_rd, p9_rd, p10_rd, p11_rd, p12_rd, p13_rd, p14_rd;
    wire [5:0]  p7_ps1, p8_ps1, p9_ps1, p10_ps1, p11_ps1, p12_ps1, p13_ps1, p14_ps1;
    wire [5:0]  p7_ps2, p8_ps2, p9_ps2, p10_ps2, p11_ps2, p12_ps2, p13_ps2, p14_ps2;
    wire [5:0]  p7_pd, p8_pd, p9_pd, p10_pd, p11_pd, p12_pd, p13_pd, p14_pd;
    wire [4:0]  p7_rob, p8_rob, p9_rob, p10_rob, p11_rob, p12_rob, p13_rob, p14_rob;
    wire [2:0]  p7_f3, p8_f3, p9_f3, p10_f3, p11_f3, p12_f3, p13_f3, p14_f3;
    wire        p7_rw, p8_rw, p9_rw, p10_rw, p11_rw, p12_rw, p13_rw, p14_rw;
    wire        p7_mr, p8_mr, p9_mr, p10_mr, p11_mr, p12_mr, p13_mr, p14_mr;
    wire        p7_mw, p8_mw, p9_mw, p10_mw, p11_mw, p12_mw, p13_mw, p14_mw;
    wire        p7_m2r, p8_m2r, p9_m2r, p10_m2r, p11_m2r, p12_m2r, p13_m2r, p14_m2r;
    wire        p7_asrc, p8_asrc, p9_asrc, p10_asrc, p11_asrc, p12_asrc, p13_asrc, p14_asrc;
    wire        p7_br, p8_br, p9_br, p10_br, p11_br, p12_br, p13_br, p14_br;
    wire        p7_jmp, p8_jmp, p9_jmp, p10_jmp, p11_jmp, p12_jmp, p13_jmp, p14_jmp;
    wire        p7_jalr, p8_jalr, p9_jalr, p10_jalr, p11_jalr, p12_jalr, p13_jalr, p14_jalr;
    wire        p7_upc, p8_upc, p9_upc, p10_upc, p11_upc, p12_upc, p13_upc, p14_upc;
    wire [3:0]  p7_alu, p8_alu, p9_alu, p10_alu, p11_alu, p12_alu, p13_alu, p14_alu;
    wire [31:0] p7_r1v, p8_r1v, p9_r1v, p10_r1v, p11_r1v, p12_r1v, p13_r1v, p14_r1v;
    wire [31:0] p7_r2v, p8_r2v, p9_r2v, p10_r2v, p11_r2v, p12_r2v, p13_r2v, p14_r2v;
    wire [31:0] p7_alur, p8_alur, p9_alur, p10_alur, p11_alur, p12_alur, p13_alur, p14_alur;
    wire [31:0] p7_mrd, p8_mrd, p9_mrd, p10_mrd, p11_mrd, p12_mrd, p13_mrd, p14_mrd;
    wire        p7_bt, p8_bt, p9_bt, p10_bt, p11_bt, p12_bt, p13_bt, p14_bt;
    wire [31:0] p7_btgt, p8_btgt, p9_btgt, p10_btgt, p11_btgt, p12_btgt, p13_btgt, p14_btgt;
    wire        p7_pred, p8_pred, p9_pred, p10_pred, p11_pred, p12_pred, p13_pred, p14_pred;
    wire [2:0]  p7_rss, p8_rss, p9_rss, p10_rss, p11_rss, p12_rss, p13_rss, p14_rss;
    wire [2:0]  p7_lsq, p8_lsq, p9_lsq, p10_lsq, p11_lsq, p12_lsq, p13_lsq, p14_lsq;

    // S7 ISSUE input (from dispatch)
    wire s7_v = pipe_in_valid;
    wire [3:0] s7_sid = `STAGE_ISSUE;

    // S7→S8 pipe (ISSUE → REGREAD)
    pipe_lane_reg r78 (
        .clk(clk), .rst_n(rst_n), .stall(global_stall), .flush(global_flush),
        .valid_in(s7_v), .stage_id_in(s7_sid),
        .pc_in(pipe_in_pc), .pc_plus4_in(pipe_in_pc_plus4), .instr_in(pipe_in_instr),
        .imm_in(dec_imm), .rs1_in(dec_rs1), .rs2_in(dec_rs2), .rd_in(dec_rd),
        .prs1_in(ren_prs1), .prs2_in(ren_prs2), .prd_in(ren_prd),
        .rob_idx_in(rob_alloc_idx), .rs_slot_in(3'd0), .lsq_slot_in(3'd0),
        .funct3_in(dec_funct3), .reg_write_in(d_reg_write), .mem_read_in(d_mem_read),
        .mem_write_in(d_mem_write), .mem_to_reg_in(d_mem_to_reg), .alu_src_in(d_alu_src),
        .branch_in(d_branch), .jump_in(d_jump), .is_jalr_in(d_is_jalr),
        .use_pc_a_in(d_use_pc_a), .pred_taken_in(btb_taken), .alu_ctrl_in(d_alu_ctrl),
        .rs1_val_in(32'd0), .rs2_val_in(32'd0), .alu_result_in(32'd0),
        .mem_rdata_in(32'd0), .branch_taken_in(1'b0), .branch_target_in(32'd0),
        .valid_out(p8_v), .stage_id_out(p8_sid),
        .pc_out(p8_pc), .pc_plus4_out(p8_p4), .instr_out(p8_instr),
        .imm_out(p8_imm), .rs1_out(p8_rs1), .rs2_out(p8_rs2), .rd_out(p8_rd),
        .prs1_out(p8_ps1), .prs2_out(p8_ps2), .prd_out(p8_pd),
        .rob_idx_out(p8_rob), .rs_slot_out(p8_rss), .lsq_slot_out(p8_lsq),
        .funct3_out(p8_f3), .reg_write_out(p8_rw), .mem_read_out(p8_mr),
        .mem_write_out(p8_mw), .mem_to_reg_out(p8_m2r), .alu_src_out(p8_asrc),
        .branch_out(p8_br), .jump_out(p8_jmp), .is_jalr_out(p8_jalr),
        .use_pc_a_out(p8_upc), .pred_taken_out(p8_pred), .alu_ctrl_out(p8_alu),
        .rs1_val_out(p8_r1v), .rs2_val_out(p8_r2v), .alu_result_out(p8_alur),
        .mem_rdata_out(p8_mrd), .branch_taken_out(p8_bt), .branch_target_out(p8_btgt)
    );

    // S8 REGREAD — physical register file
    wire [31:0] prf_r1, prf_r2;
    phy_regfile u_prf (
        .clk(clk), .rst_n(rst_n),
        .we(pipe_wb_valid), .waddr(pipe_wb_prd), .wdata(pipe_wb_wdata),
        .raddr1(p8_ps1), .raddr2(p8_ps2), .rdata1(prf_r1), .rdata2(prf_r2)
    );

    pipe_lane_reg r89 (
        .clk(clk), .rst_n(rst_n), .stall(global_stall), .flush(global_flush),
        .valid_in(p8_v), .stage_id_in(`STAGE_REGREAD),
        .pc_in(p8_pc), .pc_plus4_in(p8_p4), .instr_in(p8_instr),
        .imm_in(p8_imm), .rs1_in(p8_rs1), .rs2_in(p8_rs2), .rd_in(p8_rd),
        .prs1_in(p8_ps1), .prs2_in(p8_ps2), .prd_in(p8_pd),
        .rob_idx_in(p8_rob), .rs_slot_in(p8_rss), .lsq_slot_in(p8_lsq),
        .funct3_in(p8_f3), .reg_write_in(p8_rw), .mem_read_in(p8_mr),
        .mem_write_in(p8_mw), .mem_to_reg_in(p8_m2r), .alu_src_in(p8_asrc),
        .branch_in(p8_br), .jump_in(p8_jmp), .is_jalr_in(p8_jalr),
        .use_pc_a_in(p8_upc), .pred_taken_in(p8_pred), .alu_ctrl_in(p8_alu),
        .rs1_val_in(prf_r1), .rs2_val_in(prf_r2), .alu_result_in(32'd0),
        .mem_rdata_in(32'd0), .branch_taken_in(1'b0), .branch_target_in(32'd0),
        .valid_out(p9_v), .stage_id_out(p9_sid),
        .pc_out(p9_pc), .pc_plus4_out(p9_p4), .instr_out(p9_instr),
        .imm_out(p9_imm), .rs1_out(p9_rs1), .rs2_out(p9_rs2), .rd_out(p9_rd),
        .prs1_out(p9_ps1), .prs2_out(p9_ps2), .prd_out(p9_pd),
        .rob_idx_out(p9_rob), .rs_slot_out(p9_rss), .lsq_slot_out(p9_lsq),
        .funct3_out(p9_f3), .reg_write_out(p9_rw), .mem_read_out(p9_mr),
        .mem_write_out(p9_mw), .mem_to_reg_out(p9_m2r), .alu_src_out(p9_asrc),
        .branch_out(p9_br), .jump_out(p9_jmp), .is_jalr_out(p9_jalr),
        .use_pc_a_out(p9_upc), .pred_taken_out(p9_pred), .alu_ctrl_out(p9_alu),
        .rs1_val_out(p9_r1v), .rs2_val_out(p9_r2v), .alu_result_out(p9_alur),
        .mem_rdata_out(p9_mrd), .branch_taken_out(p9_bt), .branch_target_out(p9_btgt)
    );

    // S9 EXE — ALU + branch resolve
    wire [31:0] exe_a = p9_upc ? p9_pc : p9_r1v;
    wire [31:0] exe_b = p9_asrc ? p9_imm : p9_r2v;
    wire [31:0] exe_alu_result;
    wire        exe_zero;

    alu u_alu (
        .a(exe_a), .b(exe_b), .alu_op(p9_alu),
        .result(exe_alu_result), .zero(exe_zero)
    );

    wire exe_branch_taken;
    branch_comp u_bcmp (
        .funct3(p9_f3), .rs1_val(exe_a), .rs2_val(p9_r2v), .taken(exe_branch_taken)
    );

    wire br_taken = p9_br && exe_branch_taken;
    wire jmp_taken = p9_jmp;
    wire [31:0] br_target = p9_pc + p9_imm;
    wire [31:0] jalr_target = (exe_a + p9_imm) & 32'hFFFF_FFFE;
    wire [31:0] resolved_target = p9_jalr ? jalr_target : br_target;
    wire [31:0] exe_result = p9_jmp ? p9_p4 : exe_alu_result;

    assign branch_resolved = p9_v && (p9_br || p9_jmp);
    assign branch_taken_res = br_taken || jmp_taken;
    assign branch_pc = p9_pc;
    assign branch_target_res = resolved_target;
    assign branch_mispredict = branch_resolved && (p9_pred != branch_taken_res);
    assign redirect_pc = resolved_target;

    pipe_lane_reg r910 (
        .clk(clk), .rst_n(rst_n), .stall(global_stall), .flush(global_flush),
        .valid_in(p9_v), .stage_id_in(`STAGE_EXE),
        .pc_in(p9_pc), .pc_plus4_in(p9_p4), .instr_in(p9_instr),
        .imm_in(p9_imm), .rs1_in(p9_rs1), .rs2_in(p9_rs2), .rd_in(p9_rd),
        .prs1_in(p9_ps1), .prs2_in(p9_ps2), .prd_in(p9_pd),
        .rob_idx_in(p9_rob), .rs_slot_in(p9_rss), .lsq_slot_in(p9_lsq),
        .funct3_in(p9_f3), .reg_write_in(p9_rw), .mem_read_in(p9_mr),
        .mem_write_in(p9_mw), .mem_to_reg_in(p9_m2r), .alu_src_in(p9_asrc),
        .branch_in(p9_br), .jump_in(p9_jmp), .is_jalr_in(p9_jalr),
        .use_pc_a_in(p9_upc), .pred_taken_in(p9_pred), .alu_ctrl_in(p9_alu),
        .rs1_val_in(p9_r1v), .rs2_val_in(p9_r2v), .alu_result_in(exe_result),
        .mem_rdata_in(32'd0), .branch_taken_in(br_taken || jmp_taken),
        .branch_target_in(resolved_target),
        .valid_out(p10_v), .stage_id_out(p10_sid),
        .pc_out(p10_pc), .pc_plus4_out(p10_p4), .instr_out(p10_instr),
        .imm_out(p10_imm), .rs1_out(p10_rs1), .rs2_out(p10_rs2), .rd_out(p10_rd),
        .prs1_out(p10_ps1), .prs2_out(p10_ps2), .prd_out(p10_pd),
        .rob_idx_out(p10_rob), .rs_slot_out(p10_rss), .lsq_slot_out(p10_lsq),
        .funct3_out(p10_f3), .reg_write_out(p10_rw), .mem_read_out(p10_mr),
        .mem_write_out(p10_mw), .mem_to_reg_out(p10_m2r), .alu_src_out(p10_asrc),
        .branch_out(p10_br), .jump_out(p10_jmp), .is_jalr_out(p10_jalr),
        .use_pc_a_out(p10_upc), .pred_taken_out(p10_pred), .alu_ctrl_out(p10_alu),
        .rs1_val_out(p10_r1v), .rs2_val_out(p10_r2v), .alu_result_out(p10_alur),
        .mem_rdata_out(p10_mrd), .branch_taken_out(p10_bt), .branch_target_out(p10_btgt)
    );

    // S10 AGU
    wire [31:0] agu_addr = p10_alur;
    pipe_lane_reg r1011 (
        .clk(clk), .rst_n(rst_n), .stall(global_stall), .flush(1'b0),
        .valid_in(p10_v), .stage_id_in(`STAGE_AGU),
        .pc_in(p10_pc), .pc_plus4_in(p10_p4), .instr_in(p10_instr),
        .imm_in(p10_imm), .rs1_in(p10_rs1), .rs2_in(p10_rs2), .rd_in(p10_rd),
        .prs1_in(p10_ps1), .prs2_in(p10_ps2), .prd_in(p10_pd),
        .rob_idx_in(p10_rob), .rs_slot_in(p10_rss), .lsq_slot_in(p10_lsq),
        .funct3_in(p10_f3), .reg_write_in(p10_rw), .mem_read_in(p10_mr),
        .mem_write_in(p10_mw), .mem_to_reg_in(p10_m2r), .alu_src_in(p10_asrc),
        .branch_in(p10_br), .jump_in(p10_jmp), .is_jalr_in(p10_jalr),
        .use_pc_a_in(p10_upc), .pred_taken_in(p10_pred), .alu_ctrl_in(p10_alu),
        .rs1_val_in(p10_r1v), .rs2_val_in(p10_r2v), .alu_result_in(agu_addr),
        .mem_rdata_in(32'd0), .branch_taken_in(p10_bt), .branch_target_in(p10_btgt),
        .valid_out(p11_v), .stage_id_out(p11_sid),
        .pc_out(p11_pc), .pc_plus4_out(p11_p4), .instr_out(p11_instr),
        .imm_out(p11_imm), .rs1_out(p11_rs1), .rs2_out(p11_rs2), .rd_out(p11_rd),
        .prs1_out(p11_ps1), .prs2_out(p11_ps2), .prd_out(p11_pd),
        .rob_idx_out(p11_rob), .rs_slot_out(p11_rss), .lsq_slot_out(p11_lsq),
        .funct3_out(p11_f3), .reg_write_out(p11_rw), .mem_read_out(p11_mr),
        .mem_write_out(p11_mw), .mem_to_reg_out(p11_m2r), .alu_src_out(p11_asrc),
        .branch_out(p11_br), .jump_out(p11_jmp), .is_jalr_out(p11_jalr),
        .use_pc_a_out(p11_upc), .pred_taken_out(p11_pred), .alu_ctrl_out(p11_alu),
        .rs1_val_out(p11_r1v), .rs2_val_out(p11_r2v), .alu_result_out(p11_alur),
        .mem_rdata_out(p11_mrd), .branch_taken_out(p11_bt), .branch_target_out(p11_btgt)
    );

    // S11-S12 D-cache pipeline
    wire [31:0] dmem_rdata;
    data_mem #(.ADDR_WIDTH(DMEM_ADDR_WIDTH)) u_dmem (
        .clk(clk), .mem_read(p11_mr), .mem_write(p11_mw),
        .funct3(p11_f3), .addr(p11_alur), .wdata(p11_r2v), .rdata(dmem_rdata)
    );

    pipe_lane_reg r1112 (
        .clk(clk), .rst_n(rst_n), .stall(global_stall), .flush(1'b0),
        .valid_in(p11_v), .stage_id_in(`STAGE_DC1),
        .pc_in(p11_pc), .pc_plus4_in(p11_p4), .instr_in(p11_instr),
        .imm_in(p11_imm), .rs1_in(p11_rs1), .rs2_in(p11_rs2), .rd_in(p11_rd),
        .prs1_in(p11_ps1), .prs2_in(p11_ps2), .prd_in(p11_pd),
        .rob_idx_in(p11_rob), .rs_slot_in(p11_rss), .lsq_slot_in(p11_lsq),
        .funct3_in(p11_f3), .reg_write_in(p11_rw), .mem_read_in(p11_mr),
        .mem_write_in(p11_mw), .mem_to_reg_in(p11_m2r), .alu_src_in(p11_asrc),
        .branch_in(p11_br), .jump_in(p11_jmp), .is_jalr_in(p11_jalr),
        .use_pc_a_in(p11_upc), .pred_taken_in(p11_pred), .alu_ctrl_in(p11_alu),
        .rs1_val_in(p11_r1v), .rs2_val_in(p11_r2v), .alu_result_in(p11_alur),
        .mem_rdata_in(32'd0), .branch_taken_in(p11_bt), .branch_target_in(p11_btgt),
        .valid_out(p12_v), .stage_id_out(p12_sid),
        .pc_out(p12_pc), .pc_plus4_out(p12_p4), .instr_out(p12_instr),
        .imm_out(p12_imm), .rs1_out(p12_rs1), .rs2_out(p12_rs2), .rd_out(p12_rd),
        .prs1_out(p12_ps1), .prs2_out(p12_ps2), .prd_out(p12_pd),
        .rob_idx_out(p12_rob), .rs_slot_out(p12_rss), .lsq_slot_out(p12_lsq),
        .funct3_out(p12_f3), .reg_write_out(p12_rw), .mem_read_out(p12_mr),
        .mem_write_out(p12_mw), .mem_to_reg_out(p12_m2r), .alu_src_out(p12_asrc),
        .branch_out(p12_br), .jump_out(p12_jmp), .is_jalr_out(p12_jalr),
        .use_pc_a_out(p12_upc), .pred_taken_out(p12_pred), .alu_ctrl_out(p12_alu),
        .rs1_val_out(p12_r1v), .rs2_val_out(p12_r2v), .alu_result_out(p12_alur),
        .mem_rdata_out(dmem_rdata), .branch_taken_out(p12_bt), .branch_target_out(p12_btgt)
    );

    pipe_lane_reg r1213 (
        .clk(clk), .rst_n(rst_n), .stall(global_stall), .flush(1'b0),
        .valid_in(p12_v), .stage_id_in(`STAGE_DC2),
        .pc_in(p12_pc), .pc_plus4_in(p12_p4), .instr_in(p12_instr),
        .imm_in(p12_imm), .rs1_in(p12_rs1), .rs2_in(p12_rs2), .rd_in(p12_rd),
        .prs1_in(p12_ps1), .prs2_in(p12_ps2), .prd_in(p12_pd),
        .rob_idx_in(p12_rob), .rs_slot_in(p12_rss), .lsq_slot_in(p12_lsq),
        .funct3_in(p12_f3), .reg_write_in(p12_rw), .mem_read_in(p12_mr),
        .mem_write_in(p12_mw), .mem_to_reg_in(p12_m2r), .alu_src_in(p12_asrc),
        .branch_in(p12_br), .jump_in(p12_jmp), .is_jalr_in(p12_jalr),
        .use_pc_a_in(p12_upc), .pred_taken_in(p12_pred), .alu_ctrl_in(p12_alu),
        .rs1_val_in(p12_r1v), .rs2_val_in(p12_r2v), .alu_result_in(p12_alur),
        .mem_rdata_in(p12_mrd), .branch_taken_in(p12_bt), .branch_target_in(p12_btgt),
        .valid_out(p13_v), .stage_id_out(p13_sid),
        .pc_out(p13_pc), .pc_plus4_out(p13_p4), .instr_out(p13_instr),
        .imm_out(p13_imm), .rs1_out(p13_rs1), .rs2_out(p13_rs2), .rd_out(p13_rd),
        .prs1_out(p13_ps1), .prs2_out(p13_ps2), .prd_out(p13_pd),
        .rob_idx_out(p13_rob), .rs_slot_out(p13_rss), .lsq_slot_out(p13_lsq),
        .funct3_out(p13_f3), .reg_write_out(p13_rw), .mem_read_out(p13_mr),
        .mem_write_out(p13_mw), .mem_to_reg_out(p13_m2r), .alu_src_out(p13_asrc),
        .branch_out(p13_br), .jump_out(p13_jmp), .is_jalr_in(p13_jalr),
        .use_pc_a_out(p13_upc), .pred_taken_out(p13_pred), .alu_ctrl_out(p13_alu),
        .rs1_val_out(p13_r1v), .rs2_val_out(p13_r2v), .alu_result_out(p13_alur),
        .mem_rdata_out(p13_mrd), .branch_taken_out(p13_bt), .branch_target_out(p13_btgt)
    );

    // S13 WB
    wire [31:0] wb_val = p13_m2r ? p13_mrd : p13_alur;
    wire pipe_wb_valid = p13_v && p13_rw;
    wire [4:0] pipe_wb_rob = p13_rob;
    wire [5:0] pipe_wb_prd = p13_pd;
    wire [31:0] pipe_wb_wdata = wb_val;

    pipe_lane_reg r1314 (
        .clk(clk), .rst_n(rst_n), .stall(global_stall), .flush(1'b0),
        .valid_in(p13_v), .stage_id_in(`STAGE_WB),
        .pc_in(p13_pc), .pc_plus4_in(p13_p4), .instr_in(p13_instr),
        .imm_in(p13_imm), .rs1_in(p13_rs1), .rs2_in(p13_rs2), .rd_in(p13_rd),
        .prs1_in(p13_ps1), .prs2_in(p13_ps2), .prd_in(p13_pd),
        .rob_idx_in(p13_rob), .rs_slot_in(p13_rss), .lsq_slot_in(p13_lsq),
        .funct3_in(p13_f3), .reg_write_in(p13_rw), .mem_read_in(p13_mr),
        .mem_write_in(p13_mw), .mem_to_reg_in(p13_m2r), .alu_src_in(p13_asrc),
        .branch_in(p13_br), .jump_in(p13_jmp), .is_jalr_in(p13_jalr),
        .use_pc_a_in(p13_upc), .pred_taken_in(p13_pred), .alu_ctrl_in(p13_alu),
        .rs1_val_in(p13_r1v), .rs2_val_in(p13_r2v), .alu_result_in(wb_val),
        .mem_rdata_in(p13_mrd), .branch_taken_in(p13_bt), .branch_target_in(p13_btgt),
        .valid_out(p14_v), .stage_id_out(p14_sid),
        .pc_out(p14_pc), .pc_plus4_out(p14_p4), .instr_out(p14_instr),
        .imm_out(p14_imm), .rs1_out(p14_rs1), .rs2_out(p14_rs2), .rd_out(p14_rd),
        .prs1_out(p14_ps1), .prs2_out(p14_ps2), .prd_out(p14_pd),
        .rob_idx_out(p14_rob), .rs_slot_out(p14_rss), .lsq_slot_out(p14_lsq),
        .funct3_out(p14_f3), .reg_write_out(p14_rw), .mem_read_out(p14_mr),
        .mem_write_out(p14_mw), .mem_to_reg_out(p14_m2r), .alu_src_out(p14_asrc),
        .branch_out(p14_br), .jump_out(p14_jmp), .is_jalr_out(p14_jalr),
        .use_pc_a_out(p14_upc), .pred_taken_out(p14_pred), .alu_ctrl_out(p14_alu),
        .rs1_val_out(p14_r1v), .rs2_val_out(p14_r2v), .alu_result_out(p14_alur),
        .mem_rdata_out(p14_mrd), .branch_taken_out(p14_bt), .branch_target_out(p14_btgt)
    );

    assign stage_debug = p14_sid;

    // S14 RETIRE — architectural commit
    arch_regfile u_arf (
        .clk(clk), .rst_n(rst_n),
        .we(rob_commit_valid), .waddr(rob_commit_rd), .wdata(rob_commit_val),
        .raddr1(5'd0), .raddr2(5'd0), .rdata1(), .rdata2()
    );

endmodule
