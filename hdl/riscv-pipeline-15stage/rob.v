`include "include/pipe_types.vh"

// Reorder Buffer — in-order commit, out-of-order completion ready (industry OOO backend).
module rob (
    input  wire        clk,
    input  wire        rst_n,
    input  wire        alloc_valid,
    input  wire [4:0]  alloc_rd,
    input  wire [5:0]  alloc_prd,
    input  wire        complete_valid,
    input  wire [4:0]  complete_idx,
    input  wire [31:0] complete_value,
    input  wire        commit_ready,
    output wire        alloc_idx,
    output wire        commit_valid,
    output wire [4:0]  commit_rd,
    output wire [31:0] commit_value,
    output wire        rob_full
);
    reg [4:0]  rob_rd   [0:`ROB_DEPTH-1];
    reg [5:0]  rob_prd  [0:`ROB_DEPTH-1];
    reg [31:0] rob_val  [0:`ROB_DEPTH-1];
    reg        rob_done [0:`ROB_DEPTH-1];
    reg [4:0]  head, tail;
    reg [4:0]  count;

    assign alloc_idx    = tail;
    assign rob_full     = (count == `ROB_DEPTH);
    assign commit_valid = (count > 0) && rob_done[head];
    assign commit_rd    = rob_rd[head];
    assign commit_value = rob_val[head];

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            head <= 0; tail <= 0; count <= 0;
        end else begin
            if (alloc_valid && !rob_full) begin
                rob_rd[tail]   <= alloc_rd;
                rob_prd[tail]  <= alloc_prd;
                rob_done[tail] <= 1'b0;
                tail  <= tail + 1'b1;
                count <= count + 1'b1;
            end
            if (complete_valid)
                rob_done[complete_idx] <= 1'b1;
            if (complete_valid)
                rob_val[complete_idx] <= complete_value;
            if (commit_valid && commit_ready) begin
                head  <= head + 1'b1;
                count <= count - 1'b1;
            end
        end
    end
endmodule
