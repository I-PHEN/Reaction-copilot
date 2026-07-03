/**
 * Topology Store
 * ---------------------------------------------------------------
 * Single source of truth for the reactor network canvas state.
 *
 * Design rules enforced here:
 *  - Topology-as-state: the whole network is a plain JSON-serializable
 *    `ReactorNetwork` object (nodes + streams + meta).
 *  - Solver-bound: every node's engineering numbers come exclusively
 *    from the verified solver layer via `runSolvers()`. The store
 *    NEVER computes its own math; it only holds the solver report.
 *  - Reconciler: discrepancies between canvas state and solver output
 *    are surfaced as diagnostics on the report.
 */
"use client";

import { create } from "zustand";
import {
  DEFAULT_PARAMS,
  solveNetwork,
  type NetworkNode,
  type NodeType,
  type ReactorNetwork,
  type SolverReport,
  type Stream,
} from "@/lib/solvers";

let idSeq = 100;
const nextId = (p: string) => `${p}${++idSeq}`;

export interface ReasoningStep {
  id: string;
  text: string;
  ts: number;
  kind: "select" | "verify" | "layout" | "info";
}

export interface CopilotMessage {
  id: string;
  role: "user" | "copilot" | "thinking";
  content: string;
  ts: number;
  // --- thinking-message fields ---
  steps?: ReasoningStep[];
  done?: boolean;
  durationMs?: number;
  startedAt?: number;
}

interface TopologyState {
  network: ReactorNetwork;
  report: SolverReport | null;
  selectedNodeId: string | null;
  inspectedNodeId: string | null;
  pinnedNodeIds: string[];
  copilotMessages: CopilotMessage[];
  isGenerating: boolean;
  isSolving: boolean;

  // mutations
  setNetwork: (n: ReactorNetwork) => void;
  updateNodeParams: (id: string, params: Partial<NetworkNode["params"]>) => void;
  updateNodePosition: (id: string, position: { x: number; y: number }) => void;
  addNode: (type: NodeType, position?: { x: number; y: number }) => string;
  removeNode: (id: string) => void;
  addStream: (source: string, target: string) => void;
  removeStream: (id: string) => void;
  connectNodes: (source: string, target: string) => void;

  selectNode: (id: string | null) => void;
  inspectNode: (id: string | null) => void;
  togglePin: (id: string) => void;
  unpin: (id: string) => void;

  pushMessage: (m: Omit<CopilotMessage, "id" | "ts">) => void;
  startThinking: () => string;
  pushReasoning: (text: string, kind?: ReasoningStep["kind"]) => void;
  finalizeThinking: (id: string) => void;
  setGenerating: (v: boolean) => void;

  runSolvers: () => void;
  serialize: () => ReactorNetwork;
}

const seedNetwork = (): ReactorNetwork => {
  const feed: NetworkNode = {
    id: "feed-1",
    type: "feed",
    label: "Feed",
    position: { x: 40, y: 260 },
    params: { feedRate: 10, inletConcentration: 5, volumetricFlow: 2, temperature: 350 },
  };
  const cstr: NetworkNode = {
    id: "cstr-1",
    type: "cstr",
    label: "CSTR-1",
    position: { x: 460, y: 260 },
    params: {
      volume: 2.0,
      temperature: 350,
      preExponential: DEFAULT_PARAMS.preExponential,
      activationEnergy: DEFAULT_PARAMS.activationEnergy,
    },
  };
  const pfr: NetworkNode = {
    id: "pfr-1",
    type: "pfr",
    label: "PFR-2",
    position: { x: 900, y: 260 },
    params: {
      volume: 3.0,
      temperature: 360,
      preExponential: DEFAULT_PARAMS.preExponential,
      activationEnergy: DEFAULT_PARAMS.activationEnergy,
    },
  };
  const product: NetworkNode = {
    id: "product-1",
    type: "product",
    label: "Product",
    position: { x: 1340, y: 260 },
    params: { temperature: 360 },
  };
  const streams: Stream[] = [
    { id: "s1", source: "feed-1", target: "cstr-1", flowRate: 10 },
    { id: "s2", source: "cstr-1", target: "pfr-1", flowRate: 8 },
    { id: "s3", source: "pfr-1", target: "product-1", flowRate: 6 },
  ];
  return {
    nodes: [feed, cstr, pfr, product],
    streams,
    meta: { species: "A → B", reaction: "A → B (first-order, liquid-phase)" },
  };
};

const nodeDefaults: Record<NodeType, Partial<NetworkNode["params"]>> = {
  feed: { feedRate: 10, inletConcentration: 5, volumetricFlow: 2, temperature: 350 },
  cstr: { volume: 2, temperature: 350, preExponential: DEFAULT_PARAMS.preExponential, activationEnergy: DEFAULT_PARAMS.activationEnergy },
  pfr: { volume: 3, temperature: 360, preExponential: DEFAULT_PARAMS.preExponential, activationEnergy: DEFAULT_PARAMS.activationEnergy },
  mixer: { volume: 0.5, temperature: 350 },
  separator: { splitFraction: 0.85, temperature: 350 },
  product: { temperature: 350 },
};

const labelFor = (type: NodeType, existing: number) =>
  `${type.toUpperCase()}-${existing + 1}`;

