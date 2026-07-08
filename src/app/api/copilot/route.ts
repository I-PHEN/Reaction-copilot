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

/**
 * Analyze-mode system prompt. The copilot receives the current topology +
 * solver report as context and answers questions / explains / suggests
 * improvements. CRITICAL: it must cite actual KPIs from the report and
 * never invent numbers.
 */
const ANALYZE_SYSTEM_PROMPT = `You are REACTOR-COPILOT, an expert chemical-reaction-engineering assistant in ANALYZE mode. The user has an existing reactor network and is asking a question about it.

You are given:
1. The current topology (nodes + streams + parameters)
2. The verified solver report (per-unit KPIs: conversion, residence time, temperature, rate constant, residual, status, diagnostics)
3. The user's question

Your job is to answer grounded in the ACTUAL solver data. Rules:
- NEVER invent numbers. Every KPI you cite MUST come from the provided solver report.
- If a reactor has low conversion, identify WHICH reactor and explain using its actual τ, k(T), and conversion.
- If the user asks "what if", reason about the direction of change (e.g. "increasing volume raises τ, which raises conversion for a first-order reaction") but DO NOT compute exact new values — only the solver computes those.
- If the user asks to modify the network, describe the change in words; do not output a topology unless they explicitly ask to redesign.
- Be concise (2-4 sentences). Use engineering precision.
- Reference units by their actual labels (e.g. "CSTR-1", "PFR-2").

Respond with a single JSON object, NOTHING else:
{
  "message": string,     // your grounded answer, 2-4 sentences, citing real KPIs
  "reasoning": string[], // 3-6 short thought steps showing how you arrived at the answer
  "topology": null       // always null in analyze mode (no topology change)
}

No extra text, no markdown, no code fences.`;

/**
 * Multi-candidate system prompt. The synthesizer produces 2-3 distinct
 * candidate topologies for the same goal, each using a different
 * configuration strategy. This is the first taste of superstructure-style
 * search: generate alternatives, let the solver verify each, compare.
 */
const MULTI_SYSTEM_PROMPT = `You are REACTOR-COPILOT, an expert chemical-reaction-engineering assistant in MULTI-CANDIDATE mode. The user wants 2-3 DIFFERENT reactor network topologies for the same goal.

You MUST respond with a single JSON object (no markdown, no code fences, no commentary). The EXACT schema:

{
  "message": string,
  "reasoning": string[],
  "candidates": [
    {
      "label": string,
      "rationale": string,
      "topology": {
        "nodes": [
          {
            "id": string,
            "type": "feed" | "cstr" | "pfr" | "mixer" | "separator" | "product",
            "label": string,
            "position": { "x": number, "y": number },
            "params": {
              "volume": number,
              "temperature": number,
              "feedRate": number,
              "inletConcentration": number,
              "volumetricFlow": number,
              "splitFraction": number,
              "preExponential": number,
              "activationEnergy": number
            }
          }
        ],
        "streams": [
          { "id": string, "source": string, "target": string, "flowRate": number }
        ],
        "meta": { "species": "A -> B", "reaction": "A -> B (first-order, liquid-phase)" }
      }
    }
  ]
}

CRITICAL RULES:
- Node "type" values MUST be lowercase: "feed", "cstr", "pfr", "mixer", "separator", "product". NEVER "CSTR" or "PFR".
- Every node MUST have an "id" (e.g. "n1", "n2"), a "label", a "position" with x/y numbers, and a "params" object.
- Reactor nodes (cstr/pfr) MUST include: volume (1-5 m³), temperature (320-400 K), preExponential (12000000000), activationEnergy (72000).
- Feed nodes MUST include: feedRate (5-15 mol/s), inletConcentration (5 mol/m³), volumetricFlow (1-3 m³/s), temperature (320-400 K).
- Product nodes: empty params {}.
- Every stream's "source" and "target" MUST reference an existing node id.
- Use distinct node ids per candidate (n1, n2, n3...) and stream ids (s1, s2...).
- Layout: feed at x~40, reactors x~300-700, product x~1000-1200. Stagger y to avoid overlap.
- Default kinetics: preExponential = 12000000000 (1.2e10), activationEnergy = 72000.
- Each candidate MUST be a COMPLETE network: at least one feed, one reactor, one product, connected by streams.
- Keep topologies MINIMAL: feed + 1-2 reactors + product. Do NOT add extra fields like "advantages", "disadvantages", "conversion" — only the fields in the schema above.
- Output ONLY valid JSON. No comments, no trailing commas, no extra text.

Generate 2 genuinely different candidates (e.g. single CSTR, single PFR).

OUTPUT: a single JSON object, nothing else.`;

