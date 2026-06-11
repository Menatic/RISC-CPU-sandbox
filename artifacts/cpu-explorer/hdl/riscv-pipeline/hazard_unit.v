// Hazard detection: load-use stall + branch/jump flush.
module hazard_unit (
    input  wire        id_ex_mem_read,
    input  wire [4:0]  id_ex_rd,
    input  wire [4:0]  if_id_rs1,
    input  wire [4:0]  if_id_rs2,
    input  wire        ex_branch_taken,
    input  wire        ex_jump,
    output wire        pc_write,
    output wire        if_id_write,
    output wire        id_ex_flush,
    output wire        if_id_flush,
    output wire        stall
);
    wire load_use =
        id_ex_mem_read &&
        (id_ex_rd != 5'd0) &&
        ((id_ex_rd == if_id_rs1) || (id_ex_rd == if_id_rs2));

    assign stall       = load_use;
    assign pc_write    = ~stall;
    assign if_id_write = ~stall;
    assign id_ex_flush = stall;
    assign if_id_flush = ex_branch_taken || ex_jump;
endmodule
