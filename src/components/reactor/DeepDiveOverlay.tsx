"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  SlidersHorizontal,
  LineChart,
  LayoutDashboard,
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

const STATUS_META: Record<
  SolverResult["status"],
  { label: string; color: string; ring: string; Icon: typeof CheckCircle2 }
> = {
  nominal: { label: "Nominal", color: "text-emerald-400", ring: "ring-emerald-500/30", Icon: CheckCircle2 },
  warning: { label: "Constraint", color: "text-amber-400", ring: "ring-amber-500/30", Icon: AlertTriangle },
  error: { label: "Non-convergent", color: "text-red-400", ring: "ring-red-500/30", Icon: XCircle },
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
      ? "text-cyan-300"
      : tone === "amber"
        ? "text-amber-300"
        : tone === "red"
          ? "text-red-300"
          : "text-zinc-100";
  return (
    <div className="rounded-md border border-zinc-800/60 bg-zinc-950/60 px-2 py-1.5">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-zinc-500">
        <Icon className="h-2.5 w-2.5" />
        {label}
      </div>
      <div className={cn("mt-0.5 font-mono text-sm font-semibold tabular-nums", toneClass)}>
        {value}
        {unit && <span className="ml-0.5 text-[10px] font-normal text-zinc-500">{unit}</span>}
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
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
        <span className="font-mono text-[11px] text-zinc-200">
          {value.toFixed(step < 1 ? 2 : 0)}
          <span className="ml-0.5 text-zinc-500">{unit}</span>
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

type TabId = "overview" | "profile" | "parameters";

function DeepDiveCard({
  node,
  result,
  compact = false,
  onClose,
}: {
  node: NetworkNode;
  result: SolverResult | undefined;
  compact?: boolean;
  onClose?: () => void;
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
  const isPfr = node.type === "pfr";
  const hasParams = isReactor || node.type === "separator" || node.type === "feed";
  const hasDiagnostics = result && result.diagnostics.length > 0;

  // Tabs: only show Profile for PFR. Parameters only if hasParams.
  const availableTabs: TabId[] = ["overview"];
  if (isPfr) availableTabs.push("profile");
  if (hasParams) availableTabs.push("parameters");
  const [tab, setTab] = useState<TabId>("overview");

  // --- Live KPI flash: a key change on the flash overlay remounts it,
  // replaying the CSS kpiFlash animation whenever conversion changes. ---
  const convKey = result?.conversion?.toFixed(4) ?? "none";

  if (compact) {
    return (
      <div
        className={cn(
          "glass-card flex w-[190px] flex-col gap-1.5 rounded-xl border border-zinc-700/40 bg-zinc-900/70 p-2.5 backdrop-blur-md",
          "shadow-[0_8px_32px_rgba(0,0,0,0.5)] ring-1 ring-inset",
          meta.ring,
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className={cn("h-1.5 w-1.5 rounded-full", status === "nominal" ? "bg-emerald-500" : status === "warning" ? "bg-amber-500" : "bg-red-500")} />
            <span className="text-[12px] font-semibold text-zinc-100">{node.label}</span>
          </div>
          <button
            onClick={() => togglePin(node.id)}
            title="Unpin"
            className="rounded p-0.5 text-cyan-300 transition-colors hover:bg-cyan-500/20"
          >
            <Pin className="h-3 w-3" />
          </button>
        </div>
        {result && (
          <div className="grid grid-cols-2 gap-1">
            <Kpi icon={Gauge} label="X" value={`${(result.conversion * 100).toFixed(1)}`} unit="%" />
            <Kpi icon={Timer} label="τ" value={result.residenceTime.toFixed(2)} unit="s" />
          </div>
        )}
        <button
          onClick={() => selectNode(node.id)}
          className="w-full rounded-md border border-zinc-800/50 bg-zinc-800/60 py-1 text-[10px] font-medium text-zinc-300 transition-colors hover:bg-zinc-700/60 hover:text-white"
        >
          Inspect
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "glass-card flex w-[300px] flex-col gap-2 rounded-xl border border-zinc-700/40 bg-zinc-900/80 p-3 backdrop-blur-md",
        "shadow-[0_8px_32px_rgba(0,0,0,0.5)] ring-1 ring-inset",
        meta.ring,
      )}
    >
      {/* header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
            {node.type}
          </span>
          <span className="text-sm font-semibold text-zinc-100">{node.label}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => togglePin(node.id)}
            title={isPinned ? "Unpin" : "Pin for comparison"}
            className={cn(
              "rounded p-1 transition-colors",
              isPinned ? "text-cyan-300 hover:bg-cyan-500/20" : "text-zinc-400 hover:bg-zinc-700/60 hover:text-zinc-200",
            )}
          >
            {isPinned ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              title="Close"
              className="rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-700/60 hover:text-zinc-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* status banner */}
      <div className={cn("flex items-center gap-1.5 rounded-md bg-zinc-950/60 px-2 py-1", meta.color)}>
        <meta.Icon className="h-3 w-3" />
        <span className="text-[10px] font-semibold uppercase tracking-wide">{meta.label}</span>
        {!result?.converged && (
          <span className="ml-auto font-mono text-[9px] text-red-300">SOLVER: NON-CONVERGENT</span>
        )}
      </div>

      {/* tab bar — only when multiple tabs */}
      {availableTabs.length > 1 && (
        <div className="flex gap-0.5 rounded-md bg-zinc-950/50 p-0.5">
          {availableTabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1 rounded px-2 py-1 text-[10px] font-medium uppercase tracking-wide transition-colors",
                tab === t
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300",
              )}
            >
              {t === "overview" && <LayoutDashboard className="h-2.5 w-2.5" />}
              {t === "profile" && <LineChart className="h-2.5 w-2.5" />}
              {t === "parameters" && <SlidersHorizontal className="h-2.5 w-2.5" />}
              {t}
            </button>
          ))}
        </div>
      )}

      {/* tab content */}
      <AnimatePresence mode="wait">
        {tab === "overview" && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.15 }}
            className="space-y-1.5"
          >
            {result && (
              <div className="relative grid grid-cols-2 gap-1.5 rounded-md">
                <div
                  key={convKey}
                  className="pointer-events-none absolute inset-0 rounded-md"
                  style={{ animation: "kpiFlash 0.45s ease-out" }}
                />
                <Kpi icon={Gauge} label="Conversion" value={`${(result.conversion * 100).toFixed(1)}`} unit="%" tone={result.conversion > 0.9 ? "blue" : "default"} />
                <Kpi icon={Timer} label="Residence τ" value={result.residenceTime.toFixed(2)} unit="s" tone={result.residenceTime > 0 && result.residenceTime < 0.5 ? "amber" : "default"} />
                <Kpi icon={Thermometer} label="T outlet" value={result.outletTemperature.toFixed(0)} unit="K" />
                <Kpi icon={TrendingUp} label="k(T)" value={result.rateConstant < 1e-3 ? result.rateConstant.toExponential(1) : result.rateConstant.toFixed(3)} unit="1/s" />
                <Kpi icon={Beaker} label="A outlet" value={result.outletFlow.toFixed(2)} unit="mol/s" />
                <Kpi icon={Gauge} label="Residual" value={result.residual < 1e-4 ? result.residual.toExponential(1) : result.residual.toFixed(4)} tone={result.residual > 0.1 ? "amber" : "default"} />
              </div>
            )}
            {hasDiagnostics && (
              <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-2">
                <div className="mb-1 flex items-center gap-1 text-[9px] uppercase tracking-wider text-amber-300/80">
                  <AlertTriangle className="h-2.5 w-2.5" /> Diagnostics
                </div>
                <ul className="space-y-0.5 text-[10px] text-amber-200/80">
                  {result!.diagnostics.map((d, i) => (
                    <li key={i} className="font-mono">· {d}</li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}

        {tab === "profile" && chartData.length > 0 && (
          <motion.div
            key="profile"
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.15 }}
          >
            <div className="rounded-md border border-zinc-800/50 bg-zinc-950/50 p-2">
              <div className="mb-1 text-[9px] uppercase tracking-wider text-zinc-500">
                Axial conversion profile
              </div>
              <ResponsiveContainer width="100%" height={90}>
                <AreaChart data={chartData} margin={{ top: 2, right: 4, bottom: 0, left: -18 }}>
                  <defs>
                    <linearGradient id={`grad-${node.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="v" tick={{ fontSize: 8, fill: "#71717a" }} stroke="#3f3f46" />
                  <YAxis tick={{ fontSize: 8, fill: "#71717a" }} stroke="#3f3f46" domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      background: "#09090b",
                      border: "1px solid #3f3f46",
                      borderRadius: 6,
                      fontSize: 10,
                      color: "#e4e4e7",
                    }}
                  />
                  <Area type="monotone" dataKey="x" stroke="#22d3ee" strokeWidth={1.5} fill={`url(#grad-${node.id})`} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {hasDiagnostics && (
              <div className="mt-1.5 rounded-md border border-amber-500/20 bg-amber-500/5 p-2">
                <div className="mb-1 flex items-center gap-1 text-[9px] uppercase tracking-wider text-amber-300/80">
                  <AlertTriangle className="h-2.5 w-2.5" /> Diagnostics
                </div>
                <ul className="space-y-0.5 text-[10px] text-amber-200/80">
                  {result!.diagnostics.map((d, i) => (
                    <li key={i} className="font-mono">· {d}</li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}

        {tab === "parameters" && hasParams && (
          <motion.div
            key="parameters"
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.15 }}
            className="space-y-2.5 rounded-md border border-zinc-800/50 bg-zinc-950/40 p-2.5"
          >
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
            <div className="pt-0.5 text-[9px] text-zinc-600">
              Adjusting parameters triggers the verified solver directly — bypasses the LLM.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function DeepDiveOverlay() {
  const network = useTopology((s) => s.network);
  const report = useTopology((s) => s.report);
  const inspectedNodeId = useTopology((s) => s.inspectedNodeId);
  const pinnedNodeIds = useTopology((s) => s.pinnedNodeIds);
  const inspectNode = useTopology((s) => s.inspectNode);

  const inspectedNode = network.nodes.find((n) => n.id === inspectedNodeId);
  const pinnedNodes = pinnedNodeIds
    .filter((id) => id !== inspectedNodeId)
    .map((id) => network.nodes.find((n) => n.id === id))
    .filter(Boolean) as NetworkNode[];

  const show = inspectedNode || pinnedNodes.length > 0;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="pointer-events-none absolute bottom-3 left-1/2 z-20 flex max-w-[92%] -translate-x-1/2 flex-row items-end gap-2"
        >
          {pinnedNodes.map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="pointer-events-auto"
            >
              <DeepDiveCard node={n} result={report?.results[n.id]} compact />
            </motion.div>
          ))}

          {inspectedNode && (
            <motion.div
              key={inspectedNode.id}
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="pointer-events-auto max-h-[78vh] overflow-y-auto eng-scroll"
            >
              <DeepDiveCard
                node={inspectedNode}
                result={report?.results[inspectedNode.id]}
                onClose={() => inspectNode(null)}
              />
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
