"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { GLYPHS } from "../glyphs";
import type { NodeType, SolverResult } from "@/lib/solvers";
import { useTopology } from "@/lib/store/topology";
import { cn } from "@/lib/utils";

export interface ReactorNodeData {
  type: NodeType;
  label: string;
  result?: SolverResult;
  flowRate?: number;
}

const STATUS_RING: Record<SolverResult["status"], string> = {
  nominal: "ring-blue-500/40 shadow-[0_0_0_1px_rgba(59,130,246,0.35)]",
  warning: "ring-amber-500/50 shadow-[0_0_0_1px_rgba(245,158,11,0.45)]",
  error: "ring-red-500/60 shadow-[0_0_0_1px_rgba(239,68,68,0.55)]",
};

const STATUS_DOT: Record<SolverResult["status"], string> = {
  nominal: "bg-blue-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
};

function ReactorNodeImpl({ id, data, selected }: NodeProps) {
  const nodeData = data as ReactorNodeData;
  const Glyph = GLYPHS[nodeData.type];
  const hoveredId = useTopology((s) => s.hoveredNodeId);
  const setHovered = useTopology((s) => s.setHovered);
  const result = nodeData.result;
  const status = result?.status ?? "nominal";
  const isHovered = hoveredId === id;

  const showKpi = isHovered && result && (nodeData.type === "cstr" || nodeData.type === "pfr");

  return (
    <div
      className={cn(
        "group relative flex w-[150px] flex-col items-center rounded-lg bg-slate-900/80 p-2 backdrop-blur-sm transition-colors",
        "ring-1 ring-inset",
        STATUS_RING[status],
        selected && "ring-2 ring-cyan-400/70",
      )}
      onMouseEnter={() => setHovered(id)}
      onMouseLeave={() => setHovered(null)}
    >
      <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !border-0 !bg-slate-400" />

      {/* label row */}
      <div className="mb-1 flex w-full items-center justify-between px-1">
        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
          {nodeData.type}
        </span>
        <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[status])} />
      </div>

      {/* glyph */}
      <div className="h-16 w-16">
        <Glyph status={status} />
      </div>

      <div className="mt-1 text-center text-[11px] font-medium text-slate-200">
        {nodeData.label}
      </div>

      {/* hover KPI strip — only for reactors */}
      {showKpi && (
        <div className="mt-1.5 w-full rounded-md bg-slate-950/90 px-2 py-1 text-center font-mono text-[10px] text-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">X</span>
            <span className="text-slate-100">{(result!.conversion * 100).toFixed(1)}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">τ</span>
            <span className="text-slate-100">{result!.residenceTime.toFixed(2)}s</span>
          </div>
        </div>
      )}

      <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !border-0 !bg-slate-400" />
      {nodeData.type === "separator" && (
        <Handle
          id="top"
          type="source"
          position={Position.Top}
          className="!h-2.5 !w-2.5 !border-0 !bg-slate-400"
        />
      )}
    </div>
  );
}

export const ReactorNode = memo(ReactorNodeImpl);
