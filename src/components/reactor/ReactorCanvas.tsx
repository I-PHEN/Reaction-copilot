"use client";

import { useCallback, useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type OnConnect,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ReactorNode, type ReactorNodeData } from "./nodes/ReactorNode";
import { StreamEdge } from "./StreamEdge";
import { useTopology } from "@/lib/store/topology";
import { Activity, CircleDot, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const nodeTypes = { reactor: ReactorNode };
const edgeTypes = { stream: StreamEdge };

function nodeColor(type: string) {
  switch (type) {
    case "feed": return "#22c55e";
    case "cstr": return "#3b82f6";
    case "pfr": return "#8b5cf6";
    case "mixer": return "#06b6d4";
    case "separator": return "#f59e0b";
    case "product": return "#ec4899";
    default: return "#64748b";
  }
}

function CanvasInner() {
  const network = useTopology((s) => s.network);
  const report = useTopology((s) => s.report);
  const selectedNodeId = useTopology((s) => s.selectedNodeId);
  const selectNode = useTopology((s) => s.selectNode);
  const updateNodePosition = useTopology((s) => s.updateNodePosition);
  const addNode = useTopology((s) => s.addNode);
  const removeNode = useTopology((s) => s.removeNode);
  const connectNodes = useTopology((s) => s.connectNodes);
  const removeStream = useTopology((s) => s.removeStream);
  const isSolving = useTopology((s) => s.isSolving);

  // Fully controlled: derive RF nodes/edges directly from the store each
  // render. The store is the single source of truth (Topology-as-State).
  // For a reactor network (3-7 nodes) the re-derive cost is well under the
  // sub-5ms latency target, and React Flow handles controlled dragging.
  const nodes = useMemo<Node<ReactorNodeData>[]>(
    () =>
      network.nodes.map((n) => ({
        id: n.id,
        type: "reactor",
        position: n.position,
        data: {
          type: n.type,
          label: n.label,
          result: report?.results[n.id],
          flowRate: network.streams.find((s) => s.source === n.id)?.flowRate ?? 0,
        },
        selected: selectedNodeId === n.id,
      })),
    [network, report, selectedNodeId],
  );

  const edges = useMemo<Edge[]>(
    () =>
      network.streams.map((s) => ({
        id: s.id,
        source: s.source,
        target: s.target,
        type: "stream",
        data: { flowRate: s.flowRate },
        animated: true,
      })),
    [network.streams],
  );

  // Mirror React Flow's change stream into the domain store. The store is
  // the single source of truth, so the next render recomputes `nodes` from
  // it — React Flow reads the updated positions/selection from the prop.
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      changes.forEach((c) => {
        if (c.type === "position" && c.position) updateNodePosition(c.id, c.position);
        if (c.type === "select") selectNode(c.selected ? c.id : null);
        if (c.type === "remove") removeNode(c.id);
      });
    },
    [updateNodePosition, selectNode, removeNode],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      changes.forEach((c) => {
        if (c.type === "remove") removeStream(c.id);
      });
    },
    [removeStream],
  );

  const onConnect: OnConnect = useCallback(
    (conn: Connection) => {
      if (conn.source && conn.target) connectNodes(conn.source, conn.target);
    },
    [connectNodes],
  );

  return (
    <div className="reactor-canvas relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, n) => selectNode(n.id)}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1.1 }}
        minZoom={0.3}
        maxZoom={2}
        defaultEdgeOptions={{ type: "stream" }}
        connectionLineStyle={{ stroke: "#22d3ee", strokeWidth: 2 }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#1e293b" />
        <Controls className="!bottom-4 !right-4" showInteractive={false} />
        <MiniMap
          className="!bottom-4 !left-4 !h-28 !w-48"
          nodeColor={(n) => nodeColor((n.data as ReactorNodeData)?.type ?? "")}
          maskColor="rgba(2,6,23,0.7)"
          pannable
          zoomable
        />

        {/* Top-left: topology status */}
        <Panel position="top-left" className="!m-3">
          <div className="flex items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-900/80 px-3 py-1.5 backdrop-blur">
            <Activity className="h-3.5 w-3.5 text-cyan-400" />
            <span className="font-mono text-[11px] text-slate-300">
              {network.nodes.length} units · {network.streams.length} streams
            </span>
            <span
              className={cn(
                "ml-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold",
                isSolving
                  ? "bg-cyan-500/10 text-cyan-300"
                  : report?.overallStatus === "error"
                    ? "bg-red-500/10 text-red-300"
                    : report?.overallStatus === "warning"
                      ? "bg-amber-500/10 text-amber-300"
                      : "bg-blue-500/10 text-blue-300",
              )}
            >
              <CircleDot className="h-2.5 w-2.5" />
              {isSolving ? "SOLVING" : (report?.overallStatus ?? "idle").toUpperCase()}
            </span>
          </div>
        </Panel>

        {/* Top-right: add-unit palette */}
        <Panel position="top-right" className="!m-3">
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-700/60 bg-slate-900/80 p-1 backdrop-blur">
            {(["feed", "cstr", "pfr", "mixer", "separator", "product"] as const).map((t) => (
              <button
                key={t}
                onClick={() => addNode(t)}
                title={`Add ${t.toUpperCase()}`}
                className="flex items-center rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-slate-300 transition-colors hover:bg-slate-700/70 hover:text-white"
              >
                <Plus className="mr-0.5 h-2.5 w-2.5" />
                {t}
              </button>
            ))}
            <div className="mx-1 h-4 w-px bg-slate-700" />
            <button
              onClick={() => selectedNodeId && removeNode(selectedNodeId)}
              disabled={!selectedNodeId}
              className="flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[10px] uppercase text-slate-300 transition-colors hover:bg-red-500/20 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
              title="Delete selected node"
            >
              <Trash2 className="h-3 w-3" /> Del
            </button>
          </div>
        </Panel>

        {/* Bottom-right legend */}
        <Panel position="bottom-right" className="!m-3">
          <div className="rounded-lg border border-slate-700/60 bg-slate-900/80 px-3 py-2 backdrop-blur">
            <div className="mb-1 font-mono text-[9px] uppercase tracking-wider text-slate-500">
              Status
            </div>
            <div className="flex flex-col gap-1 text-[10px]">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="h-2 w-2 rounded-full bg-blue-500" /> Nominal
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> Constraint
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="h-2 w-2 rounded-full bg-red-500" /> Non-convergent
              </span>
            </div>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}

export function ReactorCanvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
