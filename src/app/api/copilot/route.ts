import { NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

import {
  DEFAULT_PARAMS,
  type NetworkNode,
  type NodeParams,
  type NodeType,
  type ReactorNetwork,
  type Stream,
} from "@/lib/solvers/types";

// Force dynamic, node-runtime evaluation — the route reads the request body and
// calls the LLM SDK, so it must never be statically optimized or run on the edge.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * System prompt for the reactor-engineering copilot.
 *
 * Engineering ground truth:
 *  - Default chemistry: first-order liquid-phase A -> B with Arrhenius kinetics.
 *  - Default kinetic params: A = 1.2e10 1/s, Ea = 72000 J/mol.
 *  - Default feed: CA0 ~ 5 mol/m^3, v0 ~ 1-3 m^3/s, F_A0 = CA0 * v0.
 *  - Operating T in [320, 400] K; reactor V in [1, 5] m^3.
 *
 * The model MUST respond with a single JSON object matching the envelope schema.
 */
const SYSTEM_PROMPT = `You are REACTOR-COPILOT, an expert chemical-reaction-engineering assistant. You translate natural-language engineering requests into a verified reactor-network flowsheet.

You MUST respond with a single JSON object and NOTHING else. No markdown, no code fences, no commentary before or after. The JSON object must conform EXACTLY to this TypeScript shape:

{
  "message": string,            // 1-3 sentence engineering summary of what you designed and why
  "reasoning": string[],        // 4-8 short (<=14 word) thought steps showing your design logic
  "topology": {
    "nodes": Array<{
      "id": string;             // stable id "n1", "n2", ... (unique, in order of appearance)
      "type": "feed" | "cstr" | "pfr" | "mixer" | "separator" | "product";
      "label": string;          // human label, e.g. "CSTR-1", "Feed", "Separator"
      "position": { "x": number; "y": number };
      "params": Partial<{
        "volume": number;              // m^3 (CSTR/PFR)
        "temperature": number;         // K
        "feedRate": number;            // mol/s (inlet molar flow of A)
        "inletConcentration": number;  // mol/m^3 (CA0)
        "volumetricFlow": number;      // m^3/s (v0)
        "splitFraction": number;       // 0..1 (separator light-key split)
        "preExponential": number;      // 1/s (Arrhenius A)
        "activationEnergy": number;    // J/mol (Arrhenius Ea)
      }>;
    }>;
    "streams": Array<{
      "id": string;             // stable id "s1", "s2", ... (unique, in order of appearance)
      "source": string;         // node id (MUST exist in nodes)
      "target": string;         // node id (MUST exist in nodes)
      "flowRate": number;       // mol/s
    }>;
    "meta": { "species": string; "reaction": string };
  }
}

DESIGN RULES (engineering ground truth):
- Default chemistry is first-order liquid-phase A -> B with Arrhenius kinetics. Do NOT invent other chemistry, side products, or stoichiometry unless the user explicitly asks.
- Default kinetic parameters: preExponential A ~ 1.2e10 1/s, activationEnergy Ea ~ 72000 J/mol. Every reactor node should carry these two params unless the user specifies otherwise.
- Default feed: inletConcentration CA0 ~ 5 mol/m^3, volumetricFlow v0 in [1, 3] m^3/s, feedRate F_A0 = CA0 * v0.
- Operating temperature T in [320, 400] K.
- Reactor volume V in [1, 5] m^3.
- Use "feed" nodes for inlets, "product" nodes for outlets, "mixer" nodes to combine streams, "separator" nodes to split streams (always set splitFraction), and "cstr"/"pfr" nodes for reactors.
- Pick CSTR for high-residence-time / well-mixed requirements; pick PFR for high-conversion / plug-flow requirements.
- Recycle streams (e.g. separator bottoms back to a mixer feeding a reactor) are allowed and encouraged when the user asks for high yield or selectivity.
- Keep the network small and physically meaningful: typically 3-7 nodes.

LAYOUT RULES (left-to-right grid, in pixel units):
- Feed nodes at x ~ 0.
- Mixer nodes at x ~ 150-250 where needed.
- Reactor (cstr/pfr) nodes at x ~ 250-700.
- Separator nodes at x ~ 800-1000.
- Product nodes at x ~ 900-1200.
- y in [0, 400]. Stagger nodes vertically so they do not overlap.

ID RULES:
- Node ids must be "n1", "n2", ... in order of appearance.
- Stream ids must be "s1", "s2", ... in order of appearance.
- Every stream's "source" and "target" MUST reference an existing node id.

OUTPUT: a single JSON object with the exact schema above. No extra text, no markdown, no code fences.`;

const NODE_TYPES: ReadonlySet<string> = new Set<NodeType>([
  "feed",
  "cstr",
  "pfr",
  "mixer",
  "separator",
  "product",
]);

/** Safe finite clamping ranges for each numeric parameter. */
const PARAM_RANGES: Record<keyof NodeParams, [number, number]> = {
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
  (Object.keys(PARAM_RANGES) as (keyof NodeParams)[]).forEach((key) => {
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
function buildFallback(reason: string): {
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
function extractJson(content: string): unknown | null {
  if (!content) return null;
  let text = content.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;
  const m = text.match(fence);
  if (m) text = m[1].trim();
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const slice = text.slice(start, end + 1);
      try {
        return JSON.parse(slice);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function sanitizeEnvelope(raw: unknown): {
  message: string;
  reasoning: string[];
  topology: ReactorNetwork;
} | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const topologyRaw = r.topology;
  if (!topologyRaw || typeof topologyRaw !== "object") return null;
  const t = topologyRaw as Record<string, unknown>;
  const nodesRaw = Array.isArray(t.nodes) ? t.nodes : [];
  const streamsRaw = Array.isArray(t.streams) ? t.streams : [];
  const metaRaw =
    t.meta && typeof t.meta === "object" ? (t.meta as Record<string, unknown>) : {};

  // Sanitize nodes; de-duplicate ids (rename collisions to fallback id).
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

  // Sanitize streams; silently drop streams referencing unknown nodes.
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

  // message: synthesize a sane one if the model omitted it.
  const reactorCount = nodes.filter(
    (n) => n.type === "cstr" || n.type === "pfr",
  ).length;
  const message =
    typeof r.message === "string" && r.message.trim().length > 0
      ? r.message.trim()
      : `Generated a ${nodes.length}-node reactor network (${reactorCount} reactor(s), ${streams.length} stream(s)) for A -> B.`;

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

  return {
    message,
    reasoning,
    topology: { nodes, streams, meta: { species, reaction } },
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const prompt =
      body && typeof body === "object" && typeof (body as { prompt?: unknown }).prompt === "string"
        ? (body as { prompt: string }).prompt.trim()
        : "";
    if (!prompt) {
      return NextResponse.json(
        { error: "Missing or invalid 'prompt' field in request body." },
        { status: 400 },
      );
    }

    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      thinking: { type: "disabled" },
    });

    const content = completion?.choices?.[0]?.message?.content ?? "";
    const parsed = extractJson(content);
    const sanitized = parsed ? sanitizeEnvelope(parsed) : null;

    if (sanitized) {
      return NextResponse.json(sanitized, { status: 200 });
    }

    // Parsing or validation failed — return a usable fallback, never crash.
    const fallback = buildFallback("copilot output unparseable");
    return NextResponse.json(fallback, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
