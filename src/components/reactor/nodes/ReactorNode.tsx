"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { GLYPHS } from "../glyphs";
import type { NodeType, SolverResult } from "@/lib/solvers";
import { cn } from "@/lib/utils";

export interface ReactorNodeData {
  type: NodeType;
  label: string;
  result?: SolverResult;
  flowRate?: number;
}

const STATUS_DOT: Record<SolverResult["status"], string> = {
  nominal: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
};

/** Dimensions per equipment type — large, detailed illustrations. */
const NODE_SIZE: Record<NodeType, { w: number; glyphH: number }> = {
  feed: { w: 176, glyphH: 90 },
  cstr: { w: 176, glyphH: 166 },
  pfr: { w: 208, glyphH: 106 },
  mixer: { w: 154, glyphH: 122 },
  separator: { w: 134, glyphH: 205 },
  product: { w: 176, glyphH: 90 },
};

function ReactorNodeImpl({ id, data, selected }: NodeProps) {
  const nodeData = data as ReactorNodeData;
  const Glyph = GLYPHS[nodeData.type];
  const result = nodeData.result;
  const status = result?.status ?? "nominal";
  const size = NODE_SIZE[nodeData.type];

  // Handles are type-aware so connections stay physically meaningful.
  const isFeed = nodeData.type === "feed";
  const isProduct = nodeData.type === "product";
  const isSeparator = nodeData.type === "separator";

  return (
    <div
      style={{ width: size.w }}
      className={cn(
        // No card, no background, no border — equipment floats on the canvas,
        // Aspen-style. A transparent wrapper only anchors the handles.
        "group relative flex flex-col items-center transition-[filter] duration-150",
        // Selection = soft cyan glow that follows the equipment's actual shape,
        // not a rectangle.
        selected && "[filter:drop-shadow(0_0_6px_rgba(34,211,238,0.55))]",
      )}
    >
      {!isFeed && (
        <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-zinc-600" />
      )}

      {/* equipment illustration — sits directly on the canvas */}
      <div style={{ height: size.glyphH }} className="w-full">
        <Glyph id={id} />
      </div>

      {/* label + status dot — plain text, no background */}
      <div className="mt-1 flex items-center gap-1">
        <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[status])} />
        <span
          className={cn(
            "text-[11px] font-medium whitespace-nowrap transition-colors",
            selected ? "text-cyan-300" : "text-zinc-300",
          )}
        >
          {nodeData.label}
        </span>
      </div>

      {!isProduct && !isSeparator && (
        <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-zinc-600" />
      )}
      {isSeparator && (
        <>
          <Handle type="source" position={Position.Top} className="!h-2 !w-2 !border-0 !bg-zinc-600" id="vapor" />
          <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-0 !bg-zinc-600" id="bottoms" />
        </>
      )}
    </div>
  );
}

export const ReactorNode = memo(ReactorNodeImpl);
