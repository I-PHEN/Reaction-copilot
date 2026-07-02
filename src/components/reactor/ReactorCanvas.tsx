"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
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
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const nodeTypes = { reactor: ReactorNode };
const edgeTypes = { stream: StreamEdge };

const UNIT_OPTIONS: { type: ReactorNodeData["type"]; desc: string }[] = [
  { type: "feed", desc: "Inlet stream source" },
  { type: "cstr", desc: "Continuous stirred tank" },
  { type: "pfr", desc: "Plug-flow reactor" },
  { type: "mixer", desc: "Stream mixer" },
  { type: "separator", desc: "Trayed separator" },
  { type: "product", desc: "Outlet sink" },
];

function AddUnitButton() {
  const addNode = useTopology((s) => s.addNode);
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-700/60 bg-zinc-900/80 text-zinc-300 backdrop-blur transition-colors hover:border-zinc-600 hover:text-white"
          title="Add unit"
        >
          <Plus className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-48 border-zinc-700 bg-zinc-900 p-1.5 text-zinc-200"
      >
        <div className="mb-1 px-1.5 text-[9px] uppercase tracking-wider text-zinc-500">
          Add unit
        </div>
        {UNIT_OPTIONS.map((o) => (
          <button
            key={o.type}
            onClick={() => {
              addNode(o.type);
              setOpen(false);
            }}
            className="flex w-full flex-col items-start rounded px-2 py-1.5 text-left transition-colors hover:bg-zinc-800"
          >
            <span className="font-mono text-[11px] uppercase tracking-wide text-zinc-200">
              {o.type}
            </span>
            <span className="text-[10px] text-zinc-500">{o.desc}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function CanvasInner() {
  const network = useTopology((s) => s.network);
  const report = useTopology((s) => s.report);
  const selectedNodeId = useTopology((s) => s.selectedNodeId);
  const inspectedNodeId = useTopology((s) => s.inspectedNodeId);
  const selectNode = useTopology((s) => s.selectNode);
  const updateNodePosition = useTopology((s) => s.updateNodePosition);
  const removeNode = useTopology((s) => s.removeNode);
  const connectNodes = useTopology((s) => s.connectNodes);
  const removeStream = useTopology((s) => s.removeStream);

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

  const inspectNode = useTopology((s) => s.inspectNode);
  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, n: Node) => inspectNode(n.id),
    [inspectNode],
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
        onNodeDoubleClick={onNodeDoubleClick}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1.1 }}
        minZoom={0.3}
        maxZoom={2}
        defaultEdgeOptions={{ type: "stream" }}
        connectionLineStyle={{ stroke: "#22d3ee", strokeWidth: 2 }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#1a1a1d" />
        <Controls
          className="!bottom-3 !right-3 !rounded-md !overflow-hidden !border !border-zinc-800"
          showInteractive={false}
        />

        {/* Single top-right control cluster: add-unit + delete */}
        <Panel position="top-right" className="!m-3">
          <div className="flex items-center gap-1.5">
            <AddUnitButton />
            <button
              onClick={() => selectedNodeId && removeNode(selectedNodeId)}
              disabled={!selectedNodeId}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-700/60 bg-zinc-900/80 text-zinc-300 backdrop-blur transition-colors hover:border-red-500/40 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-30"
              title="Delete selected unit"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </Panel>

        {/* Subtle discoverability hint — only when nothing is inspected */}
        {!inspectedNodeId && (
          <Panel position="top-left" className="!m-3">
            <div className="rounded-md border border-zinc-800/60 bg-zinc-900/70 px-2.5 py-1 font-mono text-[10px] text-zinc-600 backdrop-blur">
              double-click a unit to inspect
            </div>
          </Panel>
        )}
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
