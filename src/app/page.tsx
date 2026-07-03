"use client";

import { useMemo } from "react";
import { ReactorCanvas } from "@/components/reactor/ReactorCanvas";
import { CopilotSidecar } from "@/components/reactor/CopilotSidecar";
import { DeepDiveOverlay } from "@/components/reactor/DeepDiveOverlay";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useTopology } from "@/lib/store/topology";
import { Network, ShieldCheck, AlertTriangle, FileJson } from "lucide-react";
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
    <footer className="shrink-0 border-t border-zinc-800/80 bg-zinc-950">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-4 py-1.5 text-[11px]">
        <div className="flex items-center gap-1.5 text-zinc-400">
          <Network className="h-3 w-3 text-cyan-400" />
          <span className="font-mono text-zinc-300">{network.meta.species}</span>
        </div>

        <div className="flex items-center gap-1.5 text-zinc-500">
          <span className="font-mono">
            {network.nodes.length} units · {network.streams.length} streams
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-zinc-500">
          <span>
            <span className="font-mono text-zinc-300">
              {totalFeed.toFixed(1)} → {totalProduct.toFixed(1)} mol/s
            </span>
            <span className="ml-1 text-cyan-400">{networkConversion.toFixed(1)}% conv</span>
          </span>
        </div>

        <div
          className={cn(
            "ml-auto flex items-center gap-1.5 rounded px-2 py-0.5 font-semibold uppercase tracking-wide",
            status === "nominal" && "bg-emerald-500/10 text-emerald-400",
            status === "warning" && "bg-amber-500/10 text-amber-400",
            status === "error" && "bg-red-500/10 text-red-400",
          )}
        >
          {status === "nominal" ? <ShieldCheck className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
          {status}
        </div>
      </div>

      {diagnostics.length > 0 && (
        <div className="border-t border-zinc-800/60 bg-amber-500/[0.03] px-4 py-1">
          <div className="eng-scroll flex max-h-10 items-start gap-2 overflow-y-auto">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500/80" />
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-amber-300/60">
              {diagnostics.map((d, i) => (
                <span key={i} className="font-mono">· {d}</span>
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
    <header className="shrink-0 border-b border-zinc-800/80 bg-zinc-950">
      <div className="flex items-center gap-3 px-4 py-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900 ring-1 ring-zinc-800">
          <Network className="h-3.5 w-3.5 text-cyan-400" />
        </div>
        <div className="mr-auto">
          <h1 className="text-[13px] font-semibold text-zinc-100">
            Reactor Engineering Synthesis Copilot
          </h1>
          <p className="text-[10px] text-zinc-600">
            verified first-order Arrhenius solvers · generative-to-constructive
          </p>
        </div>
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
        >
          <FileJson className="h-3 w-3" />
          Export
        </button>
      </div>
    </header>
  );
}

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100 lg:h-dvh lg:overflow-hidden">
      <Header />
      <main className="min-h-0 flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Workspace Canvas */}
          <ResizablePanel defaultSize={70} minSize={40}>
            <section className="relative h-full overflow-hidden">
              <ReactorCanvas />
              <DeepDiveOverlay />
            </section>
          </ResizablePanel>
          <ResizableHandle
            withHandle
            className="bg-zinc-800/80 data-[resize-handle-state=hover]:bg-zinc-700 data-[resize-handle-state=drag]:bg-cyan-600/60 transition-colors"
          />
          {/* Copilot Sidecar */}
          <ResizablePanel defaultSize={30} minSize={18} maxSize={55}>
            <aside className="h-full border-l border-zinc-800/80">
              <CopilotSidecar />
            </aside>
          </ResizablePanel>
        </ResizablePanelGroup>
      </main>
      <ReconcilerBar />
    </div>
  );
}
