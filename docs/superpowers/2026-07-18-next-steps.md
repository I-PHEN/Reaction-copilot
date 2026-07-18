# Post-Modernization Assessment & Next Steps

**Date:** 2026-07-18 · **Branch:** `modernization`

## State after modernization

Verified on Windows / Node 22 / npm:

- `npm run build` — clean, **with TypeScript validation enforced** (the template shipped `ignoreBuildErrors: true`).
- `npm run lint` — zero errors, zero warnings.
- `npm test` — 35 Vitest tests, all passing; every solver pinned to a closed-form analytic benchmark (CSTR X=Da/(1+Da), quadratic n=2 closed form, PFR X=1−e^(−kτ), mass balances, reconciler, optimizer grid).
- App runs (`npm run dev`): homepage renders, properties API returns curated NIST data.
- Dependencies: 62 → 26 (294 packages removed); repo stripped of all z.ai template baggage (~45 files of unrelated "skills", scripts, examples, prisma, 37 unused ui components, hello-world route).

### Real bugs found and fixed during the refactor

1. **`sanitizeEnvelope` ReferenceError** (copilot route): referenced out-of-scope
   variables; every successfully parsed generate-mode LLM response crashed to a
   500. Hidden by `ignoreBuildErrors`. Fixed; strict builds now prevent the class.
2. **Invisible toasts**: UI fired `sonner` toasts but the layout mounted the
   radix `<Toaster>`; no toast ever rendered. Sonner is now mounted.
3. **Dead `source: "local"` key** in the properties route (overwritten by spread).
4. **Dead `reasoning` state key** in the store's `clearSession`.

## Action items (owner)

1. **AI features need credentials** — the copilot chat returns
   `"Configuration file not found"`: `z-ai-web-dev-sdk` wants a `.z-ai-config`
   file (gitignored, so it never left the original machine). Create one locally
   to restore chat. Everything else works without it.
2. **Rotate any secret that was in `.env`** — the file *was committed* to the
   GitHub repo (now untracked going forward, but it remains in git history).
   If it holds an API key, rotate the key; optionally rewrite history
   (`git filter-repo`) before making the repo public.

## Remaining tech debt (scheduled, not urgent)

- `glyphs.tsx` (17KB) — cohesive SVG library, intentionally not split.
- `topology.ts` (17KB) — the Zustand store covers topology + solver + chat +
  session; worth splitting into slices when Phase 6 grows it further.
- `worklog.md` (55KB) — consider moving to `docs/` or pruning.
- React `StrictMode` is now on (Next default) — watch for double-effect issues
  in dev; none observed in smoke testing.

## Recommended next milestone

**1. Decouple the LLM provider (do this first, ~small).** The app is
hard-wired to `z-ai-web-dev-sdk` (v0.0.18, platform-specific config file, no
streaming used). Extract a thin `LlmClient` interface in `src/lib/copilot/`
with the current Z.ai implementation behind it, then add an Anthropic (or any
OpenAI-compatible) implementation selected by env var. This unblocks local dev
on any machine, removes the single-vendor risk, and is a prerequisite for
Phase 6's multi-agent work (different agents may want different models).

**2. PRD Phase 6 — multi-agent collaboration (the real feature milestone).**
The codebase is now well-positioned: prompts/normalize/context are separated,
the solver layer is tested, and mode detection is isolated in the route. The
Planner/Synthesizer/Analyst/Optimizer/Critic/Verifier loop can be built as a
server-side orchestration over the existing four prompt modes, with the
Verifier role literally being `solveNetwork` + the reconciler.

**3. Phase 7 (DWSIM/MATLAB backends)** stays after 6 — the `SolverResult`
interface is the right seam, but there's no user pull yet.

Suggested order: 1 → 2 → 3.
