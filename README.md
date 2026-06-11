# 🚀 Modern CPU Explorer

> A next-generation interactive computer architecture laboratory that transforms CPU design from static diagrams into a fully visual, executable, and explorable experience.

Modern CPU Explorer is an advanced browser-based platform designed to help students, educators, engineers, and recruiters understand how modern processors actually work.

Instead of presenting CPU architecture as textbook diagrams, Modern CPU Explorer allows users to write RISC-V assembly code, execute programs cycle-by-cycle, inspect internal processor state, visualize pipeline behavior, analyze hazards, explore forwarding paths, and understand advanced concepts such as branch prediction, superscalar execution, speculative execution, and out-of-order processing.
---

# 🌐 Live Demo

Try the application:
https://your-vercel-link.vercel.app

---

# 🎯 Vision

Modern CPU Explorer was built around a simple question:

**"What if learning computer architecture felt like using a professional engineering tool instead of reading a textbook?"**

The platform combines:

* Interactive Simulation
* Visual Learning
* Performance Analysis
* Architecture Exploration
* Real Program Execution

into a single modern web application.

---

# ✨ Core Features

## 🧠 Interactive RISC-V IDE

A fully integrated assembly programming environment powered by Monaco Editor.

### Capabilities

* Write custom RISC-V assembly programs
* Execute instructions cycle-by-cycle
* Run programs to completion
* Inspect execution state in real time
* View instruction-level behavior

### Included Examples

* Fibonacci
* Bubble Sort
* Binary Search
* Prime Numbers
* Matrix Operations
* Algorithm Demonstrations

---

## ⚙️ Pipeline Visualization Engine

Watch instructions travel through a processor pipeline in real time.

### Pipeline Stages

* Instruction Fetch (IF)
* Instruction Decode (ID)
* Execute (EX)
* Memory Access (MEM)
* Write Back (WB)

### Visual Behaviors

* Instruction movement
* Pipeline stalls
* Forwarding events
* Flush operations
* Retirement tracking

This allows users to understand exactly what happens during execution instead of imagining pipeline behavior from static diagrams.

---

## 🔍 Hazard Analysis Laboratory

Explore how processors detect and resolve dependencies.

### Supported Hazard Types

#### Data Hazards

* RAW (Read After Write)
* WAR (Write After Read)
* WAW (Write After Write)

#### Control Hazards

* Branch Dependencies
* Pipeline Flushes

#### Structural Hazards

* Resource Conflicts
* Execution Unit Contention

Visual indicators explain:

* Why hazards occur
* Where they occur
* How they impact performance

---

## 🔄 Forwarding Visualizer

Understand how modern processors avoid unnecessary stalls.

### Supported Paths

* EX → EX
* MEM → EX
* WB → EX

The simulator highlights active forwarding paths during execution and demonstrates how forwarding improves throughput.

---

## 📈 Execution Trace Explorer

Inspect every instruction that executes.

For each instruction:

* Assembly Representation
* Binary Encoding
* Program Counter
* Register Updates
* Memory Accesses
* Pipeline Activity

This provides complete transparency into processor behavior.

---

## 🗄 Register & Memory Inspector

Observe architectural state in real time.

### Register View

* Integer Registers
* Current Values
* Change Tracking

### Memory View

* Address Space Inspection
* Live Updates
* Program Data Visualization

---

# 🏛 Architecture Learning Center

Modern CPU Explorer is not only a simulator.

It is also an educational architecture platform.

Dedicated modules explain:

### CPU Fundamentals

* Single Cycle Architectures
* Multi Cycle Architectures
* Pipelining

### Performance Topics

* Hazards
* Forwarding
* Branch Prediction
* Pipeline Optimization

### Advanced Processor Design

* Superscalar Execution
* Out-of-Order Processing
* Register Renaming
* Speculative Execution

### Memory Systems

* Cache Hierarchies
* Memory Latency
* Locality Principles

Each topic combines:

* Visual Diagrams
* Interactive Examples
* Educational Explanations
* Practical Demonstrations

---

# 📊 Performance Analysis

The simulator continuously tracks execution metrics.

### Metrics

* Total Cycles
* Instructions Executed
* CPI
* IPC
* Hazard Counts
* Stall Events
* Forwarding Events
* Pipeline Utilization

These insights help users understand not just correctness but performance.

---

# 🏗 Technical Architecture

## Frontend

* React
* TypeScript
* Vite
* Zustand
* Tailwind CSS
* Monaco Editor

## Backend

* Express
* Zod Validation

## Development Goals

* Fast Interaction
* Modular Design
* Scalable Architecture
* Educational Clarity
* Production Deployment

---

# 📂 Repository Structure

```text
artifacts/
├── cpu-explorer/
│   ├── src/
│   ├── public/
│   └── dist/

├── api-server/
│   ├── routes/
│   ├── middleware/
│   └── services/

lib/
├── api-client-react/
├── api-spec/
├── api-zod/

scripts/
└── vite-compat.mjs
```

---

# 🚀 Local Development

## Frontend

```bash
cd artifacts/cpu-explorer
npm install
npm run dev
```

Application:

```text
http://127.0.0.1:4173
```

---

## Backend

```bash
cd artifacts/api-server
npm install
npm run dev
```

Health Check:

```text
http://127.0.0.1:5000/api/healthz
```

---

# 📦 Production Build

Generate a production build:

```bash
cd artifacts/cpu-explorer
npm run build
```

Output:

```text
artifacts/cpu-explorer/dist
```

---

# ☁️ Deployment

The application is optimized for deployment on Vercel.

### Build Command

```bash
pnpm --filter @workspace/cpu-explorer run build
```

### Output Directory

```bash
artifacts/cpu-explorer/dist
```

Because the simulation engine runs primarily in the browser, the frontend can be deployed independently while preserving the full interactive experience.

---

# 🎓 Educational Impact

Modern CPU Explorer bridges the gap between:

| Traditional Learning | Modern CPU Explorer      |
| -------------------- | ------------------------ |
| Static diagrams      | Interactive execution    |
| Textbook examples    | Live simulations         |
| Passive learning     | Hands-on experimentation |
| Theory-focused       | Theory + implementation  |
| Abstract concepts    | Visual understanding     |

---

# 💼 Why This Project Matters

Modern CPU Explorer demonstrates proficiency in:

### Computer Architecture

* RISC-V
* Pipelining
* Hazards
* Forwarding
* Branching
* Performance Analysis

### Software Engineering

* React
* TypeScript
* State Management
* Frontend Architecture
* API Integration
* Developer Experience

### Product Engineering

* Educational Design
* Visualization Systems
* Interactive Simulations
* Complex State Modeling

This project was designed to showcase both systems-level knowledge and production-grade software engineering skills.

---

# 🔮 Roadmap

Future development includes:

* Branch Predictor Laboratory
* Cache Hierarchy Simulator
* Tomasulo Algorithm Visualization
* Out-of-Order Execution Engine
* Register Renaming Simulator
* Speculative Execution Explorer
* Superscalar Processor Mode
* Performance Benchmarking Suite
* WebAssembly Simulation Core
* Multi-Core Architecture Support

---

# 📜 License

MIT License

---

# Built for curious learners, future architects, and engineers who want to understand what really happens inside a CPU.
