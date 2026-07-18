# Recycle / Tear-Stream Convergence — Design Spec

**Date:** 2026-07-18 · **Status:** Approved

## Problem

`solveNetwork` (src/lib/solvers/orchestrator.ts) topologically sorts the
network and solves each node once. Nodes inside a recycle loop are appended
arbitrarily and solved with whatever upstream flows existed at that moment —
the loop is never converged, so recycle networks report unconverged (wrong)
steady-state numbers while claiming "verified" status. Separately, reactor
solvers use their static `params.feedRate` even when an upstream unit feeds
them, so propagated flow never affects conversion anywhere.

## Decisions (owner-approved)

1. **Reactors consume propagated flow:** any node with ≥1 incoming stream has
   its effective `feedRate` overridden by the sum of upstream outlet flows
   before solving. Physically correct; changes reported conversions for
   multi-reactor chains (correctly).
2. **Algorithm:** whole-network fixed-point iteration (direct substitution).
   Acyclic networks keep the existing single pass (fast path). Cyclic networks
   repeat the pass until stream flows are self-consistent. No tear-edge
   selection, no Wegstein — a pass costs microseconds (YAGNI).

## Behavior

- **Cycle detection:** topological sort already exists; a cycle exists iff the
  sorted list is shorter than the node list before the fallback append.
- **Initialization:** first pass uses each stream's declared `flowRate` as the
  guess for flows whose source hasn't been solved yet (current behavior).
- **Iteration:** up to `MAX_RECYCLE_ITERATIONS = 100` passes. Converged when
  every node's outlet flow changes by less than `1e-9 + 1e-6 * |flow|`
  between passes.
- **On convergence:** reconciler diagnostic
  `Recycle loop converged in N iterations`. Node statuses unchanged.
- **On non-convergence:** reconciler diagnostic
  `Recycle loop did not converge after 100 iterations`; every node that is
  part of a cycle gets `status: "error"` and `converged: false` so the UI
  shows red rather than a wrong number. `overallStatus` becomes `"error"`.
- **Feed nodes** are unaffected (no inlets). **Product/mixer/separator**
  already consume `inletFlow`; only reactor (cstr/pfr) behavior changes via
  the `feedRate` override.

## Testing (Vitest, tests/solvers/orchestrator.test.ts + new recycle file)

1. Existing 35 tests stay green except the series-propagation assertion,
   which is updated to the now-correct physics (CSTR's F_A0 = feed outlet).
2. **Analytic benchmark:** feed → mixer → CSTR → separator with bottoms
   recycled to the mixer. With first-order X(M) = a/(M+a), a = k·V·CA0,
   steady-state mixer flow M satisfies α·M² + (a − (1−α)·a... — the test
   solves the fixed-point equation `M = F0 + (1−α)·M²/(M+a)` independently
   (bisection in the test file) and asserts the orchestrator's converged
   mixer/separator flows match within 1e-4.
3. **Self-consistency invariant:** after solving any cyclic network, each
   node's summed upstream outlet flows equal the inlet flow it was solved
   with (< 1e-6 relative).
4. **Non-convergent loop flags error:** two mixers feeding each other with no
   consumption (loop gain 1 with an external feed continually adding flow)
   must produce the non-convergence diagnostic and error statuses, not hang.
5. Acyclic regression: series network still solves in one pass (no recycle
   diagnostic present).

## Out of scope

Temperature/composition mixing in mixers, multi-species streams, Wegstein
acceleration, UI changes (the stream table and reconciler panel already
render diagnostics and statuses).
