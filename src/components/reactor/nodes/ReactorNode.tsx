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
  // React Flow node data must be assignable to Record<string, unknown>.
  [key: string]: unknown;
}

const STATUS_DOT: Record<SolverResult["status"], string> = {
  nominal: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
};

/**
 * Dimensions per equipment type. Width is computed from the SVG viewBox
 * aspect ratio so the glyph fills the wrapper with zero letterboxing —
 * this makes React Flow handles (at the wrapper edge) sit exactly on the
 * nozzle tips. Height = glyph area only; the label is absolutely
 * positioned below so it doesn't shift handle positions.
 */
const NODE_SIZE: Record<NodeType, { w: number; glyphH: number }> = {
  feed: { w: 146, glyphH: 95 },
  cstr: { w: 144, glyphH: 183 },
  pfr: { w: 173, glyphH: 117 },
  mixer: { w: 122, glyphH: 122 },
  separator: { w: 108, glyphH: 210 },
  product: { w: 146, glyphH: 95 },
};

function ReactorNodeImpl({ id, data, selected }: NodeProps) {
  const nodeData = data as ReactorNodeData;
  const Glyph = GLYPHS[nodeData.type];
  const result = nodeData.result;
  const status = result?.status ?? "nominal";
  const size = NODE_SIZE[nodeData.type];

  const isFeed = nodeData.type === "feed";
  const isProduct = nodeData.type === "product";
  const isSeparator = nodeData.type === "separator";

  return (
    <div
      style={{ width: size.w, height: size.glyphH }}
      className={cn(
        "group relative transition-[filter] duration-150",
        selected && "[filter:drop-shadow(0_0_6px_rgba(34,211,238,0.55))]",
      )}
    >
      {!isFeed && (
        <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-zinc-600" />
      )}

      {/* equipment illustration — fills the wrapper exactly */}
      <Glyph id={id} />

      {/* label — absolutely positioned below the glyph so it never
          affects handle positions or wrapper bounds */}
      <div
        className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap"
        style={{ top: size.glyphH + 6 }}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[status])} />
        <span
          className={cn(
            "text-[12px] font-semibold transition-colors",
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
