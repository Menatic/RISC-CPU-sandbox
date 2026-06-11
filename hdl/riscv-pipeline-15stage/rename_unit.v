`include "include/pipe_types.vh"

// Register Alias Table (RAT) + free list — Tomasulo-style rename (simplified in-order alloc).
module rename_unit (
    input  wire        clk,
    input  wire        rst_n,
    input  wire        alloc_valid,
    input  wire [4:0]  rs1_arch,
    input  wire [4:0]  rs2_arch,
    input  wire [4:0]  rd_arch,
    input  wire        rd_writes,
    output wire [5:0]  prs1,
    output wire [5:0]  prs2,
    output wire [5:0]  prd,
    output wire        stall_rename
);
    reg [5:0] rat [0:31];
    reg [5:0] free_ptr;
    reg [5:0] free_count;

    assign prs1 = (rs1_arch == 0) ? 6'd0 : rat[rs1_arch];
    assign prs2 = (rs2_arch == 0) ? 6'd0 : rat[rs2_arch];
    assign prd  = rat[rd_arch];
    assign stall_rename = rd_writes && (free_count == 0);

    integer i;
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            for (i = 0; i < 32; i = i + 1)
                rat[i] <= i[5:0]; // identity map at boot
            free_ptr  <= 6'd32;
            free_count <= 6'd32;
        end else if (alloc_valid && rd_writes && rd_arch != 0 && !stall_rename) begin
            rat[rd_arch] <= free_ptr;
            free_ptr  <= free_ptr + 1'b1;
            free_count <= free_count - 1'b1;
        end
    end
endmodule
