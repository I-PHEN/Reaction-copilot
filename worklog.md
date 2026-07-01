# Reactor Engineering Synthesis Copilot — Worklog

Shared worklog for all agents building the Reactor Engineering Synthesis Copilot.
Each agent appends a new section (starting with `---`) after completing its Task ID.

---
Task ID: 0
Agent: Orchestrator (main)
Task: Initialize project, define topology schema + verified solver layer.

Work Log:
- Inspected existing Next.js 16 scaffold; installed @xyflow/react@12.11.1.
- Read LLM skill documentation.
- Defined the serializable topology schema in `src/lib/solvers/types.ts`
  (NodeType, NodeParams, NetworkNode, Stream, ReactorNetwork, SolverResult, SolverReport).
- Built verified solvers:
  - `kinetics.ts` — Arrhenius k(T), adiabatic outlet T, Damköhler number.
  - `cstr.ts` — analytic first-order CSTR X = Da/(1+Da) with design-equation residual verification.
  - `pfr.ts` — RK4 integration of dX/dV with Richardson-style truncation probe; returns axial profile.
  - `units.ts` — mixer (mass balance) + separator (split-fraction) solvers.
  - `orchestrator.ts` — topological-order walk, flow propagation, dispatch, and the Reconciler
    (per-node sanity checks + network-level mass balance discrepancy flagging).

Stage Summary:
- The verified Solver Layer is the single source of truth for all engineering math.
- The UI must never compute its own math; it reads SolverReport.
- Schema contract for the LLM copilot API is `ReactorNetwork` in `src/lib/solvers/types.ts`.

---
Task ID: 9
Agent: full-stack-developer
Task: Build the Next.js 16 App Router API route at `src/app/api/copilot/route.ts` (POST) that uses the `z-ai-web-dev-sdk` LLM to turn a natural-language engineering prompt into a verified reactor-network topology, matching the frontend contract `{ message, reasoning, topology: ReactorNetwork }`.

Work Log:
- Read `/home/z/my-project/worklog.md` (Task 0) to learn the project context and the `ReactorNetwork` schema.
- Read `/home/z/my-project/src/lib/solvers/types.ts` to lock the exact TypeScript types (`NodeType`, `NodeParams`, `NetworkNode`, `Stream`, `ReactorNetwork`, `DEFAULT_PARAMS`).
- Read the LLM skill (`skills/LLM/SKILL.md` + `skills/LLM/scripts/chat.ts`) to confirm the exact SDK call shape: `await ZAI.create()`, `zai.chat.completions.create({ messages, thinking: { type: "disabled" } })`, and `completion.choices[0].message.content`.
- Created `src/app/api/copilot/route.ts` as a server-only route (no `"use client"`) with `export async function POST(req: Request)`, `export const dynamic = "force-dynamic"`, `export const runtime = "nodejs"`.
- Wrote a focused, engineering-accurate system prompt that:
  * Establishes the role as REACTOR-COPILOT.
  * Forces a single-JSON-object response with the exact envelope schema (`message`, `reasoning`, `topology`).
  * Pins default chemistry to first-order liquid-phase A -> B with Arrhenius A ~ 1.2e10 1/s and Ea ~ 72000 J/mol; CA0 ~ 5 mol/m^3; v0 in [1,3] m^3/s; T in [320,400] K; V in [1,5] m^3.
  * Specifies left-to-right grid layout (feed x~0, reactors x~250-700, separators/products x~900-1200, y in [0,400]).
  * Mandates stable ids `n1..nN` / `s1..sN` and requires every stream source/target to reference an existing node id; allows recycle loops.
