export const interviewQuestions = [
  {
    id: "q1",
    level: "Beginner",
    question: "What is a CPU pipeline?",
    answer: "A CPU pipeline is an implementation technique where multiple instructions are overlapped in execution. The computer pipeline is divided into stages. Each stage completes a part of an instruction in parallel. The stages are connected one to the next to form a pipe - instructions enter at one end, progress through the stages, and exit at the other end.",
  },
  {
    id: "q2",
    level: "Beginner",
    question: "What is CPI?",
    answer: "Cycles Per Instruction (CPI) is a metric used to evaluate CPU performance. It represents the average number of clock cycles required to execute each instruction in a given program. A lower CPI means the processor is more efficient.",
  },
  {
    id: "q3",
    level: "Intermediate",
    question: "Explain RAW hazards.",
    answer: "A Read-After-Write (RAW) hazard, or true data dependence, occurs when an instruction needs to read a register that has not yet been written to by an earlier, currently executing instruction. If not handled (e.g., via forwarding or stalling), the newer instruction will read stale data.",
  },
  {
    id: "q4",
    level: "Intermediate",
    question: "How does forwarding work?",
    answer: "Data forwarding (or bypassing) is an optimization that resolves RAW data hazards by routing the result of a computation directly from the EX/MEM or MEM/WB pipeline registers to the ALU input (EX stage) for the next instruction, bypassing the register file and avoiding a pipeline stall.",
  },
  {
    id: "q5",
    level: "Advanced",
    question: "Explain Tomasulo's algorithm.",
    answer: "Tomasulo's algorithm is a hardware algorithm for dynamic scheduling of instructions that allows out-of-order execution. It tracks dependencies using Reservation Stations and Common Data Buses. It uses Register Renaming to eliminate WAR and WAW hazards, allowing instructions to execute as soon as their operands are ready.",
  },
  {
    id: "q6",
    level: "Advanced",
    question: "What is register renaming?",
    answer: "Register renaming is a technique used in out-of-order processors to eliminate false data dependencies (WAR and WAW hazards). It dynamically maps architectural registers (like x1, x2) to a larger set of physical registers. This allows multiple instructions to use the same architectural register without actually interfering with each other in hardware.",
  },
  {
    id: "q7",
    level: "Expert",
    question: "Compare tournament vs GShare predictors.",
    answer: "A GShare predictor XORs the global branch history with the PC to index into a pattern history table, which works well for correlating branches. A Tournament predictor maintains two separate predictors (often a local and a global/GShare) and a meta-predictor that learns which of the two is more accurate for a specific branch, using the better prediction dynamically.",
  },
  {
    id: "q8",
    level: "Expert",
    question: "Describe the Spectre vulnerability.",
    answer: "Spectre is a hardware vulnerability that exploits speculative execution and branch prediction. An attacker tricks the processor into speculatively executing an incorrect path that accesses secret data. Although the processor later discards the speculative results, the secret data leaves a footprint in the cache, which the attacker can extract using side-channel timing analysis.",
  }
];
