// Program counter with synchronous reset and enable (for stalls).
module pc_reg #(
    parameter RESET_PC = 32'h0000_0000
) (
    input  wire        clk,
    input  wire        rst_n,
    input  wire        write_enable,
    input  wire [31:0] next_pc,
    output reg  [31:0] pc
);
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n)
            pc <= RESET_PC;
        else if (write_enable)
            pc <= next_pc;
    end
endmodule