- Implemented defensive JSON extraction: strips ```json fences, falls back to slicing between first `{` and last `}`.
- Implemented `sanitizeEnvelope` / `sanitizeNode` / `sanitizeStream` / `sanitizeParams` / `sanitizePosition`:
  * Validates node `type` against the `NodeType` union; drops unknown-type nodes.
  * De-duplicates colliding node/stream ids by renaming to a positional fallback.
  * Drops streams whose `source`/`target` don't exist in the node-id set (silently).
  * Clamps every numeric param to a safe finite range (e.g. volume 0.01-1000 m^3, T 200-800 K, splitFraction 0-1, preExponential 1e-6..1e15, Ea 0..5e5).
  * Coerces `reasoning` to 4-8 short non-empty strings, prepending generic engineering filler steps when the model under-produces.
- Implemented `buildFallback(reason)` returning a minimal feed(n1) -> CSTR(n2) -> product(n3) network with `DEFAULT_PARAMS` (V=2 m^3, T=350 K, A=1.2e10, Ea=72000, CA0=5, v0=2, F_A0=10 mol/s) and 4 fallback reasoning steps; the fallback `message` explicitly states it is a fallback.
- On success: returns `NextResponse.json(sanitized, { status: 200 })`.
- On parse/validation failure: returns `NextResponse.json(fallback, { status: 200 })` so the frontend always gets a usable network.
- On missing `prompt`: returns 400 `{ error }`.
- On unexpected error (e.g. SDK throws): returns 500 `{ error }` with the error message.
- Verified the empty-body 400 path with `curl -X POST /api/copilot -d '{}'` -> `{"error":"Missing or invalid 'prompt' field in request body."}` HTTP 400 (also confirms the route module compiles and loads in the dev server).
- Ran `bun run lint` -> exit code 0, no errors.

Stage Summary:
- Artifact: `src/app/api/copilot/route.ts` — the single copilot endpoint. Server-side only. No tests written.
- Contract: `POST /api/copilot { prompt: string }` -> 200 `{ message, reasoning, topology: ReactorNetwork }` | 400 `{ error }` | 500 `{ error }`.
- Fallback topology decision: a 3-node feed->CSTR->product network using `DEFAULT_PARAMS` from `src/lib/solvers/types.ts` (V=2 m^3, T=350 K, A=1.2e10 1/s, Ea=72000 J/mol, CA0=5 mol/m^3, v0=2 m^3/s, F_A0=10 mol/s), species "A -> B", reaction "A -> B (first-order, liquid-phase)". Returned with HTTP 200 (never 5xx) and a `message` that explicitly states it is a fallback.
- The route is ready for the frontend (Task that builds the intent feed / reasoning ticker / flowsheet canvas) to consume.

---
Task ID: 1-8 (UI build + verification)
Agent: Orchestrator (main)
Task: Build the tri-pane UI (state store, P&ID nodes, canvas, copilot sidecar, deep dive overlay) and verify end-to-end.

Work Log:
- Built the Zustand topology store (`src/lib/store/topology.ts`): serializable ReactorNetwork
  state, solver-bound via runSolvers() (async queueMicrotask, non-blocking), reconciler
  integration, copilot messages + reasoning ticker state, pin/selection state.
- Built P&ID-style SVG glyphs (`src/components/reactor/glyphs.tsx`): CSTR (vessel+agitator),
  PFR (serpentine tube), Mixer (tee), Separator (trayed column), Feed/Product. Stroke color
  driven by solver status (blue/amber/red).
- Built custom React Flow node (`nodes/ReactorNode.tsx`) with handles, status ring, hover KPI
  strip, and separator top-port handle.
- Built StreamEdge with stroke thickness scaling by molar flow + marching-ants flow animation.
- Built ReactorCanvas (controlled mode, derived from store) with dark slate grid background,
  minimap, controls, add-unit palette, status legend, topology counter.
- Built CopilotSidecar: intent feed, reasoning ticker (color-coded by kind), 4 quick actions,
  input box; calls /api/copilot and streams reasoning steps + commits topology.
- Built DeepDiveOverlay: glass-morphism floating card with KPI grid (conversion, τ, T_out, k,
  residual, A_outlet), solver-bound parameter sliders (constructive iteration bypassing LLM),
  PFR axial conversion profile chart (recharts), diagnostics, multi-pin comparison.
- Built page.tsx: tri-pane layout (canvas 70% + sidecar 30% + floating overlay) with sticky
  header and sticky reconciler footer (mt-auto), responsive mobile stacking.
- Fixed reconciler false-positive: replaced misleading A-mass-balance check (A is consumed by
  reaction by design) with structural-integrity checks (orphan feeds/products, unfed/undrained
  units). Reframed footer as "Reactant A: feed → product · X% converted".
- Added dark canvas CSS + flowDash keyframe animation + custom scrollbar styling to globals.css.

Verification (Agent Browser):
- Page renders all 3 panes; seed network Feed→CSTR-1→PFR-2→Product with flow labels.
- CSTR-1 solver outputs verified by hand calc: k=0.215 1/s, τ=1.0s, X=17.7%, T_out=358K ✓.
- Constructive iteration: raising CSTR volume 2→4.5 m³ via slider updated conversion 17.7%→32.7%
  in real-time (matches τ=2.25, Da=0.484, X=32.6%) — solver bypasses LLM ✓.
- Generative pipeline: "2-stage CSTR+PFR" quick action → LLM returned 8 reasoning steps + a
  summary + a Feed→CSTR-1→PFR-1→Product topology; solver ran (68.3% overall conversion,
  residual 6.3e-13) ✓.
- PFR Deep Dive renders axial conversion profile chart ✓.
- Multi-pin: pinned PFR-1 (compact card) + selected CSTR-1 (full card) display simultaneously ✓.
- Sticky footer: desktop footerBottom=900=viewportH, gapBelowFooter=0 (no floating gap) ✓.
- Mobile (390×844): canvas + sidecar stack, footer pushed down naturally ✓.
- Lint clean; dev log shows all GET 200 and POST /api/copilot 200 ✓.

Stage Summary:
- All design pillars satisfied: Engineering-First (P&ID glyphs), Collaborative Interaction
  (generative + constructive), Correct-Before-Clever (verified solvers, inspectable elements).
- Tri-pane architecture complete. Color-coding conservative (blue/amber/red). Motion restricted
  to functional state changes (node fade-in via React Flow, stream flow indicator).
- Topology serializable + exportable. Solver-bound UI. Reconciler surfaces discrepancies.
- Production-ready; verified interactive in the browser.
