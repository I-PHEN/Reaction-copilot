"use client";

import { memo } from "react";
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";

/**
 * StreamEdge
 * ---------------------------------------------------------------
 * Directional flow line. Stroke thickness scales with the molar flow
 * carried by the stream. A subtle marching-ants dash gives a "flow"
 * indicator without bouncy motion (functional state change only).
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
  // Map flow [0..20] mol/s to stroke width [1.4..4.5]px.
  const width = Math.max(1.4, Math.min(4.5, 1.4 + (flow / 20) * 3.1));
  const color = selected ? "#22d3ee" : "#64748b";

  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
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
          className="rounded bg-slate-950/80 px-1.5 py-0.5 font-mono text-[9px] text-slate-400"
        >
          {flow.toFixed(1)} mol/s
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const StreamEdge = memo(StreamEdgeImpl);
