// 15-stage high-performance pipeline — architectural constants.
// Modeled after modern industry cores (deep front-end, rename/ROB backend).

`ifndef PIPE_TYPES_VH
`define PIPE_TYPES_VH

`define STAGE_PC_GEN   4'd0
`define STAGE_IF1      4'd1
`define STAGE_IF2      4'd2
`define STAGE_IQ       4'd3
`define STAGE_DECODE   4'd4
`define STAGE_RENAME   4'd5
`define STAGE_DISPATCH 4'd6
`define STAGE_ISSUE    4'd7
`define STAGE_REGREAD  4'd8
`define STAGE_EXE      4'd9
`define STAGE_AGU      4'd10
`define STAGE_DC1      4'd11
`define STAGE_DC2      4'd12
`define STAGE_WB       4'd13
`define STAGE_RETIRE   4'd14

`define IQ_DEPTH       8
`define ROB_DEPTH      32
`define RS_DEPTH       8
`define LSQ_DEPTH      8
`define PREG_COUNT     64
`define BTB_ENTRIES    64
`define BHT_ENTRIES    128

`endif
