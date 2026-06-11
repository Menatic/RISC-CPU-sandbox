export const examplePrograms = [
  {
    id: 'hello',
    name: 'Hello Arithmetic',
    category: 'Beginner',
    description: 'Basic add, subtract, multiply, divide. Perfect starting point.',
    code: `# Hello Arithmetic — Basic operations on registers
# Registers hold numbers like variables in any programming language

ADDI  a0, zero, 12      # a0 = 12  (load the number 12)
ADDI  a1, zero, 7       # a1 = 7   (load the number 7)

ADD   a2, a0, a1        # a2 = a0 + a1 = 19
SUB   a3, a0, a1        # a3 = a0 - a1 = 5
MUL   a4, a0, a1        # a4 = a0 * a1 = 84
DIV   a5, a0, a1        # a5 = a0 / a1 = 1
REM   a6, a0, a1        # a6 = a0 mod a1 = 5

# Bitwise operations
AND   t0, a0, a1        # t0 = 12 AND 7 = 4  (0b1100 & 0b0111 = 0b0100)
OR    t1, a0, a1        # t1 = 12 OR 7  = 15 (0b1100 | 0b0111 = 0b1111)
XOR   t2, a0, a1        # t2 = 12 XOR 7 = 11 (0b1100 ^ 0b0111 = 0b1011)
`,
  },
  {
    id: 'fibonacci',
    name: 'Fibonacci Loop',
    category: 'Beginner',
    description: 'Computes Fibonacci numbers 0–7 using a loop with BNE branch.',
    code: `# Fibonacci Sequence: F(0)=0, F(1)=1, F(n)=F(n-1)+F(n-2)
# We compute F(0) through F(7)

ADDI  a0, zero, 0       # a0 = previous (F(n-2)) = 0
ADDI  a1, zero, 1       # a1 = current  (F(n-1)) = 1
ADDI  t0, zero, 7       # t0 = loop counter (7 iterations)

loop:
  ADD   t1, a0, a1      # t1 = a0 + a1 (next Fibonacci number)
  ADDI  a0, a1, 0       # a0 = a1  (shift: prev = curr)
  ADDI  a1, t1, 0       # a1 = t1  (shift: curr = next)
  ADDI  t0, t0, -1      # decrement counter
  BNE   t0, zero, loop  # if counter != 0, loop again

# When done: a1 = F(8) = 21
`,
  },
  {
    id: 'factorial',
    name: 'Factorial (n!)',
    category: 'Beginner',
    description: 'Computes 5! = 120 using a countdown loop.',
    code: `# Factorial: computes n! iteratively
# Result stored in a0

ADDI  t0, zero, 5       # t0 = n = 5 (compute 5!)
ADDI  a0, zero, 1       # a0 = result = 1 (accumulator)

loop:
  BEQ   t0, zero, done  # if n == 0, we are done
  MUL   a0, a0, t0      # result = result * n
  ADDI  t0, t0, -1      # n = n - 1
  JAL   zero, loop      # jump back to loop

done:
  # a0 = 5! = 120
`,
  },
  {
    id: 'gcd',
    name: 'GCD (Euclidean)',
    category: 'Intermediate',
    description: 'Greatest Common Divisor of two numbers via Euclidean algorithm.',
    code: `# GCD using the Euclidean algorithm
# Input:  a0 = 48, a1 = 18
# Output: a0 = GCD(48, 18) = 6

ADDI  a0, zero, 48      # a0 = 48
ADDI  a1, zero, 18      # a1 = 18

loop:
  BEQ   a1, zero, done  # if b == 0, GCD found in a0
  REM   t0, a0, a1      # t0 = a mod b
  ADDI  a0, a1, 0       # a = b
  ADDI  a1, t0, 0       # b = a mod b
  JAL   zero, loop      # repeat

done:
  # a0 = GCD(48, 18) = 6
`,
  },
  {
    id: 'sum_array',
    name: 'Sum an Array',
    category: 'Intermediate',
    description: 'Stores 5 values in memory and sums them with a load loop.',
    code: `# Sum an array: stores 5 values, then loads and sums them
# Uses SW (store word) and LW (load word)

# Store array values at addresses 0, 4, 8, 12, 16
ADDI  t0, zero, 10      # value 0
SW    t0, 0(zero)       # memory[0] = 10
ADDI  t0, zero, 20
SW    t0, 4(zero)       # memory[4] = 20
ADDI  t0, zero, 30
SW    t0, 8(zero)       # memory[8] = 30
ADDI  t0, zero, 40
SW    t0, 12(zero)      # memory[12] = 40
ADDI  t0, zero, 50
SW    t0, 16(zero)      # memory[16] = 50

# Sum the array: a0 = sum, t1 = pointer, t2 = end
ADDI  a0, zero, 0       # sum = 0
ADDI  t1, zero, 0       # pointer = 0 (start of array)
ADDI  t2, zero, 20      # end = 20 (5 elements × 4 bytes)

loop:
  BGE   t1, t2, done    # if pointer >= end, stop
  LW    t0, 0(t1)       # load memory[pointer] into t0
  ADD   a0, a0, t0      # sum += t0
  ADDI  t1, t1, 4       # advance pointer by 4 bytes
  JAL   zero, loop

done:
  # a0 = 10+20+30+40+50 = 150
`,
  },
  {
    id: 'find_max',
    name: 'Find Maximum',
    category: 'Intermediate',
    description: 'Finds the maximum of 5 values using BLT (branch if less than).',
    code: `# Find the maximum of 5 values
# Uses BLT (branch if less than) for comparison

ADDI  a0, zero, 17      # a0 = current max = 17
ADDI  t1, zero, 42      # t1 = next value
BLT   a0, t1, update1   # if max < t1, update
JAL   zero, skip1
update1: ADDI a0, t1, 0
skip1:

ADDI  t1, zero, 8
BLT   a0, t1, update2
JAL   zero, skip2
update2: ADDI a0, t1, 0
skip2:

ADDI  t1, zero, 99
BLT   a0, t1, update3
JAL   zero, skip3
update3: ADDI a0, t1, 0
skip3:

ADDI  t1, zero, 33
BLT   a0, t1, update4
JAL   zero, skip4
update4: ADDI a0, t1, 0
skip4:

# a0 = maximum = 99
`,
  },
  {
    id: 'bitcount',
    name: 'Population Count',
    category: 'Advanced',
    description: 'Counts the number of 1-bits in a 32-bit number (Brian Kernighan algorithm).',
    code: `# Population Count: count 1-bits in a word
# Brian Kernighan's algorithm: n & (n-1) clears lowest set bit
# Input:  t0 = 0b10110101 = 181  (has 5 set bits)
# Output: a0 = 5

ADDI  t0, zero, 181     # number to count bits of (0b10110101)
ADDI  a0, zero, 0       # a0 = bit count = 0

loop:
  BEQ   t0, zero, done  # if t0 == 0, all bits counted
  ADDI  t1, t0, -1      # t1 = t0 - 1  (clears lowest set bit)
  AND   t0, t0, t1      # t0 = t0 AND (t0-1)  (one fewer set bit)
  ADDI  a0, a0, 1       # increment count
  JAL   zero, loop

done:
  # a0 = 5 (five 1-bits in 181)
`,
  },
  {
    id: 'power',
    name: 'Power Function',
    category: 'Advanced',
    description: 'Computes base^exponent using repeated multiplication.',
    code: `# Power function: computes base ^ exponent
# Input:  a0 = base = 3, a1 = exponent = 4
# Output: a2 = result = 81

ADDI  a0, zero, 3       # base = 3
ADDI  a1, zero, 4       # exponent = 4
ADDI  a2, zero, 1       # result = 1

loop:
  BEQ   a1, zero, done  # if exponent == 0, done
  MUL   a2, a2, a0      # result *= base
  ADDI  a1, a1, -1      # exponent--
  JAL   zero, loop

done:
  # a2 = 3^4 = 81
`,
  },
  {
    id: 'hazards_demo',
    name: 'Pipeline Hazards Demo',
    category: 'Advanced — Pipeline',
    description: 'Demonstrates RAW hazard (forwarding), load-use stall, and branch penalty in the pipeline.',
    code: `# Pipeline Hazards Demonstration
# Run this in the Pipeline view to see real-time hazard detection

# Section 1: RAW hazard resolved by forwarding (EX→EX)
ADDI  t0, zero, 5       # t0 = 5
ADD   t1, t0, t0        # t1 = t0 + t0  ← RAW on t0 (forwarded, no stall)
ADD   t2, t1, t0        # t2 = t1 + t0  ← RAW on t1 (forwarded from EX/MEM)

# Section 2: Load-Use hazard (always 1 stall, cannot forward)
SW    t2, 0(zero)       # store t2 to memory[0]
LW    t3, 0(zero)       # load from memory[0] into t3
ADD   t4, t3, t0        # t4 = t3 + t0  ← LOAD-USE stall! Data not ready yet

# Section 3: Branch causes 2-cycle flush if taken
ADDI  t5, zero, 1       # t5 = 1
BEQ   t5, t5, skip      # branch TAKEN → 2 instructions flushed from pipeline
ADDI  t6, zero, 99      # [flushed]
ADDI  t6, zero, 99      # [flushed]
skip:
ADDI  a0, zero, 42      # this is the real target
`,
  },
];
