import { NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

import { buildContextBlock } from "@/lib/copilot/context";
import {
  buildFallback,
  extractJson,
  sanitizeEnvelope,
  sanitizeTopology,
} from "@/lib/copilot/normalize";
import {
  ANALYZE_SYSTEM_PROMPT,
  MULTI_SYSTEM_PROMPT,
  OPTIMIZE_SYSTEM_PROMPT,
  SYSTEM_PROMPT,
} from "@/lib/copilot/prompts";
import type { ReactorNetwork } from "@/lib/solvers/types";

// Force dynamic, node-runtime evaluation — the route reads the request body and
// calls the LLM SDK, so it must never be statically optimized or run on the edge.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
        const nodes = Array.isArray(topology?.nodes) ? topology.nodes : [];

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

    // --- GENERATE MODE ---
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
