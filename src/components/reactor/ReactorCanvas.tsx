"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
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
import { Plus, Trash2, Inspect, Copy, Pin, Network, Undo2, Redo2, Share2, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { NodeType } from "@/lib/solvers";

const nodeTypes = { reactor: ReactorNode };
const edgeTypes = { stream: StreamEdge };

const UNIT_OPTIONS: { type: NodeType; desc: string }[] = [
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
  const addNode = useTopology((s) => s.addNode);
  const removeNode = useTopology((s) => s.removeNode);
  const duplicateNode = useTopology((s) => s.duplicateNode);
  const connectNodes = useTopology((s) => s.connectNodes);
  const removeStream = useTopology((s) => s.removeStream);
  const inspectNode = useTopology((s) => s.inspectNode);
  const togglePin = useTopology((s) => s.togglePin);
  const requestConfig = useTopology((s) => s.requestConfig);
  const undo = useTopology((s) => s.undo);
  const redo = useTopology((s) => s.redo);
  const canUndo = useTopology((s) => s.canUndo);
  const canRedo = useTopology((s) => s.canRedo);
  const reactFlow = useReactFlow();
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);

  // "Connect to..." mode: after selecting Connect from the context menu,
  // the next node click creates a stream from the source to that target.
  const handleNodeClickForConnect = useCallback(
    (nodeId: string) => {
      if (connectSourceId && connectSourceId !== nodeId) {
        connectNodes(connectSourceId, nodeId);
        setConnectSourceId(null);
      }
    },
    [connectSourceId, connectNodes],
  );

  // Keyboard shortcuts:
  //   Ctrl/Cmd + = / - / 0  → zoom in / out / fit
  //   Ctrl/Cmd + Z           → undo   |  Ctrl/Cmd + Shift + Z (or Ctrl+Y) → redo
  //   Delete / Backspace     → remove selected node
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // Don't intercept when typing in the chat composer or any input.
      if (target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.isContentEditable) return;

      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        reactFlow.zoomIn({ duration: 200 });
      } else if (mod && e.key === "-") {
        e.preventDefault();
        reactFlow.zoomOut({ duration: 200 });
      } else if (mod && e.key === "0") {
        e.preventDefault();
        reactFlow.fitView({ duration: 300, padding: 0.25 });
      } else if (mod && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        redo();
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedNodeId) {
        e.preventDefault();
        removeNode(selectedNodeId);
      } else if (e.key === "Escape") {
        setConnectSourceId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reactFlow, selectedNodeId, removeNode, undo, redo]);

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

  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, n: Node) => inspectNode(n.id),
    [inspectNode],
  );

  return (
    <div className="reactor-canvas relative h-full w-full">
      <ContextMenu>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, n) => {
          if (connectSourceId) {
            handleNodeClickForConnect(n.id);
          } else {
            selectNode(n.id);
          }
        }}
          onNodeDoubleClick={onNodeDoubleClick}
          onNodeContextMenu={(e, n) => {
            e.preventDefault();
            selectNode(n.id);
          }}
          zoomOnDoubleClick={false}
          deleteKeyCode={null}
          fitView
          fitViewOptions={{ padding: 0.25, maxZoom: 1.1 }}
          minZoom={0.2}
          maxZoom={4}
          defaultEdgeOptions={{ type: "stream" }}
          connectionLineStyle={{ stroke: "#22d3ee", strokeWidth: 2 }}
          style={{ cursor: "default" }}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#1a1a1d" />
          <Controls
            className="!bottom-3 !right-3 !rounded-md !overflow-hidden !border !border-zinc-800"
            showInteractive={false}
          />

          {/* Top-right control cluster: undo/redo + add-unit + delete */}
          <Panel position="top-right" className="!m-3">
            <div className="flex items-center gap-1.5">
              <button
                onClick={undo}
                disabled={!canUndo}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-700/60 bg-zinc-900/80 text-zinc-300 backdrop-blur transition-colors hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-700/60 bg-zinc-900/80 text-zinc-300 backdrop-blur transition-colors hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                title="Redo (Ctrl+Shift+Z)"
              >
                <Redo2 className="h-3.5 w-3.5" />
              </button>
              <div className="mx-0.5 h-5 w-px bg-zinc-800" />
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

          {/* Subtle discoverability hint — only when nothing is inspected and canvas has nodes */}
          {network.nodes.length > 0 && !inspectedNodeId && (
            <Panel position="top-left" className="!m-3">
              <div className="rounded-md border border-zinc-800/60 bg-zinc-900/70 px-2.5 py-1 font-mono text-[10px] text-zinc-600 backdrop-blur">
                double-click a unit to inspect · right-click for options
              </div>
            </Panel>
          )}

          {/* Connect-mode indicator — shows when "Connect to..." is active */}
          {connectSourceId && (
            <Panel position="top-center" className="!m-0 !w-full">
              <div className="flex justify-center pt-3">
                <div className="flex items-center gap-2 rounded-full border border-cyan-500/40 bg-zinc-900/95 px-3 py-1.5 text-[11px] text-cyan-300 shadow-lg backdrop-blur">
                  <Share2 className="h-3 w-3" />
                  Click a target unit to connect
                  <button
                    onClick={() => setConnectSourceId(null)}
                    className="ml-1 rounded px-1.5 py-0.5 text-[10px] text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                  >
                    Esc
                  </button>
                </div>
              </div>
            </Panel>
          )}

          {/* Empty-state prompt — absolutely centered when no nodes exist */}
          {network.nodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="pointer-events-auto flex flex-col items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-900/80 ring-1 ring-zinc-800">
                  <Network className="h-6 w-6 text-cyan-400" />
                </div>
                <div className="text-center">
                  <div className="text-[15px] font-medium text-zinc-200">Start a reactor network</div>
                  <div className="mt-0.5 text-[12px] text-zinc-600">Add your first unit, or ask the copilot to design one.</div>
                </div>
                <div className="flex gap-2">
                  {(["feed", "cstr", "pfr", "separator"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => addNode(t)}
                      className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-[12px] font-medium text-zinc-300 backdrop-blur transition-colors hover:border-cyan-500/40 hover:text-cyan-200"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {t.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </ReactFlow>

        {/* Right-click context menu content — appears when a node is
            right-clicked (Radix triggers on any right-click inside the
            ContextMenu root; we guard actions on selectedNodeId). */}
        <ContextMenuContent className="w-44 border-zinc-700 bg-zinc-900 p-1 text-zinc-200">
          <ContextMenuItem
            onSelect={() => selectedNodeId && inspectNode(selectedNodeId)}
            className="flex items-center gap-2 rounded px-2 py-1.5 text-[12px] focus:bg-zinc-800"
          >
            <Inspect className="h-3.5 w-3.5 text-cyan-400" /> Inspect
            <span className="ml-auto font-mono text-[9px] text-zinc-600">dbl-click</span>
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => selectedNodeId && requestConfig(selectedNodeId)}
            className="flex items-center gap-2 rounded px-2 py-1.5 text-[12px] focus:bg-zinc-800"
          >
            <Settings className="h-3.5 w-3.5 text-zinc-400" /> Configure…
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => selectedNodeId && setConnectSourceId(selectedNodeId)}
            className="flex items-center gap-2 rounded px-2 py-1.5 text-[12px] focus:bg-zinc-800"
          >
            <Share2 className="h-3.5 w-3.5 text-cyan-400" /> Connect to…
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => selectedNodeId && duplicateNode(selectedNodeId)}
            className="flex items-center gap-2 rounded px-2 py-1.5 text-[12px] focus:bg-zinc-800"
          >
            <Copy className="h-3.5 w-3.5 text-zinc-400" /> Duplicate
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => selectedNodeId && togglePin(selectedNodeId)}
            className="flex items-center gap-2 rounded px-2 py-1.5 text-[12px] focus:bg-zinc-800"
          >
            <Pin className="h-3.5 w-3.5 text-cyan-400" /> Pin for comparison
          </ContextMenuItem>
          <ContextMenuSeparator className="my-1 bg-zinc-800" />
          <ContextMenuItem
            onSelect={() => selectedNodeId && removeNode(selectedNodeId)}
            className="flex items-center gap-2 rounded px-2 py-1.5 text-[12px] text-red-300 focus:bg-red-500/10"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
            <span className="ml-auto font-mono text-[9px] text-zinc-600">Del</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
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
