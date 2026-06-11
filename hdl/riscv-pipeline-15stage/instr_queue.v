`include "include/pipe_types.vh"

// Decoupled front-end instruction queue (absorbs I-cache latency bubbles).
module instr_queue (
    input  wire        clk,
    input  wire        rst_n,
    input  wire        enq_valid,
    input  wire [31:0] enq_pc,
    input  wire [31:0] enq_instr,
    input  wire        deq_ready,
    output wire        enq_ready,
    output wire        deq_valid,
    output wire [31:0] deq_pc,
    output wire [31:0] deq_instr,
    output wire [3:0]  occupancy
);
    reg [31:0] q_pc   [0:`IQ_DEPTH-1];
    reg [31:0] q_instr[0:`IQ_DEPTH-1];
    reg [3:0]  head, tail, count;

    assign occupancy = count;
    assign enq_ready = (count < `IQ_DEPTH);
    assign deq_valid = (count > 0);
    assign deq_pc    = q_pc[head];
    assign deq_instr = q_instr[head];

    wire do_enq = enq_valid && enq_ready;
    wire do_deq = deq_valid && deq_ready;

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            head <= 0; tail <= 0; count <= 0;
        end else begin
            if (do_deq)
                head <= head + 1'b1;
            if (do_enq) begin
                q_pc[tail]    <= enq_pc;
                q_instr[tail] <= enq_instr;
                tail <= tail + 1'b1;
            end
            case ({do_enq, do_deq})
                2'b10: count <= count + 1'b1;
                2'b01: count <= count - 1'b1;
                default: count <= count;
            endcase
        end
    end
endmodule
