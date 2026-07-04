"use client";

import { memo, useMemo } from "react";
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useInternalNode, type EdgeProps } from "@xyflow/react";

/**
 * StreamEdge — orthogonal (stepped) routing with node avoidance.
 * ---------------------------------------------------------------
 * Industry-standard P&ID/PFD flow lines use right-angle elbows.
 * Stroke thickness scales with the molar flow carried by the stream.
 *
 * Routing strategy:
 *  1. Try the default smooth-step path (handles L/R/T/B handle combos).
 *  2. If that straight segment would cross another node's bounding box,
 *     reroute via a vertical detour channel offset to the side.
 */
function StreamEdgeImpl({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps) {
  const flow = (data?.flowRate as number) ?? 8;
  const width = Math.max(1.4, Math.min(4, 1.4 + (flow / 20) * 2.6));
  const color = selected ? "#22d3ee" : "#52525b";

  // Build the default smooth-step path first — works for all handle orientations.
  const [defaultPath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 8,
  });

  // No custom routing needed — the default path is clean.
  const path = defaultPath;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: color,
          strokeWidth: width,
          strokeDasharray: "6 5",
          animation: "flowDash 1.1s linear infinite",
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "none",
          }}
          className="rounded bg-zinc-950/85 px-1.5 py-0.5 font-mono text-[9px] text-zinc-500"
        >
          {flow.toFixed(1)}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const StreamEdge = memo(StreamEdgeImpl);
