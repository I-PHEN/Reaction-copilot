/**
 * Serialize the current topology + solver report into a compact context
 * string for the LLM. This is the "shared state" every agent reads.
 * Only includes verified solver numbers — no derived/heuristic values.
 */
export function buildContextBlock(topology: unknown, report: unknown): string {
  const t = topology as { nodes?: unknown[]; streams?: unknown[]; meta?: { species?: string; reaction?: string } } | null;
  const r = report as { results?: Record<string, unknown>; reconcilerDiagnostics?: string[]; overallStatus?: string } | null;

  const nodes = t && Array.isArray(t.nodes) ? t.nodes : [];
  const streams = t && Array.isArray(t.streams) ? t.streams : [];
  const results = r?.results ?? {};

  let block = `## Current Topology\n`;
  block += `Species: ${t?.meta?.species ?? "A → B"}\n`;
  block += `Reaction: ${t?.meta?.reaction ?? "first-order, liquid-phase"}\n`;
  block += `Units: ${nodes.length}\nStreams: ${streams.length}\n\n`;

  block += `### Units (verified solver KPIs)\n`;
  for (const n of nodes) {
    const node = n as { id: string; type: string; label: string; params: Record<string, number> };
    const res = results[node.id] as {
      conversion?: number; residenceTime?: number; outletTemperature?: number;
      rateConstant?: number; outletFlow?: number; residual?: number;
      status?: string; converged?: boolean; diagnostics?: string[];
    } | undefined;
    block += `- ${node.label} (${node.type})`;
    if (node.params) {
      const p: string[] = [];
      if (node.params.volume != null) p.push(`V=${node.params.volume}m³`);
      if (node.params.temperature != null) p.push(`T=${node.params.temperature}K`);
      if (node.params.feedRate != null) p.push(`F=${node.params.feedRate}mol/s`);
      if (node.params.volumetricFlow != null) p.push(`v=${node.params.volumetricFlow}m³/s`);
      if (node.params.splitFraction != null) p.push(`α=${node.params.splitFraction}`);
      if (p.length) block += `  params: ${p.join(", ")}`;
    }
    if (res) {
      block += `\n  solver: X=${((res.conversion ?? 0) * 100).toFixed(1)}%, τ=${(res.residenceTime ?? 0).toFixed(2)}s, T_out=${(res.outletTemperature ?? 0).toFixed(0)}K, k=${(res.rateConstant ?? 0).toFixed(4)}/s, A_out=${(res.outletFlow ?? 0).toFixed(2)}mol/s, residual=${(res.residual ?? 0).toExponential(1)}, status=${res.status ?? "unknown"}`;
      if (res.diagnostics && res.diagnostics.length > 0) {
        block += `\n  diagnostics: ${res.diagnostics.join("; ")}`;
      }
    }
    block += `\n`;
  }

  if (streams.length > 0) {
    block += `\n### Streams\n`;
    for (const s of streams) {
      const st = s as { id: string; source: string; target: string; flowRate: number };
      block += `- ${st.id}: ${st.source} → ${st.target} (${st.flowRate} mol/s)\n`;
    }
  }

  if (r?.reconcilerDiagnostics && r.reconcilerDiagnostics.length > 0) {
    block += `\n### Reconciler Diagnostics\n`;
    for (const d of r.reconcilerDiagnostics) block += `- ${d}\n`;
  }

  block += `\n### Network Status: ${r?.overallStatus ?? "unknown"}\n`;
  return block;
}
