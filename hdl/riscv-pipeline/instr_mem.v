// Byte-addressable instruction memory (word-aligned reads).
module instr_mem #(
    parameter ADDR_WIDTH = 10,  // 1024 words = 4 KiB
    parameter INIT_FILE  = ""
) (
    input  wire [31:0] addr,
    output wire [31:0] instr
);
    reg [31:0] mem [0:(1<<ADDR_WIDTH)-1];
    integer i;

    initial begin
        for (i = 0; i < (1<<ADDR_WIDTH); i = i + 1)
            mem[i] = 32'h00000013; // NOP
        if (INIT_FILE != "")
            $readmemh(INIT_FILE, mem);
    end

    wire [ADDR_WIDTH-1:0] word_addr = addr[ADDR_WIDTH+1:2];
    assign instr = mem[word_addr];
endmodule
