# Recycle Convergence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cyclic reactor networks converge to a self-consistent steady state (fixed-point iteration) and reactors consume propagated inlet flow; non-convergence is flagged as an error instead of reporting wrong numbers.

**Architecture:** All changes live in `src/lib/solvers/orchestrator.ts` (restructured around an inner `runPass`) plus tests. Node solvers, types, store, and UI are untouched — statuses/diagnostics already render.

**Tech Stack:** TypeScript strict, Vitest.

## Global Constraints

- Existing 35 tests must stay green (spec: series test numbers are unchanged because feed outlet == configured feedRate there).
- `MAX_RECYCLE_ITERATIONS = 100`; convergence tolerance `1e-9 + 1e-6 * |flow|` per node outlet.
- Known pre-existing limitation, out of scope: outlet flow is per-node, not per-stream, so a separator's two outlet streams both carry the bottoms value downstream.

---

### Task 1: Failing tests for propagated feed + recycle convergence

**Files:**
- Create: `tests/solvers/recycle.test.ts`
- Modify: none yet

**Interfaces:**
- Consumes: `solveNetwork(network: ReactorNetwork): SolverReport` (unchanged signature); `rateConstant` from kinetics.
- Produces: the acceptance suite for Task 2.

- [ ] **Step 1: Write the tests** — four describe blocks:
  (a) *2-stage propagation:* feed(10) → cstr(V=2,T=380,CA0=5,v0=2) → cstr#2(same params, configured feedRate=10) → product. Assert cstr2's outletFlow ≈ `f1out*(1-X1)*(1-X2eff)` where X2 is computed from Da = k·V·CA0 / (propagated inlet), i.e. `report.results["r2"].outletFlow` < the value it would have with static feedRate; concretely assert `r2.outletFlow ≈ r1.outletFlow * (1 - a/(r1.outletFlow + a))` with `a = k*V*CA0`.
  (b) *Analytic recycle benchmark:* feed(F0=10) → mixer → cstr(V=2,T=380,CA0=5,v0=2) → separator(α=0.5) with bottoms stream back to mixer. In-test bisection solves `M = F0 + (1-α)·M²/(M+a)` on [F0, F0/α]; assert mixer result outletFlow ≈ M (tol 1e-3) and reconcilerDiagnostics contain `/recycle loop converged/i`.
  (c) *Self-consistency:* for the benchmark network, every node with inlets: sum of upstream `results[src].outletFlow` equals the flow implied by its own result (mixer outlet == its summed inlets; cstr outlet == inlet·(1-X)).
  (d) *Non-convergence:* feed(10) → m1 ⇄ m2 (mutual streams). Assert diagnostics match `/did not converge/i`, `overallStatus === "error"`, and `results["m1"].status === "error"`.
  Plus (e) *acyclic regression:* series network report has NO `/recycle/i` diagnostic.
- [ ] **Step 2: Run** `npm test` — new file FAILS (b–d), existing 35 still pass.
- [ ] **Step 3: Commit** `git commit -m "Add failing recycle-convergence tests (analytic benchmark, consistency, divergence)"`

### Task 2: Implement fixed-point orchestrator

**Files:**
- Modify: `src/lib/solvers/orchestrator.ts`

**Interfaces:**
- Produces: same exported `solveNetwork` signature; `topoOrder` becomes `topoOrder(network): { ordered: NetworkNode[]; cyclicIds: Set<string> }` (module-private).

- [ ] **Step 1: Restructure** — `topoOrder` returns leftover (cycle-region) ids as `cyclicIds`. Extract the node-solving loop into `runPass(outletFlow, results)` closure: per node, `inletFlow` = sum of `outletFlow.get(src) ?? stream.flowRate ?? params.feedRate`; if the node has ≥1 incoming stream, solve with `{ ...params, feedRate: inletFlow }`. Per-node reconciler checks move AFTER iteration (they depend only on params + final result). Iteration: run once; if `cyclicIds.size > 0`, loop to 100 comparing per-node outlet deltas against `1e-9 + 1e-6*|flow|`; push convergence or non-convergence diagnostic; on failure set `status:"error"`, `converged:false` on nodes in `cyclicIds` and force `overallStatus:"error"`.
- [ ] **Step 2: Run** `npm test` — all pass (35 old + new). `npx tsc --noEmit` clean.
- [ ] **Step 3: Commit** `git commit -m "Converge recycle loops via fixed-point iteration; reactors consume propagated inlet flow"`

### Task 3: Verify, merge, push

- [ ] **Step 1:** `npm run build` + `npm run lint` clean; confirm dev server still serves the app (HMR) — load homepage 200.
- [ ] **Step 2:** Merge `recycle-convergence` branch (created at start) into `main`, push origin.
