// EX/MEM pipeline register.
module ex_mem_reg (
    input  wire        clk,
    input  wire        rst_n,
    input  wire [31:0] alu_result_in,
    input  wire [31:0] rs2_data_in,
    input  wire [31:0] pc_plus4_in,
    input  wire [4:0]  rd_addr_in,
    input  wire [2:0]  funct3_in,
    input  wire        reg_write_in,
    input  wire        mem_read_in,
    input  wire        mem_write_in,
    input  wire        mem_to_reg_in,
    output reg  [31:0] alu_result_out,
    output reg  [31:0] rs2_data_out,
    output reg  [31:0] pc_plus4_out,
    output reg  [4:0]  rd_addr_out,
    output reg  [2:0]  funct3_out,
    output reg         reg_write_out,
    output reg         mem_read_out,
    output reg         mem_write_out,
    output reg         mem_to_reg_out
);
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            alu_result_out <= 0; rs2_data_out <= 0; pc_plus4_out <= 0;
            rd_addr_out <= 0; funct3_out <= 0;
            reg_write_out <= 0; mem_read_out <= 0;
            mem_write_out <= 0; mem_to_reg_out <= 0;
        end else begin
            alu_result_out <= alu_result_in;
            rs2_data_out   <= rs2_data_in;
            pc_plus4_out   <= pc_plus4_in;
            rd_addr_out    <= rd_addr_in;
            funct3_out     <= funct3_in;
            reg_write_out  <= reg_write_in;
            mem_read_out   <= mem_read_in;
            mem_write_out  <= mem_write_in;
            mem_to_reg_out <= mem_to_reg_in;
        end
    end
endmodule
