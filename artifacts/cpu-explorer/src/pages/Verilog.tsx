import { useMemo, useState } from 'react';
import Editor from '@monaco-editor/react';
import { Link } from 'wouter';
import {
  CORE_PROFILES, MODULES_5STAGE, MODULES_15STAGE, STAGES_15,
  countHdlLines, getSourceForModule, totalModuleCount,
  type VerilogCoreId, type VerilogModuleMeta,
} from '@/data/verilogManifest';
import { RtlBrowserSimulator } from '@/components/rtl/RtlBrowserSimulator';
import {
  Cpu, Code2, GitBranch, Layers, ChevronRight, Terminal,
  Building2, Microchip, BookOpen, ExternalLink, PlayCircle,
} from 'lucide-react';

type ViewTab = 'source' | 'simulate';

function ModuleList({
  modules, selected, onSelect,
}: {
  modules: VerilogModuleMeta[];
  selected: VerilogModuleMeta;
  onSelect: (m: VerilogModuleMeta) => void;
}) {
  const grouped = useMemo(() => {
    const g: Record<string, VerilogModuleMeta[]> = {};
    for (const m of modules) {
      (g[m.category] ??= []).push(m);
    }
    return g;
  }, [modules]);

  return (
    <div className="space-y-3 overflow-y-auto max-h-[520px] pr-1">
      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat}>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 px-2">{cat}</p>
          {items.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelect(m)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                selected.id === m.id
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'hover:bg-secondary text-foreground border border-transparent'
              }`}
            >
              <span className="font-mono text-xs">{m.label}</span>
              {m.stage !== undefined && m.stage >= 0 && (
                <span className="ml-2 text-[10px] text-muted-foreground">S{m.stage}</span>
              )}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function StagePipelineViz({ activeStage }: { activeStage?: number }) {
  return (
    <div className="flex flex-wrap gap-1">
      {STAGES_15.map((s) => (
        <div
          key={s.id}
          title={`${s.name} — ${s.analog}`}
          className={`flex-1 min-w-[52px] rounded px-1 py-2 text-center border text-[10px] leading-tight ${
            activeStage === s.n
              ? 'bg-primary/20 border-primary text-primary font-semibold'
              : 'bg-card border-border text-muted-foreground'
          }`}
        >
          <div className="font-mono font-bold">S{s.n}</div>
          <div>{s.id}</div>
        </div>
      ))}
    </div>
  );
}

export default function Verilog() {
  const [core, setCore] = useState<VerilogCoreId>('15stage');
  const [view, setView] = useState<ViewTab>('simulate');
  const modules = core === '5stage' ? MODULES_5STAGE : MODULES_15STAGE;
  const [selected, setSelected] = useState<VerilogModuleMeta>(MODULES_15STAGE[0]);
  const profile = CORE_PROFILES[core];

  const source = useMemo(
    () => getSourceForModule(core, selected.file),
    [core, selected.file],
  );

  const loc = countHdlLines(core);
  const activeStage = core === '15stage' ? selected.stage : undefined;

  const onCoreChange = (id: VerilogCoreId) => {
    setCore(id);
    setSelected(id === '5stage' ? MODULES_5STAGE[0] : MODULES_15STAGE[0]);
  };

  return (
    <div className={`p-6 space-y-6 ${view === 'simulate' ? 'max-w-none' : 'max-w-7xl'}`}>
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Microchip className="w-6 h-6 text-primary" />
            <h1 className={`font-bold ${view === 'simulate' ? 'text-xl' : 'text-3xl'}`}>
              {view === 'simulate' ? 'GTKWave — tb_riscv_core.vcd' : 'Verilog HDL Cores'}
            </h1>
          </div>
          {view !== 'simulate' && (
            <p className="text-muted-foreground max-w-2xl">
              Production-style synthesizable RTL plus <strong className="text-foreground">in-browser RTL testbench simulation</strong> —
              run the same program as <code className="text-xs bg-secondary px-1 rounded">tb_riscv_core.v</code> with live pipeline and waveforms.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(['simulate', 'source'] as ViewTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setView(tab)}
                className={`px-3 py-2 text-sm flex items-center gap-1.5 ${
                  view === tab ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-secondary'
                }`}
              >
                {tab === 'simulate' ? <PlayCircle className="w-4 h-4" /> : <Code2 className="w-4 h-4" />}
                {tab === 'simulate' ? 'Live Sim' : 'RTL Source'}
              </button>
            ))}
          </div>
          {(['15stage', '5stage'] as VerilogCoreId[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onCoreChange(id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                core === id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card border-border hover:bg-secondary'
              }`}
            >
              {id === '15stage' ? '15-Stage (HPC)' : '5-Stage (Baseline)'}
            </button>
          ))}
        </div>
      </div>

      {view === 'simulate' ? (
        <RtlBrowserSimulator core={core} />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: Layers, label: 'Pipeline stages', value: String(profile.stages) },
              { icon: Code2, label: 'HDL line count', value: `${loc}+` },
              { icon: Cpu, label: 'RTL modules', value: String(totalModuleCount()) },
              { icon: Building2, label: 'Repo path', value: profile.path.split('/').pop() ?? '' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-lg border border-border bg-card p-4">
                <Icon className="w-4 h-4 text-primary mb-2" />
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-border bg-card p-5 space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-primary" />
              {profile.name}
            </h2>
            <p className="text-sm text-muted-foreground">{profile.subtitle}</p>
            <ul className="grid md:grid-cols-2 gap-2">
              {profile.highlights.map((h) => (
                <li key={h} className="text-sm flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  {h}
                </li>
              ))}
            </ul>
            <p className="text-sm border-l-2 border-primary/50 pl-3 text-muted-foreground italic">
              {profile.industryNote}
            </p>
          </div>

          {core === '15stage' && (
            <div className="rounded-lg border border-border bg-card p-5 space-y-3">
              <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                15-Stage Pipeline Map
              </h3>
              <StagePipelineViz activeStage={activeStage} />
              {activeStage !== undefined && activeStage >= 0 && (
                <p className="text-sm text-primary">
                  Selected module maps to stage S{activeStage}: {STAGES_15[activeStage]?.name}
                </p>
              )}
            </div>
          )}
        </>
      )}

      {view === 'source' ? (
      <div className="grid lg:grid-cols-[240px_1fr_280px] gap-4 min-h-[560px]">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground mb-3 px-2">Modules</p>
          <ModuleList
            modules={modules}
            selected={selected}
            onSelect={setSelected}
          />
        </div>

        <div className="rounded-lg border border-border overflow-hidden flex flex-col min-h-[480px]">
          <div className="flex items-center justify-between px-4 py-2 bg-secondary/50 border-b border-border">
            <span className="font-mono text-sm">{profile.path}/{selected.file}</span>
            <span className="text-xs text-muted-foreground">
              {source.split('\n').length} lines
            </span>
          </div>
          <div className="flex-1 min-h-[420px]">
            <Editor
              height="100%"
              language="verilog"
              theme="vs-dark"
              value={source}
              options={{
                readOnly: true,
                minimap: { enabled: true },
                fontSize: 13,
                fontFamily: 'JetBrains Mono, Fira Code, monospace',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                lineNumbers: 'on',
              }}
            />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 space-y-4">
          <div>
            <p className="text-xs uppercase text-muted-foreground mb-1">Module</p>
            <p className="font-mono font-semibold">{selected.label}</p>
          </div>
          <p className="text-sm text-muted-foreground">{selected.description}</p>

          {selected.relatedPage && (
            <Link
              href={selected.relatedPage}
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <ExternalLink className="w-3 h-3" />
              Open related simulation lab
            </Link>
          )}

          <div className="border-t border-border pt-4 space-y-2">
            <p className="text-xs uppercase text-muted-foreground flex items-center gap-1">
              <Terminal className="w-3 h-3" /> Run simulation
            </p>
            <pre className="text-[11px] bg-secondary rounded p-3 overflow-x-auto font-mono">
{`cd ${profile.path}
make sim`}
            </pre>
            <p className="text-[11px] text-muted-foreground">
              Requires Icarus Verilog. Produces VCD waveforms via <code>make wave</code>.
            </p>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-xs uppercase text-muted-foreground flex items-center gap-1 mb-2">
              <BookOpen className="w-3 h-3" /> Cross-reference
            </p>
            <div className="flex flex-col gap-1 text-sm">
              <Link href="/pipeline" className="text-primary hover:underline">5-Stage Pipeline sim</Link>
              <Link href="/blueprint" className="text-primary hover:underline">CPU Blueprint</Link>
              <Link href="/ooo" className="text-primary hover:underline">Out-of-Order lab</Link>
              <Link href="/branch" className="text-primary hover:underline">Branch Predictor</Link>
            </div>
          </div>
        </div>
      </div>
      ) : null}
    </div>
  );
}
