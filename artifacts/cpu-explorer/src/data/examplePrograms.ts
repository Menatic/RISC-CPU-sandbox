export const examplePrograms = [
  {
    id: "fibonacci",
    name: "Fibonacci Sequence",
    description: "Calculates the 10th Fibonacci number iteratively.",
    code: `# Fibonacci (n=10)
ADDI x1, x0, 10      # n = 10
ADDI x2, x0, 0       # a = 0
ADDI x3, x0, 1       # b = 1
ADDI x4, x0, 0       # i = 0

# loop:
# BGE x4, x1, end
ADD x5, x2, x3       # c = a + b
ADD x2, x0, x3       # a = b
ADD x3, x0, x5       # b = c
ADDI x4, x4, 1       # i++
# JAL x0, loop

# end:
`
  },
  {
    id: "basic",
    name: "Basic Arithmetic",
    description: "Simple add and subtract operations.",
    code: `ADDI x1, x0, 5
ADDI x2, x0, 10
ADD x3, x1, x2
SUB x4, x2, x1
`
  }
];
