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
  nominal: "ring-zinc-700/60",
  warning: "ring-amber-500/50",
  error: "ring-red-500/60",
};

const STATUS_DOT: Record<SolverResult["status"], string> = {
  nominal: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
};

/** Card dimensions per equipment type (the separator is tall). */
const CARD_SIZE: Record<NodeType, { w: number; glyphH: number }> = {
  feed: { w: 158, glyphH: 56 },
  cstr: { w: 158, glyphH: 104 },
  pfr: { w: 178, glyphH: 66 },
  mixer: { w: 140, glyphH: 76 },
  separator: { w: 120, glyphH: 128 },
  product: { w: 158, glyphH: 56 },
};

function ReactorNodeImpl({ id, data, selected }: NodeProps) {
  const nodeData = data as ReactorNodeData;
  const Glyph = GLYPHS[nodeData.type];
  const hoveredId = useTopology((s) => s.hoveredNodeId);
  const setHovered = useTopology((s) => s.setHovered);
  const result = nodeData.result;
  const status = result?.status ?? "nominal";
  const isHovered = hoveredId === id;
  const size = CARD_SIZE[nodeData.type];

  const showKpi = isHovered && result && (nodeData.type === "cstr" || nodeData.type === "pfr");

  // Handles are type-aware so connections stay physically meaningful.
  const isFeed = nodeData.type === "feed";
  const isProduct = nodeData.type === "product";
  const isSeparator = nodeData.type === "separator";

  return (
    <div
      style={{ width: size.w }}
      className={cn(
        "group relative flex flex-col items-center rounded-md bg-zinc-900/85 p-2 backdrop-blur-sm ring-1 ring-inset transition-shadow",
        STATUS_RING[status],
        selected && "ring-2 ring-cyan-400/80 shadow-[0_0_0_1px_rgba(34,211,238,0.45)]",
      )}
      onMouseEnter={() => setHovered(id)}
      onMouseLeave={() => setHovered(null)}
    >
      {!isFeed && (
        <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-zinc-500" />
      )}

      {/* label row */}
      <div className="mb-1 flex w-full items-center justify-between px-0.5">
        <span className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">
          {nodeData.type}
        </span>
        <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[status])} />
      </div>

      {/* equipment illustration */}
      <div style={{ height: size.glyphH }} className="w-full">
        <Glyph id={id} />
      </div>

      <div className="mt-1 text-center text-[11px] font-medium text-zinc-200">
        {nodeData.label}
      </div>

      {/* hover KPI strip — only for reactors */}
      {showKpi && (
        <div className="mt-1.5 w-full rounded bg-zinc-950/90 px-2 py-1 font-mono text-[10px] text-zinc-300">
          <div className="flex items-center justify-between">
            <span className="text-zinc-600">X</span>
            <span className="text-zinc-100">{(result!.conversion * 100).toFixed(1)}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-600">τ</span>
            <span className="text-zinc-100">{result!.residenceTime.toFixed(2)}s</span>
          </div>
        </div>
      )}

      {!isProduct && !isSeparator && (
        <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-zinc-500" />
      )}
      {isSeparator && (
        <>
          <Handle type="source" position={Position.Top} className="!h-2 !w-2 !border-0 !bg-zinc-500" id="vapor" />
          <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-0 !bg-zinc-500" id="bottoms" />
        </>
      )}
    </div>
  );
}

export const ReactorNode = memo(ReactorNodeImpl);
