/**
 * Tolerant normalization layer for LLM copilot output.
 *
 * The model is instructed to emit strict JSON envelopes, but real output
 * drifts: fenced code blocks, trailing commas, truncated arrays, invalid
 * node types, out-of-range parameters. This module repairs what it can
 * (clamping, id de-duplication, fence stripping) and rejects the rest,
 * falling back to a minimal always-valid network so the frontend never
 * receives an unusable topology.
 */
import {
  DEFAULT_PARAMS,
  type NetworkNode,
  type NodeParams,
  type NodeType,
  type ReactorNetwork,
  type Stream,
} from "@/lib/solvers/types";

const NODE_TYPES: ReadonlySet<string> = new Set<NodeType>([
  "feed",
  "cstr",
  "pfr",
  "mixer",
  "separator",
  "product",
]);

/** Safe finite clamping ranges for each numeric parameter. */
const PARAM_RANGES: Record<keyof Omit<NodeParams, "reactionOrder" | "reactionExpression">, [number, number]> = {
  volume: [0.01, 1000],
  temperature: [200, 800],
  feedRate: [0, 1e6],
  inletConcentration: [0, 1e6],
  volumetricFlow: [1e-4, 1e6],
  splitFraction: [0, 1],
  preExponential: [1e-6, 1e15],
  activationEnergy: [0, 5e5],
};

function clampNumber(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.min(Math.max(value, min), max);
}

function sanitizeParams(raw: unknown): Partial<NodeParams> {
  if (!raw || typeof raw !== "object") return {};
  const src = raw as Record<string, unknown>;
  const out: Partial<NodeParams> = {};
  (Object.keys(PARAM_RANGES) as (keyof typeof PARAM_RANGES)[]).forEach((key) => {
    if (!(key in src)) return;
    const [min, max] = PARAM_RANGES[key];
    const v = clampNumber(src[key], min, max);
    if (v !== undefined) out[key] = v;
  });
  return out;
}

function sanitizePosition(raw: unknown): { x: number; y: number } {
  if (!raw || typeof raw !== "object") return { x: 0, y: 0 };
  const r = raw as Record<string, unknown>;
  const x = typeof r.x === "number" && Number.isFinite(r.x) ? r.x : 0;
  const y = typeof r.y === "number" && Number.isFinite(r.y) ? r.y : 0;
  return { x, y };
}

function sanitizeNode(raw: unknown, fallbackId: string): NetworkNode | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const type =
    typeof r.type === "string" && NODE_TYPES.has(r.type) ? (r.type as NodeType) : null;
  if (!type) return null;
  const id =
    typeof r.id === "string" && r.id.trim().length > 0 ? r.id.trim() : fallbackId;
  const label =
    typeof r.label === "string" && r.label.trim().length > 0
      ? r.label.trim()
      : type.toUpperCase();
  const position = sanitizePosition(r.position);
  const params = sanitizeParams(r.params);
  return { id, type, label, position, params };
}

function sanitizeStream(
  raw: unknown,
  fallbackId: string,
  validIds: Set<string>,
): Stream | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const source = typeof r.source === "string" ? r.source.trim() : "";
  const target = typeof r.target === "string" ? r.target.trim() : "";
  // Drop streams that reference non-existent nodes or that loop on themselves.
  if (!source || !target || source === target) return null;
  if (!validIds.has(source) || !validIds.has(target)) return null;
  const id =
    typeof r.id === "string" && r.id.trim().length > 0 ? r.id.trim() : fallbackId;
  const flowRate = clampNumber(r.flowRate, 0, 1e9) ?? 0;
  return { id, source, target, flowRate };
}

/**
 * Minimal feed -> CSTR -> product network used whenever the LLM output cannot be
 * parsed into a valid topology. Keeps the frontend always-functional.
 */
export function buildFallback(reason: string): {
  message: string;
  reasoning: string[];
  topology: ReactorNetwork;
} {
  const feed: NetworkNode = {
    id: "n1",
    type: "feed",
    label: "Feed",
    position: { x: 0, y: 200 },
    params: {
      feedRate: DEFAULT_PARAMS.feedRate,
      inletConcentration: DEFAULT_PARAMS.inletConcentration,
      volumetricFlow: DEFAULT_PARAMS.volumetricFlow,
      temperature: DEFAULT_PARAMS.temperature,
    },
  };
  const cstr: NetworkNode = {
    id: "n2",
    type: "cstr",
    label: "CSTR-1",
    position: { x: 450, y: 200 },
    params: {
      volume: DEFAULT_PARAMS.volume,
      temperature: DEFAULT_PARAMS.temperature,
      preExponential: DEFAULT_PARAMS.preExponential,
      activationEnergy: DEFAULT_PARAMS.activationEnergy,
    },
  };
  const product: NetworkNode = {
    id: "n3",
    type: "product",
    label: "Product",
    position: { x: 950, y: 200 },
    params: {},
  };
  const streams: Stream[] = [
    { id: "s1", source: "n1", target: "n2", flowRate: DEFAULT_PARAMS.feedRate },
    { id: "s2", source: "n2", target: "n3", flowRate: DEFAULT_PARAMS.feedRate },
  ];
  return {
    message: `Fallback flowsheet (${reason}): a single CSTR converting feed A to product B with default first-order Arrhenius kinetics.`,
    reasoning: [
      "Copilot output could not be parsed",
      "Returning minimal feed to CSTR to product network",
      "Applied default Arrhenius A and Ea",
      "Ready for solver verification",
    ],
    topology: {
      nodes: [feed, cstr, product],
      streams,
      meta: { species: "A -> B", reaction: "A -> B (first-order, liquid-phase)" },
    },
  };
}

