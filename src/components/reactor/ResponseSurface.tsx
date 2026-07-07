"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Target, TrendingUp, Gauge, Crosshair } from "lucide-react";
import { useTopology } from "@/lib/store/topology";
import { cn } from "@/lib/utils";
import type { OptimizationResult } from "@/lib/solvers";

/** Map a conversion value [0..1] to a color on a cyan→emerald→amber scale. */
function conversionColor(x: number, max: number): string {
  const t = max > 0 ? x / max : 0;
  // 0 = dark zinc, 0.5 = cyan, 1 = emerald
  if (t < 0.5) {
    const r = t * 2;
    const c = Math.round(24 + r * 34); // 24→58
    return `rgb(${Math.round(39 + r * 20)}, ${Math.round(39 + r * 80)}, ${Math.round(42 + r * 100)})`;
  }
  const r = (t - 0.5) * 2;
  return `rgb(${Math.round(59 + r * 60)}, ${Math.round(119 + r * 60)}, ${Math.round(142 - r * 40)})`;
}

function Heatmap({ result }: { result: OptimizationResult }) {
  const { surface, volumes, temperatures, optimal } = result;
  const maxConv = Math.max(...surface.flat().map((p) => p.conversion), 0.001);

  return (
    <div className="flex gap-2">
      {/* Y-axis label */}
      <div className="flex flex-col justify-center">
        <span className="rotate-180 text-[9px] uppercase tracking-wider text-zinc-500 [writing-mode:vertical-rl]">
          Temperature (K)
        </span>
      </div>
      {/* Heatmap grid */}
      <div className="flex-1">
        <div
          className="grid gap-px"
          style={{
            gridTemplateColumns: `repeat(${temperatures.length}, 1fr)`,
          }}
        >
          {surface
            .flatMap((row, vi) =>
              row.map((point, ti) => (
                <div
                  key={`${vi}-${ti}`}
                  className="aspect-square rounded-[1px] transition-transform hover:scale-110 hover:ring-1 hover:ring-cyan-300"
                  style={{ backgroundColor: conversionColor(point.conversion, maxConv) }}
                  title={`V=${point.volume.toFixed(2)}m³, T=${point.temperature.toFixed(0)}K → X=${(point.conversion * 100).toFixed(1)}%`}
                />
              )),
            )
            .reverse()}{" "}
          {/* reverse so high-T is on top */}
        </div>
        {/* X-axis label */}
        <div className="mt-1 text-center text-[9px] uppercase tracking-wider text-zinc-500">
          Volume (m³)
        </div>
      </div>
      {/* Optimal point indicator */}
      <div className="flex w-20 flex-col justify-center text-[10px] text-zinc-400">
        <div className="mb-1 flex items-center gap-1 text-cyan-400">
          <Crosshair className="h-3 w-3" /> Optimal
        </div>
        <div className="font-mono text-zinc-200">X={(optimal.conversion * 100).toFixed(1)}%</div>
        <div className="text-zinc-500">
          V={optimal.volume.toFixed(2)}
          <br />
          T={optimal.temperature.toFixed(0)}K
        </div>
      </div>
    </div>
  );
}

export function ResponseSurface() {
  const optimization = useTopology((s) => s.optimization);
  const clearOptimization = useTopology((s) => s.clearOptimization);
  const updateNodeParams = useTopology((s) => s.updateNodeParams);

  return (
    <AnimatePresence>
      {optimization && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25 }}
          className="shrink-0 overflow-hidden border-t border-zinc-800/80 bg-zinc-950"
        >
          <div className="flex items-center gap-2 px-4 py-2">
            <Target className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-[12px] font-medium text-zinc-200">
              Optimization · {optimization.nodeLabel}
            </span>
            <span className="font-mono text-[10px] text-zinc-600">
              {optimization.objective} · {optimization.evaluations} solver evaluations
            </span>
            <button
              onClick={clearOptimization}
              className="ml-auto flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-300"
            >
              <X className="h-3 w-3" /> Dismiss
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 px-4 pb-3 md:grid-cols-[1fr_200px]">
            {/* Heatmap */}
            <div className="rounded-lg border border-zinc-800/60 bg-zinc-950/50 p-3">
              <div className="mb-2 text-[9px] uppercase tracking-wider text-zinc-500">
                Response surface · conversion vs volume × temperature
              </div>
              <Heatmap result={optimization} />
              {/* Color legend */}
              <div className="mt-2 flex items-center gap-2 text-[9px] text-zinc-600">
                <span>low</span>
                <div className="h-2 flex-1 rounded-full bg-gradient-to-r from-zinc-700 via-cyan-600 to-emerald-500" />
                <span>high</span>
              </div>
            </div>

            {/* Optimal + sensitivity */}
            <div className="space-y-2">
              <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3">
                <div className="mb-1 flex items-center gap-1 text-[9px] uppercase tracking-wider text-cyan-400">
                  <Crosshair className="h-2.5 w-2.5" /> Optimal operating point
                </div>
                <div className="space-y-0.5 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Conversion</span>
                    <span className="text-cyan-300">
                      {(optimization.optimal.conversion * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Volume</span>
                    <span className="text-zinc-200">
                      {optimization.optimal.volume.toFixed(2)} m³
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Temperature</span>
                    <span className="text-zinc-200">
                      {optimization.optimal.temperature.toFixed(0)} K
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Residence τ</span>
                    <span className="text-zinc-200">
                      {optimization.optimal.residenceTime.toFixed(2)} s
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">k(T)</span>
                    <span className="text-zinc-200">
                      {optimization.optimal.rateConstant.toFixed(4)}/s
                    </span>
                  </div>
                </div>
                <button
                  onClick={() =>
                    updateNodeParams(optimization.nodeId, {
                      volume: optimization.optimal.volume,
                      temperature: optimization.optimal.temperature,
                    })
                  }
                  className="mt-2 w-full rounded-md border border-cyan-500/40 bg-cyan-500/10 py-1 text-[10px] font-medium text-cyan-300 transition-colors hover:bg-cyan-500/20"
                >
                  Apply to reactor
                </button>
              </div>

              <div className="rounded-lg border border-zinc-800/60 bg-zinc-950/50 p-3">
                <div className="mb-1 flex items-center gap-1 text-[9px] uppercase tracking-wider text-zinc-500">
                  <TrendingUp className="h-2.5 w-2.5" /> Sensitivity
                </div>
                <div className="space-y-1 text-[10px]">
                  <div className="flex items-center gap-2">
                    <Gauge className="h-2.5 w-2.5 text-zinc-600" />
                    <span className="text-zinc-400">Volume</span>
                    <div className="flex-1 rounded-full bg-zinc-800">
                      <div
                        className="h-1.5 rounded-full bg-cyan-500"
                        style={{ width: `${Math.min(100, optimization.sensitivity.volume * 100)}%` }}
                      />
                    </div>
                    <span className="font-mono text-zinc-500">
                      {(optimization.sensitivity.volume * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-2.5 w-2.5 text-zinc-600" />
                    <span className="text-zinc-400">Temperature</span>
                    <div className="flex-1 rounded-full bg-zinc-800">
                      <div
                        className="h-1.5 rounded-full bg-amber-500"
                        style={{ width: `${Math.min(100, optimization.sensitivity.temperature * 100)}%` }}
                      />
                    </div>
                    <span className="font-mono text-zinc-500">
                      {(optimization.sensitivity.temperature * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="pt-0.5 text-[9px] text-zinc-600">
                    Dominant:{" "}
                    <span className="text-zinc-400">{optimization.sensitivity.dominant}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
