`include "include/riscv_defs.vh"

// Top-level RV32I 5-stage pipelined core (IF → ID → EX → MEM → WB).
// Features: data forwarding, load-use stall, branch/jump flush.
module riscv_core #(
    parameter IMEM_ADDR_WIDTH = 10,
    parameter DMEM_ADDR_WIDTH = 10,
    parameter RESET_PC        = 32'h0000_0000,
    parameter IMEM_INIT_FILE  = ""
) (
    input  wire        clk,
    input  wire        rst_n,
    output wire [31:0] pc_debug,
    output wire [31:0] instr_debug,
    output wire        stall_debug,
    output wire        flush_debug
);
    // ======================== IF stage ========================
    wire [31:0] pc, pc_plus4, instr_if;
    wire [31:0] pc_next;
    wire        pc_write, if_id_write, id_ex_flush, if_id_flush, stall;

    pc_reg #(
        .RESET_PC(RESET_PC)
    ) u_pc (
        .clk(clk), .rst_n(rst_n), .write_enable(pc_write),
        .next_pc(pc_next), .pc(pc)
    );

    assign pc_plus4 = pc + 32'd4;

    instr_mem #(
        .ADDR_WIDTH(IMEM_ADDR_WIDTH),
        .INIT_FILE(IMEM_INIT_FILE)
    ) u_imem (
        .addr(pc), .instr(instr_if)
    );

    // ======================== IF/ID ========================
    wire [31:0] if_id_pc, if_id_pc_plus4, if_id_instr;

    if_id_reg u_if_id (
        .clk(clk), .rst_n(rst_n), .write_enable(if_id_write), .flush(if_id_flush),
        .pc_in(pc), .pc_plus4_in(pc_plus4), .instr_in(instr_if),
        .pc_out(if_id_pc), .pc_plus4_out(if_id_pc_plus4), .instr_out(if_id_instr)
    );

    // ======================== ID stage ========================
    wire [6:0] opcode  = if_id_instr[6:0];
    wire [4:0] rd      = if_id_instr[11:7];
    wire [2:0] funct3  = if_id_instr[14:12];
    wire [4:0] rs1     = if_id_instr[19:15];
    wire [4:0] rs2     = if_id_instr[24:20];
    wire [6:0] funct7  = if_id_instr[31:25];

    wire reg_write, mem_read, mem_write, mem_to_reg, alu_src, branch, jump, is_jalr, use_pc_a;
    wire [1:0] alu_op;
    wire [2:0] imm_type;
    wire [3:0] alu_ctrl;

    control_unit u_ctrl (
        .opcode(opcode), .funct3(funct3), .funct7(funct7),
        .reg_write(reg_write), .mem_read(mem_read), .mem_write(mem_write),
        .mem_to_reg(mem_to_reg), .alu_src(alu_src), .branch(branch),
        .jump(jump), .alu_op(alu_op), .imm_type(imm_type),
        .is_jalr(is_jalr), .use_pc_a(use_pc_a), .alu_ctrl(alu_ctrl)
    );

    wire [31:0] imm, rs1_data, rs2_data;

    imm_gen u_imm (
        .instr(if_id_instr), .imm_type(imm_type), .imm(imm)
    );

    regfile u_regfile (
        .clk(clk), .rst_n(rst_n),
        .we(mem_wb_reg_write), .raddr1(rs1), .raddr2(rs2),
        .waddr(mem_wb_rd), .wdata(wb_wdata), .rdata1(rs1_data), .rdata2(rs2_data)
    );

    // ======================== ID/EX ========================
    wire [31:0] id_ex_pc, id_ex_pc_plus4, id_ex_rs1, id_ex_rs2, id_ex_imm;
    wire [4:0]  id_ex_rs1_addr, id_ex_rs2_addr, id_ex_rd;
    wire [2:0]  id_ex_funct3;
    wire        id_ex_reg_write, id_ex_mem_read, id_ex_mem_write, id_ex_mem_to_reg;
    wire        id_ex_alu_src, id_ex_branch, id_ex_jump, id_ex_is_jalr, id_ex_use_pc_a;
    wire [3:0]  id_ex_alu_ctrl;

    id_ex_reg u_id_ex (
        .clk(clk), .rst_n(rst_n), .flush(id_ex_flush),
        .pc_in(if_id_pc), .pc_plus4_in(if_id_pc_plus4),
        .rs1_data_in(rs1_data), .rs2_data_in(rs2_data), .imm_in(imm),
        .rs1_addr_in(rs1), .rs2_addr_in(rs2), .rd_addr_in(rd), .funct3_in(funct3),
        .reg_write_in(reg_write), .mem_read_in(mem_read), .mem_write_in(mem_write),
        .mem_to_reg_in(mem_to_reg), .alu_src_in(alu_src), .branch_in(branch),
        .jump_in(jump), .is_jalr_in(is_jalr), .use_pc_a_in(use_pc_a),
        .alu_ctrl_in(alu_ctrl),
        .pc_out(id_ex_pc), .pc_plus4_out(id_ex_pc_plus4),
        .rs1_data_out(id_ex_rs1), .rs2_data_out(id_ex_rs2), .imm_out(id_ex_imm),
        .rs1_addr_out(id_ex_rs1_addr), .rs2_addr_out(id_ex_rs2_addr),
        .rd_addr_out(id_ex_rd), .funct3_out(id_ex_funct3),
        .reg_write_out(id_ex_reg_write), .mem_read_out(id_ex_mem_read),
        .mem_write_out(id_ex_mem_write), .mem_to_reg_out(id_ex_mem_to_reg),
        .alu_src_out(id_ex_alu_src), .branch_out(id_ex_branch),
        .jump_out(id_ex_jump), .is_jalr_out(id_ex_is_jalr),
        .use_pc_a_out(id_ex_use_pc_a), .alu_ctrl_out(id_ex_alu_ctrl)
    );

    // ======================== EX stage ========================
    wire [4:0]  ex_mem_rd, mem_wb_rd;
    wire        ex_mem_reg_write, mem_wb_reg_write;
    wire [1:0]  forward_a, forward_b;
    wire [31:0] ex_mem_alu_result, mem_wb_alu_result, mem_wb_mem_data, mem_wb_pc_plus4;
    wire        mem_wb_mem_to_reg;
    wire [31:0] wb_wdata;

    forwarding_unit u_fwd (
        .id_ex_rs1(id_ex_rs1_addr), .id_ex_rs2(id_ex_rs2_addr),
        .ex_mem_rd(ex_mem_rd), .ex_mem_reg_write(ex_mem_reg_write),
        .mem_wb_rd(mem_wb_rd), .mem_wb_reg_write(mem_wb_reg_write),
        .forward_a(forward_a), .forward_b(forward_b)
    );

  wire [31:0] fwd_ex_mem = ex_mem_alu_result;
  wire [31:0] fwd_mem_wb = mem_wb_mem_to_reg ? mem_wb_mem_data : mem_wb_alu_result;

    wire [31:0] rs1_fwd = (forward_a == `FWD_EXMEM) ? fwd_ex_mem :
                          (forward_a == `FWD_MEMWB) ? fwd_mem_wb : id_ex_rs1;
    wire [31:0] alu_a   = id_ex_use_pc_a ? id_ex_pc : rs1_fwd;
    wire [31:0] alu_b_operand = (forward_b == `FWD_EXMEM) ? fwd_ex_mem :
                                  (forward_b == `FWD_MEMWB) ? fwd_mem_wb : id_ex_rs2;
    wire [31:0] alu_b = id_ex_alu_src ? id_ex_imm : alu_b_operand;

    wire [31:0] alu_result;
    wire        alu_zero;

    alu u_alu (
        .a(alu_a), .b(alu_b), .alu_op(id_ex_alu_ctrl),
        .result(alu_result), .zero(alu_zero)
    );

    wire branch_taken_raw;
    branch_comp u_branch (
        .funct3(id_ex_funct3), .rs1_val(alu_a), .rs2_val(alu_b_operand),
        .taken(branch_taken_raw)
    );

    wire ex_branch_taken = id_ex_branch && branch_taken_raw;
    wire ex_jump         = id_ex_jump;

    wire [31:0] branch_target = id_ex_pc + id_ex_imm;
    wire [31:0] jalr_target   = (alu_a + id_ex_imm) & 32'hFFFF_FFFE;

    assign pc_next = ex_jump ? (id_ex_is_jalr ? jalr_target : branch_target) :
                     ex_branch_taken ? branch_target : pc_plus4;

    hazard_unit u_hazard (
        .id_ex_mem_read(id_ex_mem_read), .id_ex_rd(id_ex_rd),
        .if_id_rs1(rs1), .if_id_rs2(rs2),
        .ex_branch_taken(ex_branch_taken), .ex_jump(ex_jump),
        .pc_write(pc_write), .if_id_write(if_id_write),
        .id_ex_flush(id_ex_flush), .if_id_flush(if_id_flush), .stall(stall)
    );

    // ======================== EX/MEM ========================
    wire [31:0] ex_mem_rs2, ex_mem_pc_plus4;
    wire [2:0]  ex_mem_funct3;
    wire        ex_mem_mem_read, ex_mem_mem_write, ex_mem_mem_to_reg;

    wire [31:0] ex_mem_alu_in = id_ex_jump ? id_ex_pc_plus4 : alu_result;

    ex_mem_reg u_ex_mem (
        .clk(clk), .rst_n(rst_n),
        .alu_result_in(ex_mem_alu_in), .rs2_data_in(alu_b_operand),
        .pc_plus4_in(id_ex_pc_plus4), .rd_addr_in(id_ex_rd),
        .funct3_in(id_ex_funct3),
        .reg_write_in(id_ex_reg_write), .mem_read_in(id_ex_mem_read),
        .mem_write_in(id_ex_mem_write), .mem_to_reg_in(id_ex_mem_to_reg),
        .alu_result_out(ex_mem_alu_result), .rs2_data_out(ex_mem_rs2),
        .pc_plus4_out(ex_mem_pc_plus4), .rd_addr_out(ex_mem_rd),
        .funct3_out(ex_mem_funct3),
        .reg_write_out(ex_mem_reg_write), .mem_read_out(ex_mem_mem_read),
        .mem_write_out(ex_mem_mem_write), .mem_to_reg_out(ex_mem_mem_to_reg)
    );

    // ======================== MEM stage ========================
    wire [31:0] mem_read_data;

    data_mem #(
        .ADDR_WIDTH(DMEM_ADDR_WIDTH)
    ) u_dmem (
        .clk(clk), .mem_read(ex_mem_mem_read), .mem_write(ex_mem_mem_write),
        .funct3(ex_mem_funct3), .addr(ex_mem_alu_result),
        .wdata(ex_mem_rs2), .rdata(mem_read_data)
    );

    // ======================== MEM/WB ========================
    wire mem_wb_reg_write;

    mem_wb_reg u_mem_wb (
        .clk(clk), .rst_n(rst_n),
        .alu_result_in(ex_mem_alu_result), .mem_data_in(mem_read_data),
        .pc_plus4_in(ex_mem_pc_plus4), .rd_addr_in(ex_mem_rd),
        .reg_write_in(ex_mem_reg_write), .mem_to_reg_in(ex_mem_mem_to_reg),
        .alu_result_out(mem_wb_alu_result), .mem_data_out(mem_wb_mem_data),
        .pc_plus4_out(mem_wb_pc_plus4), .rd_addr_out(mem_wb_rd),
        .reg_write_out(mem_wb_reg_write), .mem_to_reg_out(mem_wb_mem_to_reg)
    );

  assign wb_wdata = mem_wb_mem_to_reg ? mem_wb_mem_data : mem_wb_alu_result;

    // Debug outputs
    assign pc_debug      = pc;
    assign instr_debug   = if_id_instr;
    assign stall_debug   = stall;
    assign flush_debug   = if_id_flush;

endmodule
