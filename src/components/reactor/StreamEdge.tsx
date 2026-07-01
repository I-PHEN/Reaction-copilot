"use client";

import { memo } from "react";
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from "@xyflow/react";

/**
 * StreamEdge — orthogonal (stepped) routing.
 * ---------------------------------------------------------------
 * Industry-standard P&ID/PFD flow lines use right-angle elbows, not
 * curves. Stroke thickness scales with the molar flow carried by the
 * stream. A subtle marching-ants dash gives a "flow" indicator without
 * bouncy motion (functional state change only).
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
  // Map flow [0..20] mol/s to stroke width [1.4..4]px.
  const width = Math.max(1.4, Math.min(4, 1.4 + (flow / 20) * 2.6));
  const color = selected ? "#22d3ee" : "#52525b";

  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 8,
  });

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
