"use client";

import { useMemo } from "react";
import {
  Pin,
  PinOff,
  X,
  Gauge,
  Thermometer,
  Timer,
  Beaker,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTopology } from "@/lib/store/topology";
import { DEFAULT_PARAMS, type NetworkNode, type SolverResult } from "@/lib/solvers";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";

const STATUS_META: Record<
  SolverResult["status"],
  { label: string; color: string; ring: string; Icon: typeof CheckCircle2 }
> = {
  nominal: { label: "Nominal", color: "text-blue-300", ring: "ring-blue-500/30", Icon: CheckCircle2 },
  warning: { label: "Constraint", color: "text-amber-300", ring: "ring-amber-500/30", Icon: AlertTriangle },
  error: { label: "Non-convergent", color: "text-red-300", ring: "ring-red-500/30", Icon: XCircle },
};

function Kpi({
  icon: Icon,
  label,
  value,
  unit,
  tone = "default",
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
  unit?: string;
  tone?: "default" | "blue" | "amber" | "red";
}) {
  const toneClass =
    tone === "blue"
      ? "text-blue-300"
      : tone === "amber"
        ? "text-amber-300"
        : tone === "red"
          ? "text-red-300"
          : "text-slate-100";
  return (
    <div className="rounded-md border border-slate-700/50 bg-slate-950/50 px-2 py-1.5">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-slate-500">
        <Icon className="h-2.5 w-2.5" />
        {label}
      </div>
      <div className={cn("mt-0.5 font-mono text-sm font-semibold tabular-nums", toneClass)}>
        {value}
        {unit && <span className="ml-0.5 text-[10px] font-normal text-slate-500">{unit}</span>}
      </div>
    </div>
  );
}

function ParamControl({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
        <span className="font-mono text-[11px] text-slate-200">
          {value.toFixed(step < 1 ? 2 : 0)}
          <span className="ml-0.5 text-slate-500">{unit}</span>
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
        className="[&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:border-0 [&_[role=slider]]:bg-cyan-400"
      />
    </div>
  );
}

