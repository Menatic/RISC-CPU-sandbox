import React, { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { useSimulatorStore } from '../store/simulatorStore';
import { examplePrograms } from '../data/examplePrograms';
import { Play, Square, StepForward, RotateCcw, Box } from 'lucide-react';
import { assemble, executeInstruction } from '../engine/riscv';

export default function IDE() {
  const { 
    assemblySource, 
    setSource, 
    registers, 
    pc, 
    executionMode,
    currentCycle,
    assembledProgram
  } = useSimulatorStore();
  
  const [selectedProgram, setSelectedProgram] = useState(examplePrograms[0].id);

  useEffect(() => {
    const prog = examplePrograms.find(p => p.id === selectedProgram);
    if (prog) setSource(prog.code);
  }, [selectedProgram, setSource]);

  const handleAssemble = () => {
    const compiled = assemble(assemblySource);
    useSimulatorStore.setState({ assembledProgram: compiled, executionMode: 'idle', pc: 0, currentCycle: 0, registers: new Array(32).fill(0) });
  };

  const handleStep = () => {
    if (!assembledProgram) return;
    const instr = assembledProgram.instructions.find(i => i.pc === pc);
    if (instr) {
      const nextState = executeInstruction(instr, { registers, pc, memory: new Uint8Array() });
      useSimulatorStore.setState({ 
        registers: nextState.registers, 
        pc: nextState.pc,
        currentCycle: currentCycle + instr.cycles,
        executionMode: 'stepped'
      });
    } else {
      useSimulatorStore.setState({ executionMode: 'complete' });
    }
  };

  return (
    <div className="flex h-screen w-full bg-background text-foreground pt-16">
      {/* Editor Section */}
      <div className="w-1/2 flex flex-col border-r border-border">
        <div className="flex items-center justify-between p-4 border-b border-border bg-card">
          <select 
            className="bg-background border border-border rounded p-1"
            value={selectedProgram}
            onChange={(e) => setSelectedProgram(e.target.value)}
          >
            {examplePrograms.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          
          <div className="flex gap-2">
            <button onClick={handleAssemble} className="px-3 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 flex items-center gap-2">
              <Box className="w-4 h-4" /> Assemble
            </button>
            <button onClick={handleStep} disabled={!assembledProgram || executionMode === 'complete'} className="px-3 py-1 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 flex items-center gap-2 disabled:opacity-50">
              <StepForward className="w-4 h-4" /> Step
            </button>
          </div>
        </div>
        
        <div className="flex-1">
          <Editor
            height="100%"
            defaultLanguage="assembly"
            theme="vs-dark"
            value={assemblySource}
            onChange={(val) => setSource(val || '')}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              fontFamily: 'var(--app-font-mono)'
            }}
          />
        </div>
      </div>
      
      {/* State Section */}
      <div className="w-1/2 flex flex-col p-4 overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Execution State</h2>
          <div className="flex gap-4 text-sm">
            <div><span className="text-muted-foreground">PC:</span> <span className="font-mono text-cyan-400">0x{pc.toString(16).padStart(8, '0')}</span></div>
            <div><span className="text-muted-foreground">Cycle:</span> <span className="font-mono text-cyan-400">{currentCycle}</span></div>
            <div><span className="text-muted-foreground">Status:</span> <span className="font-mono text-cyan-400 uppercase">{executionMode}</span></div>
          </div>
        </div>
        
        <h3 className="text-lg font-semibold mb-2">Registers</h3>
        <div className="grid grid-cols-4 gap-2 font-mono text-sm">
          {registers.map((val, i) => (
            <div key={i} className="flex bg-card border border-border rounded overflow-hidden">
              <div className="bg-muted px-2 py-1 text-muted-foreground border-r border-border w-10 text-center">x{i}</div>
              <div className="px-2 py-1 flex-1 text-right">{val !== 0 ? <span className="text-primary font-bold">{val}</span> : val}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
