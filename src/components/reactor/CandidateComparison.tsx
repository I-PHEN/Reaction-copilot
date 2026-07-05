"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Gauge, Timer, Thermometer, TrendingUp, Layers } from "lucide-react";
import { useTopology } from "@/lib/store/topology";
import { cn } from "@/lib/utils";
import type { ReactorNetwork, SolverReport } from "@/lib/solvers";

/** Compute network-level KPIs from a solver report. */
function networkKpis(report: SolverReport | null, network: ReactorNetwork) {
  if (!report) return { conversion: 0, totalVolume: 0, status: "—" as const, units: 0 };
  const reactors = network.nodes.filter((n) => n.type === "cstr" || n.type === "pfr");
  const totalVolume = reactors.reduce((s, n) => s + (n.params.volume ?? 0), 0);
  // Overall conversion = 1 - (product A flow / feed A flow)
  const feeds = network.nodes.filter((n) => n.type === "feed");
  const products = network.nodes.filter((n) => n.type === "product");
  const feedFlow = feeds.reduce((s, n) => s + (n.params.feedRate ?? 0), 0);
  const productFlow = products.reduce((s, n) => s + (report.results[n.id]?.outletFlow ?? 0), 0);
  const conversion = feedFlow > 0 ? (1 - productFlow / feedFlow) * 100 : 0;
  return {
    conversion,
    totalVolume,
    status: report.overallStatus,
    units: network.nodes.length,
  };
}

function CandidateCard({
  cand,
  onApply,
}: {
  cand: { label: string; rationale: string; topology: ReactorNetwork; report: SolverReport | null };
  onApply: () => void;
}) {
  const kpis = networkKpis(cand.report, cand.topology);
  const statusColor =
    kpis.status === "nominal"
      ? "text-emerald-400"
      : kpis.status === "warning"
        ? "text-amber-400"
        : "text-red-400";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.25 }}
      className="flex w-[230px] shrink-0 flex-col gap-2 rounded-xl border border-zinc-700/50 bg-zinc-900/85 p-3 backdrop-blur-md"
    >
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-zinc-100">{cand.label}</span>
        <span className={cn("h-1.5 w-1.5 rounded-full", statusColor.replace("text-", "bg-"))} />
      </div>
      <p className="text-[10px] leading-snug text-zinc-500">{cand.rationale}</p>

      <div className="grid grid-cols-2 gap-1.5">
        <div className="rounded-md border border-zinc-800/60 bg-zinc-950/60 px-2 py-1.5">
          <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-zinc-500">
            <Gauge className="h-2.5 w-2.5" /> Conv
          </div>
          <div className="mt-0.5 font-mono text-sm font-semibold text-cyan-300">
            {kpis.conversion.toFixed(1)}%
          </div>
        </div>
        <div className="rounded-md border border-zinc-800/60 bg-zinc-950/60 px-2 py-1.5">
          <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-zinc-500">
            <Layers className="h-2.5 w-2.5" /> Vol
          </div>
          <div className="mt-0.5 font-mono text-sm font-semibold text-zinc-100">
            {kpis.totalVolume.toFixed(1)}
            <span className="ml-0.5 text-[10px] text-zinc-500">m³</span>
          </div>
        </div>
        <div className="rounded-md border border-zinc-800/60 bg-zinc-950/60 px-2 py-1.5">
          <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-zinc-500">
            <TrendingUp className="h-2.5 w-2.5" /> Units
          </div>
          <div className="mt-0.5 font-mono text-sm font-semibold text-zinc-100">
            {kpis.units}
          </div>
        </div>
        <div className="rounded-md border border-zinc-800/60 bg-zinc-950/60 px-2 py-1.5">
          <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-zinc-500">
            <Thermometer className="h-2.5 w-2.5" /> Status
          </div>
          <div className={cn("mt-0.5 text-[11px] font-semibold uppercase", statusColor)}>
            {kpis.status}
          </div>
        </div>
      </div>

      <button
        onClick={onApply}
        className="mt-0.5 flex items-center justify-center gap-1.5 rounded-md border border-cyan-500/30 bg-cyan-500/10 py-1.5 text-[11px] font-medium text-cyan-300 transition-colors hover:bg-cyan-500/20 hover:text-cyan-200"
      >
        <Check className="h-3 w-3" /> Load to canvas
      </button>
    </motion.div>
  );
}

export function CandidateComparison() {
  const candidates = useTopology((s) => s.candidates);
  const clearCandidates = useTopology((s) => s.clearCandidates);
  const setNetwork = useTopology((s) => s.setNetwork);

  return (
    <AnimatePresence>
      {candidates.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25 }}
          className="shrink-0 overflow-hidden border-t border-zinc-800/80 bg-zinc-950"
        >
          <div className="flex items-center gap-2 px-4 py-2">
            <Gauge className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-[12px] font-medium text-zinc-200">Candidate Comparison</span>
            <span className="font-mono text-[10px] text-zinc-600">
              {candidates.length} alternatives · verified by solver
            </span>
            <button
              onClick={clearCandidates}
              className="ml-auto flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-300"
            >
              <X className="h-3 w-3" /> Dismiss
            </button>
          </div>
          <div className="eng-scroll flex gap-2 overflow-x-auto px-4 pb-3">
            {candidates.map((c, i) => (
              <CandidateCard
                key={i}
                cand={c}
                onApply={() => {
                  setNetwork(c.topology);
                  clearCandidates();
                }}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
