`include "include/pipe_types.vh"

// Load-Store Queue — disambiguates memory ops (industry L1D interface).
module lsq (
    input  wire        clk,
    input  wire        rst_n,
    input  wire        alloc_valid,
    input  wire        alloc_is_store,
    input  wire [31:0] alloc_addr,
    input  wire [31:0] alloc_wdata,
    input  wire        exec_valid,
    input  wire [2:0]  exec_slot,
    output wire        alloc_ready,
    output wire [2:0]  alloc_slot
);
    reg        valid [0:`LSQ_DEPTH-1];
    reg        is_st [0:`LSQ_DEPTH-1];
    reg [31:0] addr  [0:`LSQ_DEPTH-1];
    reg [31:0] wdata [0:`LSQ_DEPTH-1];
    reg [2:0]  tail;

    wire [2:0] count;
    assign alloc_ready = (tail < `LSQ_DEPTH);
    assign alloc_slot  = tail;

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            tail <= 0;
        end else if (alloc_valid && alloc_ready) begin
            valid[tail] <= 1'b1;
            is_st[tail] <= alloc_is_store;
            addr[tail]  <= alloc_addr;
            wdata[tail] <= alloc_wdata;
            tail <= tail + 1'b1;
        end else if (exec_valid) begin
            valid[exec_slot] <= 1'b0;
        end
    end
endmodule
