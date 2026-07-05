# Reactor Engineering Synthesis Copilot — Product Requirements Document

> **Status:** Living document. Updated each phase. This is the source of truth for direction — if a proposed change drifts from this PRD, it gets rejected or the PRD gets updated first.

---

## 1. Vision

Build the industry's best AI-assisted reaction-engineering tool — one that **beats ChatGPT and Gemini at reaction synthesis** by never asking a language model to do math. Every number the tool reports is grounded in a verified solver; the LLM orchestrates, proposes, and explains — it never computes.

The end state is a **multi-agent system** that solves complex reaction problems: optimize yields, design reactor networks, compare configurations, and reason about trade-offs — with every recommendation traceable to solver output.

## 2. Why We Win (the core differentiator)

General-purpose LLMs fail at reaction engineering because they:
- Hallucinate rate constants and kinetic parameters
- Cannot reliably integrate ODEs or solve mass-energy balances
- Have no concept of convergence or physical feasibility

**Our advantage is not a better LLM. It's that every number is verified.** The LLM's role is strictly orchestration and explanation over a solver layer that is correct by construction. This is the "Correct Before Clever" pillar — the non-negotiable foundation.

## 3. Design Pillars (non-negotiable)

1. **Engineering-First** — P&ID-style equipment illustrations, industry-standard symbols, no toy aesthetics.
2. **Collaborative Interaction** — The AI is a partner: it proposes, the solver verifies, the user iterates.
3. **Correct Before Clever** — Every AI-generated element is inspectable and grounded in the verified solver layer. No unverified LLM math ever reaches the UI.
4. **Topology-as-State** — The network is a serializable JSON schema; it is the single source of truth shared between canvas, copilot, and solver.
5. **Solver-Bound UI** — The UI never computes its own math; it strictly fetches results from the verified solver layer.
6. **Reconciler** — A function compares canvas state with solver results and flags discrepancies ("Non-convergent", "Out of bounds").

## 4. Superstructure Philosophy (inspiration, not imitation)

Industrial reaction synthesis uses **superstructure optimization**: define a large graph containing every plausible configuration, then a MINLP solver (GAMS, BARON) selects which units to activate and their operating conditions to maximize an objective.

We cannot run full MINLP in a browser. But we adopt the **philosophy**:
- Instead of generating one topology, generate a *space* of candidates
- Run verified solvers on each
- Rank, compare, and let the AI guide the search toward promising regions