function DeepDiveCard({
  node,
  result,
  compact = false,
}: {
  node: NetworkNode;
  result: SolverResult | undefined;
  compact?: boolean;
}) {
  const updateNodeParams = useTopology((s) => s.updateNodeParams);
  const togglePin = useTopology((s) => s.togglePin);
  const selectNode = useTopology((s) => s.selectNode);
  const isPinned = useTopology((s) => s.pinnedNodeIds.includes(node.id));

  const params = { ...DEFAULT_PARAMS, ...node.params };
  const status = result?.status ?? "nominal";
  const meta = STATUS_META[status];

  const profile = result?.profile ?? [];
  const chartData = useMemo(
    () => profile.map((p) => ({ v: +p.position.toFixed(2), x: +(p.conversion * 100).toFixed(2), T: +p.temperature.toFixed(1) })),
    [profile],
  );

  const isReactor = node.type === "cstr" || node.type === "pfr";

  return (
    <div
      className={cn(
        "glass-card flex w-[290px] flex-col gap-2 rounded-xl border border-slate-600/40 bg-slate-900/70 p-3 backdrop-blur-md",
        "shadow-[0_8px_32px_rgba(0,0,0,0.5)] ring-1 ring-inset",
        meta.ring,
      )}
    >
      {/* header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
            {node.type}
          </span>
          <span className="text-sm font-semibold text-slate-100">{node.label}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => togglePin(node.id)}
            title={isPinned ? "Unpin" : "Pin for comparison"}
            className={cn(
              "rounded p-1 transition-colors",
              isPinned ? "text-cyan-300 hover:bg-cyan-500/20" : "text-slate-400 hover:bg-slate-700/60 hover:text-slate-200",
            )}
          >
            {isPinned ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* status banner */}
      <div className={cn("flex items-center gap-1.5 rounded-md bg-slate-950/60 px-2 py-1", meta.color)}>
        <meta.Icon className="h-3 w-3" />
        <span className="text-[10px] font-semibold uppercase tracking-wide">{meta.label}</span>
        {!result?.converged && (
          <span className="ml-auto font-mono text-[9px] text-red-300">SOLVER: NON-CONVERGENT</span>
        )}
      </div>

      {/* KPI grid */}
      {result && (
        <div className="grid grid-cols-2 gap-1.5">
          <Kpi icon={Gauge} label="Conversion" value={`${(result.conversion * 100).toFixed(1)}`} unit="%" tone={result.conversion > 0.9 ? "blue" : "default"} />
          <Kpi icon={Timer} label="Residence τ" value={result.residenceTime.toFixed(2)} unit="s" tone={result.residenceTime > 0 && result.residenceTime < 0.5 ? "amber" : "default"} />
          <Kpi icon={Thermometer} label="T outlet" value={result.outletTemperature.toFixed(0)} unit="K" />
          <Kpi icon={TrendingUp} label="k(T)" value={result.rateConstant < 1e-3 ? result.rateConstant.toExponential(1) : result.rateConstant.toFixed(3)} unit="1/s" />
          <Kpi icon={Beaker} label="A outlet" value={result.outletFlow.toFixed(2)} unit="mol/s" />
          <Kpi icon={Gauge} label="Residual" value={result.residual < 1e-4 ? result.residual.toExponential(1) : result.residual.toFixed(4)} tone={result.residual > 0.1 ? "amber" : "default"} />
        </div>
      )}

      {/* profile chart for PFR */}
      {!compact && chartData.length > 0 && (
        <div className="rounded-md border border-slate-700/50 bg-slate-950/50 p-2">
          <div className="mb-1 text-[9px] uppercase tracking-wider text-slate-500">
            Axial conversion profile
          </div>
          <ResponsiveContainer width="100%" height={70}>
            <AreaChart data={chartData} margin={{ top: 2, right: 4, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id={`grad-${node.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="v" tick={{ fontSize: 8, fill: "#64748b" }} stroke="#334155" />
              <YAxis tick={{ fontSize: 8, fill: "#64748b" }} stroke="#334155" domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  background: "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: 6,
                  fontSize: 10,
                  color: "#e2e8f0",
                }}
              />
              <Area type="monotone" dataKey="x" stroke="#22d3ee" strokeWidth={1.5} fill={`url(#grad-${node.id})`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* diagnostics */}
      {!compact && result && result.diagnostics.length > 0 && (
        <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-2">
          <div className="mb-1 flex items-center gap-1 text-[9px] uppercase tracking-wider text-amber-300/80">
            <AlertTriangle className="h-2.5 w-2.5" /> Diagnostics
          </div>
          <ul className="space-y-0.5 text-[10px] text-amber-200/80">
            {result.diagnostics.map((d, i) => (
              <li key={i} className="font-mono">· {d}</li>
            ))}
          </ul>
        </div>
      )}

      {/* parameter controls — constructive iteration, bypasses LLM */}
      {!compact && (isReactor || node.type === "separator" || node.type === "feed") && (
        <div className="space-y-2 rounded-md border border-slate-700/50 bg-slate-950/40 p-2">
          <div className="text-[9px] uppercase tracking-wider text-slate-500">
            Parameters · solver-bound
          </div>
          {isReactor && (
            <>
              <ParamControl
                label="Volume"
                value={params.volume}
                min={0.1}
                max={10}
                step={0.1}
                unit="m³"
                onChange={(v) => updateNodeParams(node.id, { volume: v })}
              />
              <ParamControl
                label="Temperature"
                value={params.temperature}
                min={290}
                max={450}
                step={1}
                unit="K"
                onChange={(v) => updateNodeParams(node.id, { temperature: v })}
              />
            </>
          )}
          {node.type === "separator" && (
            <ParamControl
              label="Split fraction"
              value={params.splitFraction}
              min={0}
              max={1}
              step={0.01}
              unit=""
              onChange={(v) => updateNodeParams(node.id, { splitFraction: v })}
            />
          )}
          {node.type === "feed" && (
            <>
              <ParamControl
                label="Feed rate"
                value={params.feedRate}
                min={1}
                max={30}
                step={0.5}
                unit="mol/s"
                onChange={(v) => updateNodeParams(node.id, { feedRate: v })}
              />
              <ParamControl
                label="Vol. flow"
                value={params.volumetricFlow}
                min={0.5}
                max={6}
                step={0.1}
                unit="m³/s"
                onChange={(v) => updateNodeParams(node.id, { volumetricFlow: v })}
              />
            </>
          )}
        </div>
      )}

      {compact && (
        <button
          onClick={() => selectNode(node.id)}
          className="mt-0.5 w-full rounded-md border border-slate-700/50 bg-slate-800/60 py-1 text-[10px] font-medium text-slate-300 transition-colors hover:bg-slate-700/60 hover:text-white"
        >
          Inspect
        </button>
      )}
    </div>
  );
}

export function DeepDiveOverlay() {
  const network = useTopology((s) => s.network);
  const report = useTopology((s) => s.report);
  const selectedNodeId = useTopology((s) => s.selectedNodeId);
  const pinnedNodeIds = useTopology((s) => s.pinnedNodeIds);

  const selectedNode = network.nodes.find((n) => n.id === selectedNodeId);
  const pinnedNodes = pinnedNodeIds
    .filter((id) => id !== selectedNodeId)
    .map((id) => network.nodes.find((n) => n.id === id))
    .filter(Boolean) as NetworkNode[];

  if (!selectedNode && pinnedNodes.length === 0) return null;

  return (
    <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 flex max-w-[92%] -translate-x-1/2 flex-row items-end gap-2">
      {/* pinned comparison cards (compact) */}
      {pinnedNodes.map((n) => (
        <div key={n.id} className="pointer-events-auto">
          <DeepDiveCard node={n} result={report?.results[n.id]} compact />
        </div>
      ))}

      {/* selected node — full card */}
      {selectedNode && (
        <div className="pointer-events-auto max-h-[78vh]">
          <ScrollArea className="eng-scroll max-h-[78vh]">
            <DeepDiveCard node={selectedNode} result={report?.results[selectedNode.id]} />
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