/**
 * Extracts JSON from the model's content string. Tolerates ```json fenced code
 * blocks and leading/trailing prose by slicing between the first '{' and the
 * last '}'.
 */
export function extractJson(content: string): unknown | null {
  if (!content) return null;
  let text = content.trim();
  // Strip markdown code fences from both ends.
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "").trim();
  }
  if (text.endsWith("```")) {
    text = text.replace(/\s*```$/i, "").trim();
  }
  // Attempt 1: direct parse.
  try {
    return JSON.parse(text);
  } catch {
    // pass
  }
  // Attempt 2: slice between first '{' and last '}'.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const slice = text.slice(start, end + 1);
    try {
      return JSON.parse(slice);
    } catch {
      // pass
    }
    // Attempt 3: fix common LLM JSON errors (trailing commas, truncated arrays).
    let fixed = slice
      .replace(/,\s*([}\]])/g, "$1") // trailing commas before } or ]
      .replace(/,\s*$/m, ""); // trailing comma at end
    // If truncated (unbalanced braces), try to close them.
    const opens = (fixed.match(/[{[]/g) || []).length;
    const closes = (fixed.match(/[}\]]/g) || []).length;
    if (opens > closes) {
      fixed += "}]".repeat(opens - closes);
    }
    try {
      return JSON.parse(fixed);
    } catch {
      return null;
    }
  }
  return null;
}

/** Sanitize a raw topology object (nodes/streams/meta) directly. */
export function sanitizeTopology(raw: unknown): ReactorNetwork | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Record<string, unknown>;
  const nodesRaw = Array.isArray(t.nodes) ? t.nodes : [];
  const streamsRaw = Array.isArray(t.streams) ? t.streams : [];
  const metaRaw =
    t.meta && typeof t.meta === "object" ? (t.meta as Record<string, unknown>) : {};

  const nodes: NetworkNode[] = [];
  const seenIds = new Set<string>();
  for (let i = 0; i < nodesRaw.length; i++) {
    const fallback = `n${i + 1}`;
    const node = sanitizeNode(nodesRaw[i], fallback);
    if (!node) continue;
    if (seenIds.has(node.id)) node.id = fallback;
    if (seenIds.has(node.id)) continue;
    seenIds.add(node.id);
    nodes.push(node);
  }
  if (nodes.length === 0) return null;

  const streams: Stream[] = [];
  const seenStreamIds = new Set<string>();
  for (let i = 0; i < streamsRaw.length; i++) {
    const fallback = `s${i + 1}`;
    const stream = sanitizeStream(streamsRaw[i], fallback, seenIds);
    if (!stream) continue;
    if (seenStreamIds.has(stream.id)) stream.id = fallback;
    if (seenStreamIds.has(stream.id)) continue;
    seenStreamIds.add(stream.id);
    streams.push(stream);
  }
  if (streams.length === 0) return null;

  const species =
    typeof metaRaw.species === "string" && metaRaw.species.trim().length > 0
      ? metaRaw.species.trim()
      : "A -> B";
  const reaction =
    typeof metaRaw.reaction === "string" && metaRaw.reaction.trim().length > 0
      ? metaRaw.reaction.trim()
      : "A -> B (first-order, liquid-phase)";

  return { nodes, streams, meta: { species, reaction } };
}

export function sanitizeEnvelope(raw: unknown): {
  message: string;
  reasoning: string[];
  topology: ReactorNetwork;
} | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const topology = sanitizeTopology(r.topology);
  if (!topology) return null;

  // message: synthesize a sane one if the model omitted it.
  const reactorCount = topology.nodes.filter(
    (n) => n.type === "cstr" || n.type === "pfr",
  ).length;
  const message =
    typeof r.message === "string" && r.message.trim().length > 0
      ? r.message.trim()
      : `Generated a ${topology.nodes.length}-node reactor network (${reactorCount} reactor(s), ${topology.streams.length} stream(s)) for A -> B.`;

  // reasoning: coerce to 4-8 short, non-empty strings.
  let reasoning: string[] = [];
  if (Array.isArray(r.reasoning)) {
    reasoning = r.reasoning
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .map((x) => x.trim())
      .slice(0, 8);
  }
  if (reasoning.length < 4) {
    const filler = [
      "Parsed engineering intent from prompt",
      `Selected ${reactorCount} reactor node(s)`,
      "Verified stream connectivity against node ids",
      "Applied Arrhenius kinetic defaults",
    ];
    reasoning = [...filler, ...reasoning].slice(0, 8);
  }

  return { message, reasoning, topology };
}
