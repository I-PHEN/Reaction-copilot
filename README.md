# Reactor Engineering Synthesis Copilot

An AI-assisted reaction-engineering workspace that beats general-purpose LLMs at reactor synthesis by grounding every number in a **verified solver layer**. The AI orchestrates, proposes, and explains — it never computes. Every conversion, residence time, and rate constant comes from a real solver.

> **Status:** Phases 1–5.5 complete. See [PRD.md](./PRD.md) for the full roadmap.

---

## What it does

- **Generates** reactor networks from natural language ("design a 2-stage CSTR+PFR train for 95% conversion")
- **Analyzes** your current topology using real solver data ("why is conversion low in CSTR-1?")
- **Compares** multiple candidate configurations side-by-side with verified KPIs
- **Optimizes** reactors via parameter sweeps with response surfaces and sensitivity analysis
- **Handles arbitrary reaction orders** (0th, 1st, 2nd, 3rd, fractional) via Newton-Raphson CSTR + RK4 PFR solvers
- **Fetches real physical properties** (ΔHf, Cp, MW) from a curated NIST database + PubChem fallback

## Why it's different

General-purpose LLMs (ChatGPT, Gemini) fail at reaction engineering because they hallucinate rate constants, can't integrate ODEs, and have no concept of mass-energy balance. This tool's advantage is **not a better LLM** — it's that every number is verified by a real solver. The LLM's job is strictly orchestration and explanation over a solver layer that is correct by construction.

## Design pillars

1. **Engineering-First** — P&ID-style equipment illustrations, industry-standard symbols
2. **Collaborative Interaction** — AI proposes, solver verifies, user iterates
3. **Correct Before Clever** — every AI-generated element is grounded in the verified solver
4. **Topology-as-State** — the network is a serializable JSON schema, the single source of truth
5. **Solver-Bound UI** — the UI never computes its own math
6. **Reconciler** — flags discrepancies between canvas state and solver results

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node 22 + npm |
| Framework | Next.js 16 (App Router, Turbopack) |
| Tests | Vitest (solver layer pinned to analytic solutions) |
| Language | TypeScript 5 |
| Canvas | React Flow (`@xyflow/react`) |
| State | Zustand |
| AI | `z-ai-web-dev-sdk` (server-side only) |
| Styling | Tailwind CSS 4 + shadcn/ui (zinc/charcoal) |
| Charts | Recharts |
| Animation | Framer Motion (functional only, no fluff) |
| Persistence | localStorage (database deferred — see PRD §8) |

## Getting started

```bash
# Install dependencies
npm install

# Start the dev server (port 3000)
npm run dev

# Lint / type-safe build / solver tests
npm run lint
npm run build
npm test
```

Open `http://localhost:3000` in your browser.

> **AI features:** the copilot chat calls Z.ai through `z-ai-web-dev-sdk`, which
> requires a `.z-ai-config` file (gitignored) in the project or home directory.
> Without it the canvas, solvers, Deep Dive, and optimizer all still work — only
> the natural-language chat is disabled.

## Project structure

```
src/
├── app/
│   ├── api/
│   │   ├── copilot/route.ts      # LLM endpoint (generate/analyze/multi/optimize modes)
│   │   └── properties/route.ts   # Property lookup (local NIST DB + PubChem)
│   ├── layout.tsx
│   └── page.tsx                  # Tri-pane layout (canvas + sidecar + footer)
├── components/
│   ├── reactor/
│   │   ├── ReactorCanvas.tsx     # React Flow canvas (dark, orthogonal streams)
│   │   ├── CopilotSidecar.tsx    # Chat UI (streaming, thinking, quick actions)
│   │   ├── DeepDiveOverlay.tsx   # Per-node KPI card (tabs: overview/profile/parameters)
│   │   ├── StreamTable.tsx       # Unified bottom bar (reconciler + stream table)
│   │   ├── CandidateComparison.tsx  # Multi-candidate side-by-side cards
│   │   ├── ResponseSurface.tsx   # Optimizer heatmap + sensitivity
│   │   ├── ConfigurationDialog.tsx  # Manual reactor setup (reaction/order/kinetics)
│   │   ├── glyphs.tsx            # P&ID-style equipment SVGs (CSTR, PFR, separator...)
│   │   └── nodes/ReactorNode.tsx # Custom React Flow node
├── lib/
│   ├── solvers/
│   │   ├── types.ts              # Topology schema + NodeParams + SolverResult
│   │   ├── kinetics.ts           # Arrhenius k(T), n-th order rate law
│   │   ├── cstr.ts               # CSTR solver (analytic + Newton-Raphson for n≠1)
│   │   ├── pfr.ts                # PFR solver (RK4 integration)
│   │   ├── units.ts              # Mixer + separator solvers
│   │   ├── orchestrator.ts       # Network solver + reconciler
│   │   ├── optimizer.ts          # Grid search over volume × temperature
│   │   └── properties.ts         # Curated NIST compound database + PubChem fetch
│   └── store/
│       └── topology.ts           # Zustand store (topology, solver, undo/redo, session)
├── PRD.md                        # Product requirements document
└── worklog.md                    # Development log
```

## How a user flows through it

1. **Start** — empty canvas with a centered "Start a reactor network" prompt
2. **Generate** — type a goal ("design a CSTR+PFR train for 90% conversion") or click a quick action; the copilot streams its thinking, then commits a verified topology
3. **Inspect** — double-click a unit to open the Deep Dive (KPIs, profile chart, parameter sliders)
4. **Iterate** — drag parameter sliders; the solver re-converges in real time, KPIs flash cyan
5. **Compare** — ask for alternatives; compare candidates side-by-side, load the best one
6. **Optimize** — ask to optimize; get a response surface heatmap + optimal operating point
7. **Save** — save topologies to the library (localStorage); reload anytime

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + =` | Zoom in |
| `Ctrl/Cmd + -` | Zoom out |
| `Ctrl/Cmd + 0` | Fit view |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` | Redo |
| `Delete` / `Backspace` | Delete selected node |
| `Esc` | Cancel connect mode |
| `Enter` | Send chat message |
| `Shift + Enter` | Newline in chat |
| Double-click node | Inspect |
| Right-click node | Context menu (Inspect / Configure / Connect / Duplicate / Pin / Delete) |

## Roadmap

See [PRD.md](./PRD.md) for the full phased roadmap. Completed phases:

- ✅ **Phase 1** — empty-state, undo/redo, stream table
- ✅ **Phase 2** — equipment glyph refinement (jackets, impellers, trays, gauges)
- ✅ **Phase 3** — context-aware copilot (analyze mode grounded in solver report)
- ✅ **Phase 4** — multi-candidate generation (superstructure-style search)
- ✅ **Phase 4.5** — manual configuration dialog + stream UX + n-th order solver
- ✅ **Phase 5** — optimizer agent (parameter sweep, response surface, sensitivity)
- ✅ **Phase 5.5** — property agent (curated NIST database + PubChem fallback)

Upcoming:

- ⏳ **Phase 6** — true multi-agent collaboration (Planner, Synthesizer, Analyst, Optimizer, Critic, Verifier)
- ⏳ **Phase 7** — external computation backends (DWSIM, MATLAB)
- ⏳ **Phase 8** — reaction pathway discovery (the north star)

## License

MIT
