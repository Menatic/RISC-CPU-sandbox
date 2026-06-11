`include "include/pipe_types.vh"

// Branch Target Buffer + 2-bit saturating BHT (industry-standard front-end predictor).
module btb_bht (
    input  wire        clk,
    input  wire        rst_n,
    input  wire [31:0] fetch_pc,
    input  wire        update_valid,
    input  wire [31:0] update_pc,
    input  wire        update_taken,
    input  wire [31:0] update_target,
    output wire        pred_taken,
    output wire [31:0] pred_target,
    output wire        pred_valid
);
    reg [31:0] btb_pc   [`BTB_ENTRIES-1:0];
    reg [31:0] btb_tgt  [`BTB_ENTRIES-1:0];
    reg [1:0]  bht      [`BHT_ENTRIES-1:0];

    wire [$clog2(`BTB_ENTRIES)-1:0] btb_idx = fetch_pc[$clog2(`BTB_ENTRIES)+1:2];
    wire [$clog2(`BHT_ENTRIES)-1:0] bht_idx = fetch_pc[$clog2(`BHT_ENTRIES)+1:2];
    wire [$clog2(`BTB_ENTRIES)-1:0] upd_btb = update_pc[$clog2(`BTB_ENTRIES)+1:2];
    wire [$clog2(`BHT_ENTRIES)-1:0] upd_bht = update_pc[$clog2(`BHT_ENTRIES)+1:2];

    integer i;
    initial begin
        for (i = 0; i < `BTB_ENTRIES; i = i + 1) begin
            btb_pc[i]  = 32'd0;
            btb_tgt[i] = 32'd0;
        end
        for (i = 0; i < `BHT_ENTRIES; i = i + 1)
            bht[i] = 2'b01;
    end

    assign pred_valid  = (btb_pc[btb_idx] == fetch_pc);
    assign pred_taken  = pred_valid && (bht[bht_idx][1] == 1'b1);
    assign pred_target = btb_tgt[btb_idx];

    always @(posedge clk) begin
        if (!rst_n) begin
            for (i = 0; i < `BHT_ENTRIES; i = i + 1)
                bht[i] <= 2'b01;
        end else if (update_valid) begin
            btb_pc[upd_btb]  <= update_pc;
            btb_tgt[upd_btb] <= update_target;
            case (bht[upd_bht])
                2'b00: bht[upd_bht] <= update_taken ? 2'b01 : 2'b00;
                2'b01: bht[upd_bht] <= update_taken ? 2'b10 : 2'b00;
                2'b10: bht[upd_bht] <= update_taken ? 2'b11 : 2'b01;
                2'b11: bht[upd_bht] <= update_taken ? 2'b11 : 2'b10;
            endcase
        end
    end
endmodule
