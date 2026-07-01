"use client";

import { useMemo } from "react";
import { ReactorCanvas } from "@/components/reactor/ReactorCanvas";
import { CopilotSidecar } from "@/components/reactor/CopilotSidecar";
import { DeepDiveOverlay } from "@/components/reactor/DeepDiveOverlay";
import { useTopology } from "@/lib/store/topology";
import { Network, ShieldCheck, AlertTriangle, FileJson, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

function ReconcilerBar() {
  const report = useTopology((s) => s.report);
  const network = useTopology((s) => s.network);

  const diagnostics = report?.reconcilerDiagnostics ?? [];
  const totalFeed = useMemo(
    () =>
      network.nodes
        .filter((n) => n.type === "feed")
        .reduce((s, n) => s + (n.params.feedRate ?? 0), 0),
    [network],
  );
  const totalProduct = useMemo(() => {
    if (!report) return 0;
    return network.nodes
      .filter((n) => n.type === "product")
      .reduce((s, n) => s + (report.results[n.id]?.outletFlow ?? 0), 0);
  }, [report, network]);

  const networkConversion = totalFeed > 0 ? (1 - totalProduct / totalFeed) * 100 : 0;
  const status = report?.overallStatus ?? "nominal";

  return (
    <footer className="mt-auto shrink-0 border-t border-slate-800 bg-slate-950/80 backdrop-blur">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 text-[11px]">
        <div className="flex items-center gap-1.5 text-slate-400">
          <Network className="h-3.5 w-3.5 text-cyan-400" />
          <span className="font-mono">
            {network.meta.species} · {network.meta.reaction}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-slate-400">
          <Activity className="h-3.5 w-3.5 text-slate-500" />
          <span>
            Reactant A:{" "}
            <span className="font-mono text-slate-200">
              feed {totalFeed.toFixed(2)} → product {totalProduct.toFixed(2)} mol/s
            </span>
            <span className="ml-1 text-cyan-400">· {networkConversion.toFixed(1)}% converted</span>
          </span>
        </div>

        <div
          className={cn(
            "ml-auto flex items-center gap-1.5 rounded px-2 py-0.5 font-semibold uppercase tracking-wide",
            status === "nominal" && "bg-blue-500/10 text-blue-300",
            status === "warning" && "bg-amber-500/10 text-amber-300",
            status === "error" && "bg-red-500/10 text-red-300",
          )}
        >
          {status === "nominal" ? <ShieldCheck className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
          Reconciler: {status}
        </div>
      </div>

      {diagnostics.length > 0 && (
        <div className="border-t border-slate-800/60 bg-amber-500/[0.03] px-4 py-1.5">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
            <div className="eng-scroll flex max-h-12 flex-1 flex-wrap gap-x-4 gap-y-0.5 overflow-y-auto text-[10px] text-amber-200/70">
              {diagnostics.map((d, i) => (
                <span key={i} className="font-mono">
                  · {d}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}

function Header() {
  const serialize = useTopology((s) => s.serialize);
  const report = useTopology((s) => s.report);
  const nodeCount = useTopology((s) => s.network.nodes.length);

  const onExport = () => {
    const blob = new Blob([JSON.stringify(serialize(), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reactor-network.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <header className="shrink-0 border-b border-slate-800 bg-slate-950">
      <div className="flex items-center gap-3 px-4 py-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/20 to-violet-500/20 ring-1 ring-cyan-500/30">
          <Network className="h-4 w-4 text-cyan-400" />
        </div>
        <div className="mr-auto">
          <h1 className="text-sm font-semibold text-slate-100">
            Reactor Engineering Synthesis Copilot
          </h1>
          <p className="text-[10px] text-slate-500">
            Tri-pane workspace · verified first-order Arrhenius solvers · generative-to-constructive
          </p>
        </div>

        <div className="hidden items-center gap-3 text-[10px] text-slate-500 md:flex">
          <span className="font-mono">{nodeCount} units</span>
          <span className="font-mono">
            {report ? Object.keys(report.results).length : 0} solver-bound
          </span>
        </div>

        <button
          onClick={onExport}
          className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:border-cyan-500/40 hover:text-cyan-200"
        >
          <FileJson className="h-3.5 w-3.5" />
          Export topology
        </button>
      </div>
    </header>
  );
}

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <Header />
      <main className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Workspace Canvas — 70% */}
        <section className="relative h-[55vh] min-h-0 lg:h-auto lg:flex-1">
          <ReactorCanvas />
          <DeepDiveOverlay />
        </section>
        {/* Copilot Sidecar — 30% */}
        <aside className="flex min-h-0 flex-1 flex-col border-t border-slate-800 lg:w-[30%] lg:flex-none lg:border-l lg:border-t-0">
          <CopilotSidecar />
        </aside>
      </main>
      <ReconcilerBar />
    </div>
  );
}