export const useTopology = create<TopologyState>((set, get) => ({
  network: seedNetwork(),
  report: null,
  selectedNodeId: "cstr-1",
  inspectedNodeId: "cstr-1",
  pinnedNodeIds: [],
  copilotMessages: [
    {
      id: "m0",
      role: "copilot",
      content:
        "Reactor Synthesis Copilot online. I generate verified flowsheets grounded in first-order Arrhenius kinetics. Try: \u201cDesign a 2-stage CSTR + PFR train for 90% conversion\u201d, or use a Quick Action.",
      ts: 0,
    },
  ],
  reasoning: [],
  isGenerating: false,
  isSolving: false,

  setNetwork: (n) => {
    set({ network: n, selectedNodeId: n.nodes[0]?.id ?? null });
    get().runSolvers();
  },

  updateNodeParams: (id, params) => {
    set((s) => ({
      network: {
        ...s.network,
        nodes: s.network.nodes.map((n) =>
          n.id === id ? { ...n, params: { ...n.params, ...params } } : n,
        ),
      },
    }));
    get().runSolvers();
  },

  updateNodePosition: (id, position) => {
    set((s) => ({
      network: {
        ...s.network,
        nodes: s.network.nodes.map((n) =>
          n.id === id ? { ...n, position } : n,
        ),
      },
    }));
  },

  addNode: (type, position) => {
    const id = nextId(type.slice(0, 1));
    const count = get().network.nodes.filter((n) => n.type === type).length;
    const node: NetworkNode = {
      id,
      type,
      label: labelFor(type, count),
      position: position ?? { x: 400 + Math.random() * 200, y: 120 + Math.random() * 280 },
      params: nodeDefaults[type],
    };
    set((s) => ({ network: { ...s.network, nodes: [...s.network.nodes, node] } }));
    get().runSolvers();
    return id;
  },

  removeNode: (id) => {
    set((s) => ({
      network: {
        ...s.network,
        nodes: s.network.nodes.filter((n) => n.id !== id),
        streams: s.network.streams.filter((st) => st.source !== id && st.target !== id),
      },
      selectedNodeId: s.selectedNodeId === id ? null : s.selectedNodeId,
      inspectedNodeId: s.inspectedNodeId === id ? null : s.inspectedNodeId,
      pinnedNodeIds: s.pinnedNodeIds.filter((p) => p !== id),
    }));
    get().runSolvers();
  },

  addStream: (source, target) => {
    const id = nextId("s");
    set((s) => ({
      network: {
        ...s.network,
        streams: [...s.network.streams, { id, source, target, flowRate: 8 }],
      },
    }));
    get().runSolvers();
  },

  removeStream: (id) => {
    set((s) => ({
      network: { ...s.network, streams: s.network.streams.filter((st) => st.id !== id) },
    }));
    get().runSolvers();
  },

  connectNodes: (source, target) => get().addStream(source, target),

  selectNode: (id) => set({ selectedNodeId: id }),
  inspectNode: (id) =>
    set(id ? { inspectedNodeId: id, selectedNodeId: id } : { inspectedNodeId: null }),
  togglePin: (id) =>
    set((s) => ({
      pinnedNodeIds: s.pinnedNodeIds.includes(id)
        ? s.pinnedNodeIds.filter((p) => p !== id)
        : [...s.pinnedNodeIds, id],
    })),
  unpin: (id) => set((s) => ({ pinnedNodeIds: s.pinnedNodeIds.filter((p) => p !== id) })),

  pushMessage: (m) =>
    set((s) => ({
      copilotMessages: [
        ...s.copilotMessages,
        { ...m, id: nextId("m"), ts: Date.now() },
      ],
    })),

  // --- thinking-as-message: a "thinking" message lives inline in the feed ---
  startThinking: () => {
    const id = nextId("m");
    const now = Date.now();
    set((s) => ({
      copilotMessages: [
        ...s.copilotMessages,
        { id, role: "thinking", content: "", ts: now, steps: [], done: false, startedAt: now },
      ],
    }));
    return id;
  },

  pushReasoning: (text, kind = "info") =>
    set((s) => ({
      copilotMessages: s.copilotMessages.map((m) => {
        // append to the last unfinished thinking message
        if (m.role === "thinking" && !m.done) {
          return {
            ...m,
            steps: [...(m.steps ?? []), { id: nextId("r"), text, kind, ts: Date.now() }],
          };
        }
        return m;
      }),
    })),

  finalizeThinking: (id) =>
    set((s) => ({
      copilotMessages: s.copilotMessages.map((m) =>
        m.id === id && m.role === "thinking"
          ? { ...m, done: true, durationMs: Date.now() - (m.startedAt ?? m.ts) }
          : m,
      ),
    })),

  setGenerating: (v) => set({ isGenerating: v }),

  runSolvers: () => {
    set({ isSolving: true });
    // Defer to a microtask so the UI never blocks on parameter updates.
    // The verified solver is O(nodes) and well under the sub-5ms target.
    queueMicrotask(() => {
      const report = solveNetwork(get().network);
      set({ report, isSolving: false });
    });
  },

  serialize: () => {
    const n = get().network;
    return JSON.parse(JSON.stringify(n)) as ReactorNetwork;
  },
}));

/** Run solvers once on first load so the UI has a report immediately. */
if (typeof window !== "undefined") {
  queueMicrotask(() => useTopology.getState().runSolvers());
}
