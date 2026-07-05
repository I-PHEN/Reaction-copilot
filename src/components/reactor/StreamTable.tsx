"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Table2 } from "lucide-react";
import { useTopology } from "@/lib/store/topology";
import { cn } from "@/lib/utils";
import { DEFAULT_PARAMS, type NetworkNode, type SolverResult } from "@/lib/solvers";

/**
 * StreamTable — a collapsible process-flow table.
 * ---------------------------------------------------------------
 * Shows every stream in the network with its flow rate, composition
 * (A fraction), and temperature — the data engineers actually look
 * at in a real P&ID. Sits in a collapsible strip above the reconciler
 * footer. Collapses to a single header line to reclaim vertical space.
 */
export function StreamTable() {
  const network = useTopology((s) => s.network);
  const report = useTopology((s) => s.report);
  const [open, setOpen] = useState(false);

  // Compute per-stream outlet state by walking from source to target.
  const rows = useMemo(() => {
    const nodeById = new Map(network.nodes.map((n) => [n.id, n]));
    return network.streams.map((s) => {
      const source = nodeById.get(s.source);
      const target = nodeById.get(s.target);
      const sourceResult = report?.results[s.source];

      // Temperature entering this stream = outlet of the source node.
      const temperature = sourceResult?.outletTemperature ?? source?.params.temperature ?? DEFAULT_PARAMS.temperature;

      // Molar flow of reactant A leaving the source. For reactors this is
      // the solver's outletFlow (A consumed by reaction). For feed/mixer/
      // product nodes that don't react, it's the declared stream flow.
      const sourceType = source?.type;
      const aFlow =
        sourceType === "cstr" || sourceType === "pfr"
          ? sourceResult?.outletFlow ?? s.flowRate
          : s.flowRate;

      // For first-order A→B with 1:1 stoichiometry, total molar flow is
      // conserved through reactors. So total = declared stream flow, and
      // B = total - A. Guard against A exceeding total (defensive).
      const totalFlow = s.flowRate;
      const aClamped = Math.min(aFlow, totalFlow);
      const aFraction = totalFlow > 0 ? aClamped / totalFlow : 0;
      const bFraction = 1 - aFraction;

      return {
        id: s.id,
        from: source?.label ?? s.source,
        to: target?.label ?? s.target,
        flow: totalFlow,
        aFlow: aClamped,
        aFraction,
        bFraction,
        temperature,
        sourceType,
        targetType: target?.type,
      };
    });
  }, [network, report]);

  if (network.streams.length === 0) return null;

  return (
    <div className="shrink-0 border-t border-zinc-800/80 bg-zinc-950">
      {/* Header bar — always visible */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-1.5 text-left transition-colors hover:bg-zinc-900/50"
      >
        <Table2 className="h-3 w-3 text-zinc-500" />
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">Stream Table</span>
        <span className="font-mono text-[10px] text-zinc-600">{rows.length} streams</span>
        <ChevronDown
          className={cn(
            "ml-auto h-3 w-3 text-zinc-600 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {/* Collapsible table */}
      {open && (
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
