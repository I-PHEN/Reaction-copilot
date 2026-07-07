"use client";

import { useMemo, useState } from "react";
import { ReactorCanvas } from "@/components/reactor/ReactorCanvas";
import { CopilotSidecar } from "@/components/reactor/CopilotSidecar";
import { DeepDiveOverlay } from "@/components/reactor/DeepDiveOverlay";
import { StreamTable } from "@/components/reactor/StreamTable";
import { CandidateComparison } from "@/components/reactor/CandidateComparison";
import { ConfigurationDialog } from "@/components/reactor/ConfigurationDialog";
import { ResponseSurface } from "@/components/reactor/ResponseSurface";
import { ChemistryPanel } from "@/components/reactor/ChemistryPanel";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTopology } from "@/lib/store/topology";
import {
  Network,
  ShieldCheck,
  AlertTriangle,
  FileJson,
  Plus,
  FolderOpen,
  Save,
  Trash2,
  Library,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  const clearSession = useTopology((s) => s.clearSession);
  const saveTopology = useTopology((s) => s.saveTopology);
  const loadTopology = useTopology((s) => s.loadTopology);
  const deleteSavedTopology = useTopology((s) => s.deleteSavedTopology);
  const savedTopologies = useTopology((s) => s.savedTopologies);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");

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

  const onNewSession = () => {
    clearSession();
    toast.success("New session", { description: "Canvas and chat reset to defaults." });
  };

  const onSave = () => {
    if (!saveName.trim()) return;
    saveTopology(saveName);
    toast.success("Topology saved", { description: `“${saveName.trim()}” stored in your library.` });
    setSaveName("");
    setSaveOpen(false);
  };

  const onLoad = (name: string) => {
    const ok = loadTopology(name);
    if (ok) toast.success("Topology loaded", { description: `“${name}” restored to canvas.` });
    else toast.error("Could not load topology");
  };

  const onDelete = (name: string) => {
    deleteSavedTopology(name);
    toast.success("Deleted", { description: `“${name}” removed from library.` });
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

        {/* New session */}
        <button
          onClick={onNewSession}
          className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
          title="Start a new session"
        >
          <Plus className="h-3 w-3" />
          New
        </button>

        {/* Library dropdown: save / load / delete */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
              title="Topology library"
            >
              <Library className="h-3 w-3" />
              Library
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-60 border-zinc-700 bg-zinc-900 text-zinc-200"
          >
            <DropdownMenuItem
              onSelect={() => setSaveOpen(true)}
              className="flex items-center gap-2 focus:bg-zinc-800"
            >
              <Save className="h-3.5 w-3.5 text-cyan-400" /> Save current topology…
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-zinc-800" />
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-zinc-500">
              Saved topologies
            </DropdownMenuLabel>
            {savedTopologies.length === 0 ? (
              <div className="px-2 py-2 text-[11px] italic text-zinc-600">
                No saved topologies yet
              </div>
            ) : (
              savedTopologies
                .slice()
                .sort((a, b) => b.ts - a.ts)
                .map((t) => (
                  <div
                    key={t.name}
                    className="group flex items-center gap-1 rounded px-1 focus:bg-zinc-800"
                  >
                    <button
                      onClick={() => onLoad(t.name)}
                      className="flex flex-1 items-center gap-2 px-1.5 py-1.5 text-left text-[12px] text-zinc-300 hover:text-white"
                    >
                      <FolderOpen className="h-3.5 w-3.5 text-zinc-500" />
                      <span className="flex-1 truncate">{t.name}</span>
                      <span className="font-mono text-[9px] text-zinc-600">{t.nodes}u</span>
                    </button>
                    <button
                      onClick={() => onDelete(t.name)}
                      className="rounded p-1 text-zinc-600 opacity-0 transition-opacity hover:bg-red-500/20 hover:text-red-300 group-hover:opacity-100"
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Export */}
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
        >
          <FileJson className="h-3 w-3" />
          Export
        </button>
      </div>

      {/* Save dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="border-zinc-700 bg-zinc-900 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-sm">Save topology</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              autoFocus
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="e.g. 2-stage CSTR+PFR train"
              onKeyDown={(e) => e.key === "Enter" && onSave()}
              className="border-zinc-700 bg-zinc-950 text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-cyan-500/30"
            />
            <p className="mt-2 text-[10px] text-zinc-600">
              Stored in your browser (localStorage). Reuse across sessions.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSaveOpen(false)}
              className="text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={onSave}
              disabled={!saveName.trim()}
              className="bg-cyan-500 text-zinc-950 hover:bg-cyan-400 disabled:opacity-40"
            >
              <Save className="mr-1.5 h-3.5 w-3.5" /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
      <CandidateComparison />
      <ResponseSurface />
      <ChemistryPanel />
      <StreamTable />
      <ReconcilerBar />
      <ConfigurationDialog />
    </div>
  );
}
