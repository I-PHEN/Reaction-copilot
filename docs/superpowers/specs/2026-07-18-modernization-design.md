# Reaction-copilot Deep Modernization — Design Spec

**Date:** 2026-07-18
**Status:** Approved (scope + runtime + design confirmed by owner)

## Goal

Bring the repo from "working z.ai-template prototype" to a clean, modern, tested,
Windows-runnable codebase — with identical user-facing behavior — then run it and
produce a prioritized what's-next assessment against the PRD roadmap.

## Context

- App: Next.js 16 (App Router) + React 19 + TypeScript 5 + Tailwind 4 + shadcn/ui.
  Real code lives in `src/lib/solvers` (CSTR/PFR/kinetics/orchestrator math) and
  `src/components/reactor` (canvas, sidecar, overlays).
- The repo was scaffolded from a z.ai template and still carries its baggage:
  unrelated `skills/`, `.zscripts/`, `examples/`, `db/custom.db`, `mini-services/`,
  `prisma/` + `src/lib/db.ts` (unimported), `Caddyfile`, ~30 unused shadcn `ui/`
  components, and ~25+ unused npm dependencies.
- Built with Bun; this machine has only Node 22 + npm. npm scripts use Unix-only
  `tee`/`cp`.
- The solver layer — the product's core credibility claim — has zero tests.

## Decisions

1. **Scope:** Deep modernization (owner-selected over pragmatic cleanup).
2. **Runtime:** Standardize on npm + Node. Remove `bun.lock`, commit
   `package-lock.json`, cross-platform scripts.
3. **Behavior:** No user-facing behavior changes. Refactor only.

## Workstreams (in order; repo stays working after each)

### WS1 — Template purge

Delete: `skills/`, `.zscripts/`, `examples/`, `db/`, `mini-services/`, `download/`,
`upload/`, `prisma/`, `src/lib/db.ts`, `Caddyfile`, and every `src/components/ui/*`
component not transitively imported from app code. Then remove npm dependencies with
no remaining imports (candidates: prisma, @prisma/client, next-auth, next-intl,
@mdxeditor/editor, @dnd-kit/*, embla-carousel-react, react-hook-form,
@hookform/resolvers, @tanstack/react-query, @tanstack/react-table, sharp,
react-day-picker, react-syntax-highlighter, input-otp, vaul, cmdk, date-fns,
@reactuses/core, uuid — final list determined by import analysis, verified by a
clean build). Rename package to `reaction-copilot`. Keep `.env` untouched.

### WS2 — npm + Windows-compatible tooling

- `dev`: `next dev -p 3000` (no `tee`)
- `build`: `next build` (no standalone `cp` hackery)
- `start`: `next start`
- Drop `db:*` scripts with prisma.
- `npm install` → commit `package-lock.json`, delete `bun.lock`.

### WS3 — Modular refactor of oversized files

- `src/app/api/copilot/route.ts` (34KB) → `src/lib/copilot/`:
  - `prompts.ts` — system prompts for generate/analyze/multi/optimize modes
  - `schema.ts` — Zod schemas for the LLM JSON envelope (zod already a dep;
    replaces hand-rolled trust/normalize)
  - `normalize.ts` — topology normalization/repair helpers
  - route file becomes a thin handler (mode dispatch + streaming plumbing)
- `src/components/reactor/CopilotSidecar.tsx` (26KB) →
  - extracted presentational components (message bubble, thinking block,
    quick actions)
  - `useCopilotStream` hook owning fetch/streaming/parse state machine
- Other large files (DeepDiveOverlay, ReactorCanvas, topology store) get splits
  only where a seam is obvious; no speculative reorganization.

### WS4 — Strict typing + clean lint

- `tsconfig.json`: full `strict: true` (plus `noUncheckedIndexedAccess` if the
  fallout is manageable); fix all resulting errors.
- `npm run lint` → zero errors/warnings.

### WS5 — Solver test suite (Vitest)

Add Vitest + `npm test`. Tests validate against closed-form analytic solutions:

- `kinetics`: Arrhenius k(T) known values; n-th order rate law.
- `cstr`: first-order analytic X = kτ/(1+kτ); Newton-Raphson path (n≠1)
  converges and matches analytic where closed forms exist (n=2).
- `pfr`: RK4 result vs exact first-order X = 1 − exp(−kτ); grid-independence
  sanity check.
- `units`: mixer/separator mass balances conserve moles; split fractions.
- `orchestrator`: series network conversion composition; recycle loop converges;
  reconciler flags an injected discrepancy.
- `optimizer`: grid search returns the true optimum on a known surface.

### Run & verify

- `npm run build` passes clean; `npm run dev` serves the app; exercise the flow
  (generate via quick action, inspect node, drag slider, stream table updates).
- Known risk: copilot chat depends on `z-ai-web-dev-sdk` credentials in `.env`
  (not read during this work). If the LLM call fails locally, document exactly
  what's needed; solver/canvas features must still fully work.

### What's-next assessment

Deliverable: a short prioritized writeup mapping observed gaps to PRD Phases 6–8
(multi-agent collaboration, external computation backends, pathway discovery),
plus any newly discovered technical debt worth scheduling.

## Error handling

- Zod schema failures on the LLM envelope return a structured 422 with the raw
  model text preserved for debugging (matches current behavior of tolerant
  parsing — normalization repairs what it can before rejecting).
- Solver edge cases surfaced by tests (non-convergence, zero flow) must throw
  typed errors, not NaN-propagate.

## Success criteria

1. `npm run build`, `npm run lint`, `npm test` all pass clean on Windows.
2. App runs via `npm run dev` with identical behavior.
3. No file in `src/` over ~15KB except where splitting would hurt cohesion.
4. Repo contains nothing the app doesn't use.