This is **AI-guided superstructure search** — more powerful than pure-AI (which hallucinates) or pure-MINLP (which can't explain its choices). The LLM proposes candidates from heuristics; the solver verifies and scores; an optimization loop narrows the search.

## 5. Multi-Agent Architecture (end state)

For complex problems, a single agent is insufficient. The target is specialized agents collaborating through **shared state** — never through LLM-to-LLM text (which causes hallucination cascades).

| Agent | Role | Reads | Writes |
|-------|------|-------|--------|
| **Planner** | Decomposes a goal into sub-tasks; assigns to specialists | Goal, current state | Task assignments |
| **Synthesizer** | Proposes reactor network topologies | Goal, constraints, heuristics | Candidate topologies |
| **Analyst** | Answers questions about the current topology; explains *why* | Topology, solver report | Explanations |
| **Optimizer** | Runs parameter sweeps; proposes improvements | Topology, objective | Optimal parameters + response surfaces |
| **Critic** | Reviews proposals; flags infeasible regions; suggests alternatives | Candidate topologies | Critiques, alternatives |
| **Verifier** | Checks mass/energy balance, constraints, convergence | Topology, solver report | Pass/fail + diagnostics |

**Critical principle:** Every agent reads the same topology + solver report. No agent trusts another agent's numbers — they all re-derive from the solver. The Reconciler (existing) is the Verifier agent's foundation.

## 6. Technology Constraints

- **Framework:** Next.js 16 App Router, TypeScript (non-negotiable)
- **Canvas:** React Flow (`@xyflow/react`)
- **State:** Zustand (topology) + the verified solver layer
- **AI:** `z-ai-web-dev-sdk` (LLM) — server-side only, never client
- **Styling:** Tailwind 4 + shadcn/ui (New York), zinc/charcoal palette, no indigo/blue
- **Database:** localStorage for now (single-user, single-session). A real database (Prisma/Postgres) is deferred until multi-device sync or sharing becomes a real requirement.
- **Performance:** Sub-5ms solver latency on parameter updates; all solver execution async/non-blocking
- **Accessibility:** All data visualizations labeled; semantic HTML; keyboard-navigable

## 7. Phased Roadmap

Each phase is additive — no rewrites. Each validates the architecture can support the next.

### Phase 1 — Foundation (✅ COMPLETE)
- Empty-state canvas with quick-add prompt
- Undo/Redo (history stack on topology/param mutations, not positions)
- Stream table (collapsible, every stream's flow/composition/temperature)

### Phase 2 — Equipment Visual Polish (✅ COMPLETE)
- CSTR: cooling jacket, curved-blade impeller, sampling port, motor fins
- PFR: 6 tubes, tube-pass baffles, shell-side utility nozzles
- Separator: feed tray distinction, downcomer weirs, reboiler/condenser hints
- Feed/Product: level gauges, realistic drum proportions
- All static SVG — zero runtime cost

### Phase 3 — Context-Aware Copilot (✅ COMPLETE)
**Goal:** The copilot can reason about the *current* topology, not just generate new ones. This is the bedrock — every future agent needs shared context.

**Deliverables:**
- Evolved `/api/copilot` to accept a **context payload**: current topology + solver report (KPIs + diagnostics) + the user's prompt
- `buildContextBlock()` server-side helper serializes real state into a compact text block the LLM reads
- The copilot distinguishes **generate** intents (produce a new topology) from **analyze** intents (answer a question about the current one) via keyword detection + context presence
- Analyze responses are grounded in the solver report — the LLM is instructed to cite actual KPIs and never invent numbers
- Example: user asks "why is conversion low?" → copilot receives the report, identifies CSTR-1, explains using real τ=1.00s, k=0.2155/s, X=17.7%

**Exit criteria (MET):** A user can ask a question about their current network and get an answer that references actual solver outputs, with no hallucinated numbers. Verified: "why is conversion low?" → grounded response citing CSTR-1 (17.7%, τ=1.00s, k=0.2155/s) and PFR-1 (47.4%, τ=1.50s, k=0.4284/s).

### Phase 4 — Multi-Candidate Generation (✅ COMPLETE)
**Goal:** First taste of superstructure-style search. Instead of one topology, the synthesizer proposes 2 alternatives, each verified by the solver, with a comparison view.

**Deliverables:**
- Added `generate-multi` mode to `/api/copilot`: the MULTI_SYSTEM_PROMPT instructs the LLM to produce 2 distinct candidate topologies (e.g. single CSTR vs single PFR) in one JSON response
- `sanitizeTopology()` helper extracts and validates each candidate's topology independently (separate from the envelope-level `sanitizeEnvelope`)
- Robust `extractJson()` with 3-tier repair: direct parse → slice between braces → fix trailing commas + auto-close truncated braces
- 3-attempt retry loop: if JSON parsing fails, the LLM is re-prompted with a "your previous response was not valid JSON" nudge (handles non-deterministic malformed output)
- Store: `candidates[]` state + `setCandidates()` runs the verified solver on each candidate so KPIs are real + `clearCandidates()`
- `CandidateComparison` panel: slides in below the canvas with side-by-side KPI cards (conversion, total volume, unit count, status). Each card has a "Load to canvas" button that applies that candidate and dismisses the panel
- CopilotSidecar: detects multi intent ("alternatives", "compare", "different ways"), routes to multi mode, shows reasoning, then surfaces the comparison panel

**Exit criteria (MET):** A user can request "give me 2 alternatives to achieve 90% conversion" and compare verified alternatives side-by-side, then load either to the canvas. Verified: 2 candidates (Single CSTR Network, Single PFR) each with solver-verified KPIs; clicking "Load to canvas" applies the topology and clears the panel.

### Phase 5 — The Optimizer Agent
**Goal:** The most differentiated capability — this is where we concretely beat ChatGPT/Gemini, which cannot do this at all.

**Deliverables:**
- "Optimize for yield/selectivity/volume" runs a real parameter sweep (grid search over volume × temperature)
- The solver runs across the grid; results plot as a response surface
- The optimizer returns the best operating point, grounded in solver data
- Sensitivity analysis: which parameter most affects the objective?

**Exit criteria:** A user can optimize a reactor and get a verified optimal operating point + a response surface plot.

### Phase 5.5 — The Property Agent (literature + database lookup)
**Goal:** The "fills in the gap" capability — when a user brings a question with minimal info, the agent retrieves real physical properties (ΔHr, Cp, Antoine coefficients, etc.) from external sources. This is the moat Aspen has; we approximate it with on-demand retrieval instead of a owned database.

**Deliverables:**
- A Property Agent that calls free/open APIs (NIST WebBook, PubChem) to fetch real thermochemical data by compound name or SMILES
- When the LLM needs a property (e.g. heat of reaction for an energy balance), it emits a property-lookup task; the agent fetches the real value and injects it into the context
- The solver layer is extended to use these real properties (Cp for energy balance, ΔHr for adiabatic temperature rise)
- Users can specify a reaction ("methanol dehydration to DME") and the tool auto-populates kinetics + thermo

**Exit criteria:** A user names a real reaction and the tool fetches and uses genuine physical properties — no manual data entry, no hallucinated constants.

**Note:** We do not own a property database. We fetch on demand from authoritative free sources. This is the pragmatic path to matching Aspen's "it just knows the chemistry" experience without the data-acquisition burden.

### Phase 6 — True Multi-Agent Collaboration
**Goal:** The "beats Gemini" moment. Separate agent personas surface in the chat and collaborate visibly.

**Deliverables:**
- Agent personas (Synthesizer, Analyst, Optimizer, Critic) surface as distinct participants in the chat
- The Planner decomposes complex goals and orchestrates the others
- Users watch the collaboration: synthesizer proposes → critic responds → optimizer refines → verifier checks
- All collaboration is grounded in shared solver state

**Exit criteria:** A user can give a complex goal ("design an optimal A→B process under 400K, minimize total volume, maximize yield") and watch multiple agents solve it collaboratively with verified results.

## 8. Out of Scope (for now)

- Full MINLP superstructure solving (browser constraint)
- A database / accounts / multi-device sync (deferred until a real need)
- Real-time collaboration / multi-user editing
- Mobile-native app (responsive web only)
- **Nuclear reactor design** — entirely different physics (neutron transport, burnup, thermal-hydraulics). This product is chemical reaction engineering only. Nuclear would be a separate venture.

## 9. Future Milestones (beyond Phase 6)

### Phase 7 — External Computation Backends (DWSIM, MATLAB)
**Goal:** Offload rigorous computation to external engines via a compute backend, so the AI can leverage full mass-energy balances, flash calculations, and advanced numerics.

**Architecture:** A separate mini-service (or set of services) that the Next.js API calls when it needs computation beyond the browser solver. The browser app stays thin; compute is offloaded.

- **DWSIM** (open-source Aspen-like flowsheet simulator, .NET): full mass-energy balance, flash, rigorous property models, CAPE-OPEN unit operations
- **MATLAB** (via mini-service or MCP): `ode45`, optimization toolboxes, control-system design, advanced numerics
- These are server-side integrations, likely Dockerized. They do NOT live in the Next.js app directly.

### Phase 8 — Reaction Pathway Discovery
**Goal:** The north star — the AI proposes and evaluates novel reaction pathways with verified economics, at lower cost than experimental screening.

- Combines: generalized solver (Phase 5) + property agent (Phase 5.5) + multi-agent reasoning (Phase 6) + external compute (Phase 7)
- The AI explores reaction networks the user hasn't considered, validates them with solvers + DWSIM, and ranks by yield/selectivity/economics

## 10. Change Log

- **Phase 1 complete** — empty-state, undo/redo, stream table
- **Phase 2 complete** — equipment glyph refinement
- **Phase 3 complete** — context-aware copilot (analyze mode grounded in solver report)
- **Phase 4 complete** — multi-candidate generation (superstructure-style search, comparison panel)
- **Phase 4.5 complete** — manual configuration dialog + stream UX + generalized n-th order solver