/**
 * Optimize-mode system prompt. The LLM receives the current topology +
 * a reactor to optimize, and proposes sweep ranges for volume × temperature.
 * The actual grid search runs in the verified solver — the LLM never
 * computes results, only proposes the search space.
 */
const OPTIMIZE_SYSTEM_PROMPT = `You are REACTOR-COPILOT in OPTIMIZE mode. The user wants to optimize a reactor. You are given the current topology + solver report. Your job is to propose the parameter sweep ranges for the optimization.

Rules:
- Identify which reactor to optimize (the first cstr or pfr in the network).
- Propose a volume range [min, max] in m³ (typically 0.5× to 3× the current volume).
- Propose a temperature range [min, max] in K (typically ±30K from the current temperature, within 290-450K).
- State the objective (e.g. "maximize conversion").
- Do NOT compute conversion values — the solver does that.

Respond with a single JSON object, NOTHING else:
{
  "message": string,        // 1-2 sentences: what you'll optimize and why these ranges
  "reasoning": string[],    // 3-5 thought steps
  "optimize": {
    "nodeId": string,       // the reactor node id to optimize
    "objective": string,    // e.g. "maximize conversion"
    "volumeRange": [number, number],    // [min, max] m³
    "temperatureRange": [number, number] // [min, max] K
  }
}

No extra text, no markdown, no code fences.`;

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
function sanitizeTopology(raw: unknown): ReactorNetwork | null {
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

function sanitizeEnvelope(raw: unknown): {
  message: string;
  reasoning: string[];
  topology: ReactorNetwork;
} | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const topologyRaw = r.topology;
  const topology = sanitizeTopology(topologyRaw);
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

  return {
    message,
    reasoning,
    topology: { nodes, streams, meta: { species, reaction } },
  };
}

/**
 * Serialize the current topology + solver report into a compact context
 * string for the LLM. This is the "shared state" every agent reads.
 * Only includes verified solver numbers — no derived/heuristic values.
 */
