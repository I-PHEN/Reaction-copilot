"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Table2, Network, ShieldCheck, AlertTriangle } from "lucide-react";
import { useTopology } from "@/lib/store/topology";
import { cn } from "@/lib/utils";
import { DEFAULT_PARAMS } from "@/lib/solvers";

/**
 * StreamTable — the unified bottom bar.
 * ---------------------------------------------------------------
 * Merges the reconciler status (species, unit/stream count, feed→product
 * flow, conversion, status badge, diagnostics) with the collapsible
 * stream table. One bar, not two.
 */
export function StreamTable() {
  const network = useTopology((s) => s.network);
  const report = useTopology((s) => s.report);
  const [open, setOpen] = useState(false);

  const rows = useMemo(() => {
    const nodeById = new Map(network.nodes.map((n) => [n.id, n]));
    return network.streams.map((s) => {
      const source = nodeById.get(s.source);
      const sourceResult = report?.results[s.source];
      const temperature = sourceResult?.outletTemperature ?? source?.params.temperature ?? DEFAULT_PARAMS.temperature;
      const sourceType = source?.type;
      const aFlow =
        sourceType === "cstr" || sourceType === "pfr"
          ? sourceResult?.outletFlow ?? s.flowRate
          : s.flowRate;
      const totalFlow = s.flowRate;
      const aClamped = Math.min(aFlow, totalFlow);
      const aFraction = totalFlow > 0 ? aClamped / totalFlow : 0;
      const bFraction = 1 - aFraction;
      return {
        id: s.id,
        from: source?.label ?? s.source,
        to: nodeById.get(s.target)?.label ?? s.target,
        flow: totalFlow,
        aFraction,
        bFraction,
        temperature,
      };
    });
  }, [network, report]);

  // Reconciler stats
  const totalFeed = useMemo(
    () => network.nodes.filter((n) => n.type === "feed").reduce((s, n) => s + (n.params.feedRate ?? 0), 0),
    [network],
  );
  const totalProduct = useMemo(() => {
    if (!report) return 0;
    return network.nodes.filter((n) => n.type === "product").reduce((s, n) => s + (report.results[n.id]?.outletFlow ?? 0), 0);
  }, [report, network]);
  const networkConversion = totalFeed > 0 ? (1 - totalProduct / totalFeed) * 100 : 0;
  const status = report?.overallStatus ?? "nominal";
  const diagnostics = report?.reconcilerDiagnostics ?? [];
  const hasStreams = network.streams.length > 0;

  return (
    <div className="shrink-0 border-t border-zinc-800/80 bg-zinc-950">
      {/* Unified header — reconciler + stream table toggle */}
      <div className="flex items-center gap-x-4 gap-y-1 px-4 py-1.5 text-[11px]">
        {/* Species */}
        <div className="flex items-center gap-1.5 text-zinc-400">
          <Network className="h-3 w-3 text-cyan-400" />
          <span className="font-mono text-zinc-300">{network.meta.species}</span>
        </div>

        {/* Units / streams */}
        <div className="font-mono text-zinc-600">
          {network.nodes.length}u · {network.streams.length}s
        </div>

        {/* Flow + conversion */}
        {hasStreams && (
          <div className="text-zinc-500">
            <span className="font-mono text-zinc-300">
              {totalFeed.toFixed(1)} → {totalProduct.toFixed(1)} mol/s
            </span>
            <span className="ml-1.5 text-cyan-400">{networkConversion.toFixed(1)}% conv</span>
          </div>
        )}

        {/* Status badge */}
        <div
          className={cn(
            "flex items-center gap-1 rounded px-2 py-0.5 font-semibold uppercase tracking-wide",
            status === "nominal" && "bg-emerald-500/10 text-emerald-400",
            status === "warning" && "bg-amber-500/10 text-amber-400",
            status === "error" && "bg-red-500/10 text-red-400",
          )}
        >
          {status === "nominal" ? <ShieldCheck className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
          {status}
        </div>

        {/* Stream table toggle (right side) */}
        {hasStreams && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="ml-auto flex items-center gap-1.5 text-zinc-500 transition-colors hover:text-zinc-300"
          >
            <Table2 className="h-3 w-3" />
            <span className="text-[10px] uppercase tracking-wider">Streams</span>
            <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
          </button>
        )}
      </div>

      {/* Diagnostics (if any) */}
      {diagnostics.length > 0 && (
        <div className="border-t border-zinc-800/60 bg-amber-500/[0.03] px-4 py-1">
          <div className="eng-scroll flex max-h-8 items-start gap-2 overflow-y-auto">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500/80" />
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-amber-300/60">
              {diagnostics.map((d, i) => (
                <span key={i} className="font-mono">· {d}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Collapsible stream table */}
      {open && hasStreams && (
        <div className="eng-scroll max-h-44 overflow-auto border-t border-zinc-800/60">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-zinc-950">
              <tr className="text-left text-[9px] uppercase tracking-wider text-zinc-600">
                <th className="px-4 py-1 font-medium">Stream</th>
                <th className="px-3 py-1 font-medium">From → To</th>
                <th className="px-3 py-1 text-right font-medium">Flow</th>
                <th className="px-3 py-1 text-right font-medium">A</th>
                <th className="px-3 py-1 text-right font-medium">B</th>
                <th className="px-3 py-1 text-right font-medium">T</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-zinc-900 text-zinc-400 transition-colors hover:bg-zinc-900/40"
                >
                  <td className="px-4 py-1 text-zinc-500">{r.id}</td>
                  <td className="px-3 py-1 text-zinc-300">
                    {r.from} <span className="text-zinc-600">→</span> {r.to}
                  </td>
                  <td className="px-3 py-1 text-right tabular-nums text-zinc-200">
                    {r.flow.toFixed(1)}
                    <span className="ml-0.5 text-[9px] text-zinc-600">mol/s</span>
                  </td>
                  <td className="px-3 py-1 text-right tabular-nums text-cyan-300/80">
                    {(r.aFraction * 100).toFixed(0)}%
                  </td>
                  <td className="px-3 py-1 text-right tabular-nums text-emerald-300/70">
                    {(r.bFraction * 100).toFixed(0)}%
                  </td>
                  <td className="px-3 py-1 text-right tabular-nums text-zinc-300">
                    {r.temperature.toFixed(0)}
                    <span className="ml-0.5 text-[9px] text-zinc-600">K</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