function buildContextBlock(
  topology: unknown,
  report: unknown,
): string {
  const t = topology as { nodes?: unknown[]; streams?: unknown[]; meta?: { species?: string; reaction?: string } } | null;
  const r = report as { results?: Record<string, unknown>; reconcilerDiagnostics?: string[]; overallStatus?: string } | null;

  const nodes = Array.isArray(t?.nodes) ? t!.nodes : [];
  const streams = Array.isArray(t?.streams) ? t!.streams : [];
  const results = r?.results ?? {};

  let block = `## Current Topology\n`;
  block += `Species: ${t?.meta?.species ?? "A → B"}\n`;
  block += `Reaction: ${t?.meta?.reaction ?? "first-order, liquid-phase"}\n`;
  block += `Units: ${nodes.length}\nStreams: ${streams.length}\n\n`;

  block += `### Units (verified solver KPIs)\n`;
  for (const n of nodes) {
    const node = n as { id: string; type: string; label: string; params: Record<string, number> };
    const res = results[node.id] as {
      conversion?: number; residenceTime?: number; outletTemperature?: number;
      rateConstant?: number; outletFlow?: number; residual?: number;
      status?: string; converged?: boolean; diagnostics?: string[];
    } | undefined;
    block += `- ${node.label} (${node.type})`;
    if (node.params) {
      const p: string[] = [];
      if (node.params.volume != null) p.push(`V=${node.params.volume}m³`);
      if (node.params.temperature != null) p.push(`T=${node.params.temperature}K`);
      if (node.params.feedRate != null) p.push(`F=${node.params.feedRate}mol/s`);
      if (node.params.volumetricFlow != null) p.push(`v=${node.params.volumetricFlow}m³/s`);
      if (node.params.splitFraction != null) p.push(`α=${node.params.splitFraction}`);
      if (p.length) block += `  params: ${p.join(", ")}`;
    }
    if (res) {
      block += `\n  solver: X=${((res.conversion ?? 0) * 100).toFixed(1)}%, τ=${(res.residenceTime ?? 0).toFixed(2)}s, T_out=${(res.outletTemperature ?? 0).toFixed(0)}K, k=${(res.rateConstant ?? 0).toFixed(4)}/s, A_out=${(res.outletFlow ?? 0).toFixed(2)}mol/s, residual=${(res.residual ?? 0).toExponential(1)}, status=${res.status ?? "unknown"}`;
      if (res.diagnostics && res.diagnostics.length > 0) {
        block += `\n  diagnostics: ${res.diagnostics.join("; ")}`;
      }
    }
    block += `\n`;
  }

  if (streams.length > 0) {
    block += `\n### Streams\n`;
    for (const s of streams) {
      const st = s as { id: string; source: string; target: string; flowRate: number };
      block += `- ${st.id}: ${st.source} → ${st.target} (${st.flowRate} mol/s)\n`;
    }
  }

  if (r?.reconcilerDiagnostics && r.reconcilerDiagnostics.length > 0) {
    block += `\n### Reconciler Diagnostics\n`;
    for (const d of r.reconcilerDiagnostics) block += `- ${d}\n`;
  }

  block += `\n### Network Status: ${r?.overallStatus ?? "unknown"}\n`;
  return block;
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

    // --- Mode detection: analyze vs generate vs generate-multi vs optimize ---
    const ctx = body as { context?: { topology?: unknown; report?: unknown } };
    const hasContext = !!ctx.context?.topology;
    const analyzeKeywords = /\b(why|explain|what if|how come|low|high|bottleneck|improve|increase|decrease|analyze|analyse|should i|recommend)\b/i;
    const designKeywords = /\b(design|generate|build|create|add|make|synthesi[sz]e|construct)\b/i;
    const multiKeywords = /\b(compare|alternatives|options|different ways|multiple ways|give me \d+|2 ways|3 ways|two ways|three ways|several ways|ways to)\b/i;
    const optimizeKeywords = /\b(optimize|optimise|maximize|maximise|minimize|minimise|best|sweep|response surface|optimal)\b/i;
    // Multi mode: explicit request for alternatives.
    const isMulti = multiKeywords.test(prompt);
    // Optimize mode: requires context + explicit optimize intent (not multi).
    const isOptimize = hasContext && !isMulti && optimizeKeywords.test(prompt);
    // Analyze mode: requires context, question keywords, not design/multi/optimize.
    const isAnalyze =
      hasContext && !isMulti && !isOptimize && (analyzeKeywords.test(prompt) && !designKeywords.test(prompt));

    const zai = await ZAI.create();

    if (isMulti) {
      // --- MULTI-CANDIDATE MODE: 2-3 distinct topologies ---
      // The LLM sometimes returns malformed JSON for large multi-candidate
      // responses. Retry once if parsing fails (non-deterministic).
      let parsed: unknown = null;
      for (let attempt = 0; attempt < 3 && !parsed; attempt++) {
        const completion = await zai.chat.completions.create({
          messages: [
            { role: "assistant", content: MULTI_SYSTEM_PROMPT },
            { role: "user", content: attempt === 0 ? prompt : `${prompt}\n\nIMPORTANT: Your previous response was not valid JSON. Output ONLY a single valid JSON object with no extra text, no markdown, no trailing commas.` },
          ],
          thinking: { type: "disabled" },
        });
        const content = completion?.choices?.[0]?.message?.content ?? "";
        parsed = extractJson(content);
      }

      if (parsed && typeof parsed === "object") {
        const p = parsed as { message?: string; reasoning?: unknown; candidates?: unknown };
        const rawCandidates = Array.isArray(p.candidates) ? p.candidates : [];
        const sanitizedCandidates: { label: string; rationale: string; topology: ReactorNetwork }[] = [];

        for (const c of rawCandidates) {
          if (!c || typeof c !== "object") continue;
          const cand = c as { label?: string; rationale?: string; topology?: unknown };
          const topology = sanitizeTopology(cand.topology);
          if (topology) {
            sanitizedCandidates.push({
              label: typeof cand.label === "string" && cand.label.trim() ? cand.label.trim() : `Candidate ${sanitizedCandidates.length + 1}`,
              rationale: typeof cand.rationale === "string" && cand.rationale.trim() ? cand.rationale.trim() : "",
              topology,
            });
          }
        }

        if (sanitizedCandidates.length > 0) {
          return NextResponse.json(
            {
              mode: "multi",
              message: typeof p.message === "string" && p.message.trim()
                ? p.message.trim()
                : `Generated ${sanitizedCandidates.length} candidate topologies.`,
              reasoning: Array.isArray(p.reasoning)
                ? p.reasoning.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim()).slice(0, 8)
                : ["Parsed multi-candidate request", `Generated ${sanitizedCandidates.length} distinct topologies`],
              candidates: sanitizedCandidates,
            },
            { status: 200 },
          );
        }
      }
      // Fallback: if multi parse failed, return a single generate fallback
      const fallback = buildFallback("multi-candidate output unparseable");
      return NextResponse.json(fallback, { status: 200 });
    }

    if (isOptimize) {
      // --- OPTIMIZE MODE: LLM proposes ranges, solver runs the grid ---
      const contextBlock = buildContextBlock(ctx.context!.topology, ctx.context!.report);
      const userMessage = `${contextBlock}\n---\n\nUser request: ${prompt}`;

      const completion = await zai.chat.completions.create({
        messages: [
          { role: "assistant", content: OPTIMIZE_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        thinking: { type: "disabled" },
      });

      const content = completion?.choices?.[0]?.message?.content ?? "";
      const parsed = extractJson(content);

      if (parsed && typeof parsed === "object") {
        const p = parsed as {
          message?: string;
          reasoning?: unknown;
          optimize?: {
            nodeId?: string;
            objective?: string;
            volumeRange?: [number, number];
            temperatureRange?: [number, number];
          };
        };

        const opt = p.optimize;
        const topology = ctx.context!.topology as { nodes?: Array<{ id: string; type: string; params: Record<string, number> }> };
        const nodes = Array.isArray(topology?.nodes) ? topology!.nodes : [];

        // Find the target reactor: use the LLM's nodeId if valid, else the
        // first cstr/pfr in the network.
        let targetNode = opt?.nodeId ? nodes.find((n) => n.id === opt.nodeId) : null;
        if (!targetNode) {
          targetNode = nodes.find((n) => n.type === "cstr" || n.type === "pfr") ?? null;
        }

        if (targetNode && opt?.volumeRange && opt?.temperatureRange) {
          // Clamp ranges to safe bounds.
          const vRange: [number, number] = [
            Math.max(0.1, Math.min(50, Number(opt.volumeRange[0]) || 0.5)),
            Math.max(0.2, Math.min(100, Number(opt.volumeRange[1]) || 10)),
          ];
          const tRange: [number, number] = [
            Math.max(290, Math.min(500, Number(opt.temperatureRange[0]) || 300)),
            Math.max(291, Math.min(600, Number(opt.temperatureRange[1]) || 400)),
          ];
          // Ensure min < max.
          if (vRange[0] >= vRange[1]) vRange[1] = vRange[0] + 1;
          if (tRange[0] >= tRange[1]) tRange[1] = tRange[0] + 10;

          const objective = typeof opt.objective === "string" && opt.objective.trim()
            ? opt.objective.trim()
            : "maximize conversion";

          return NextResponse.json(
            {
              mode: "optimize",
              message: typeof p.message === "string" && p.message.trim()
                ? p.message.trim()
                : `Optimizing ${targetNode.type.toUpperCase()} over V∈[${vRange[0].toFixed(1)}, ${vRange[1].toFixed(1)}] m³, T∈[${tRange[0].toFixed(0)}, ${tRange[1].toFixed(0)}] K.`,
              reasoning: Array.isArray(p.reasoning)
                ? p.reasoning.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim()).slice(0, 8)
                : ["Identified reactor to optimize", "Proposed sweep ranges", "Solver will run the grid"],
              optimize: {
                nodeId: targetNode.id,
                objective,
                volumeRange: vRange,
                temperatureRange: tRange,
              },
              topology: null,
            },
            { status: 200 },
          );
        }
      }
      // Fallback: return a message explaining optimization couldn't be set up.
      return NextResponse.json(
        {
          mode: "optimize",
          message: "I couldn't set up the optimization. Make sure your network has at least one reactor (CSTR or PFR), then try again.",
          reasoning: ["Could not identify a reactor to optimize"],
          topology: null,
        },
        { status: 200 },
      );
    }

    if (isAnalyze) {
      // --- ANALYZE MODE: grounded Q&A about the current topology ---
      const contextBlock = buildContextBlock(ctx.context!.topology, ctx.context!.report);
      const userMessage = `${contextBlock}\n---\n\nUser question: ${prompt}`;

      const completion = await zai.chat.completions.create({
        messages: [
          { role: "assistant", content: ANALYZE_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        thinking: { type: "disabled" },
      });

      const content = completion?.choices?.[0]?.message?.content ?? "";
      const parsed = extractJson(content);

      // In analyze mode, topology is always null. Coerce the response.
      if (parsed && typeof parsed === "object") {
        const p = parsed as { message?: string; reasoning?: unknown; topology?: unknown };
        return NextResponse.json(
          {
            message: typeof p.message === "string" && p.message.trim()
              ? p.message.trim()
              : "Based on the solver report, I've analyzed the current network.",
            reasoning: Array.isArray(p.reasoning)
              ? p.reasoning.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim()).slice(0, 8)
              : ["Analyzed current topology from solver report", "Identified key KPIs", "Formulated grounded answer"],
            topology: null,
          },
          { status: 200 },
        );
      }
      // Fallback if JSON parse failed
      return NextResponse.json(
        {
          message: content.slice(0, 500) || "Analysis complete.",
          reasoning: ["Analyzed current topology from solver report"],
          topology: null,
        },
        { status: 200 },
      );
    }

    // --- GENERATE MODE (existing behavior) ---
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
