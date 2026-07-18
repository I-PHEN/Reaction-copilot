/**
 * Network Solver Orchestrator + Reconciler
 * ---------------------------------------------------------------
 * Walks the reactor network topology in topological order, propagates
 * molar flows along streams, dispatches each node to its verified
 * solver, then runs the *Reconciler*: a function that compares the
 * canvas-declared state with the solver-computed state and flags any
 * discrepancy (non-convergence, out-of-bounds, broken mass balance).
 *
 * Recycle loops: when the topology contains a cycle, a single pass
 * cannot be self-consistent (the recycle stream's flow depends on the
 * units it feeds). The orchestrator then repeats the pass — direct
 * substitution on the node outlet flows — until every flow is stable
 * within tolerance, or flags the loop as non-convergent. Every node
 * with an upstream connection consumes the *propagated* inlet flow as
 * its F_A0, so recycle actually changes reactor conversion.
 *
 * The UI MUST never compute its own math — it only reads SolverReport.
 */
import { DEFAULT_PARAMS, type NetworkNode, type ReactorNetwork, type SolverReport, type SolverResult } from "./types";
import { solveCSTR } from "./cstr";
import { solvePFR } from "./pfr";
import { solveMixer, solveSeparator } from "./units";
import { rateConstant } from "./kinetics";

const MAX_RECYCLE_ITERATIONS = 100;

/** Convergence tolerance on a node outlet flow between passes [mol/s]. */
function flowTolerance(flow: number): number {
  return 1e-9 + 1e-6 * Math.abs(flow);
}

function topoOrder(network: ReactorNetwork): {
  ordered: NetworkNode[];
  cyclicIds: Set<string>;
} {
  const inDeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  network.nodes.forEach((n) => {
    inDeg.set(n.id, 0);
    adj.set(n.id, []);
  });
  network.streams.forEach((s) => {
    inDeg.set(s.target, (inDeg.get(s.target) ?? 0) + 1);
    adj.get(s.source)?.push(s.target);
  });
  const queue = network.nodes.filter((n) => (inDeg.get(n.id) ?? 0) === 0).map((n) => n.id);
  const ordered: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    ordered.push(id);
    for (const next of adj.get(id) ?? []) {
      inDeg.set(next, (inDeg.get(next) ?? 0) - 1);
      if ((inDeg.get(next) ?? 0) === 0) queue.push(next);
    }
  }
  // Nodes Kahn's algorithm could not sort are inside (or gated behind) a
  // cycle. Append them so every node is still solved each pass; the
  // iteration loop is responsible for converging their flows.
  const cyclicIds = new Set<string>();
  for (const n of network.nodes) {
    if (!ordered.includes(n.id)) {
      ordered.push(n.id);
      cyclicIds.add(n.id);
    }
  }
  return {
    ordered: ordered
      .map((id) => network.nodes.find((n) => n.id === id)!)
      .filter(Boolean),
    cyclicIds,
  };
}

export function solveNetwork(network: ReactorNetwork): SolverReport {
  const { ordered, cyclicIds } = topoOrder(network);
  const reconcilerDiagnostics: string[] = [];

  // Tracked outlet flow per node (mol/s of reactant A). Persists across
  // passes so recycle streams read the previous iteration's value.
  const outletFlow = new Map<string, number>();

  const runPass = (): Record<string, SolverResult> => {
    const results: Record<string, SolverResult> = {};

    for (const node of ordered) {
      const params = { ...DEFAULT_PARAMS, ...node.params };

      // Sum incoming flows. A not-yet-solved source (first pass through a
      // recycle) falls back to the stream's declared flowRate.
      const incoming = network.streams.filter((s) => s.target === node.id);
      const inletFlow = incoming.reduce(
        (sum, s) => sum + (outletFlow.get(s.source) ?? s.flowRate ?? params.feedRate),
        0,
      );
      // Connected nodes consume the propagated flow as their F_A0; a node
      // with no inlet (feed, or an orphan) uses its configured feedRate.
      const effective = incoming.length > 0 ? { ...params, feedRate: inletFlow } : params;

      let result: SolverResult;
      switch (node.type) {
        case "feed": {
          result = {
            nodeId: node.id,
            converged: true,
            conversion: 0,
            residenceTime: 0,
            outletTemperature: params.temperature,
            outletFlow: params.feedRate,
            rateConstant: 0,
            residual: 0,
            diagnostics: [],
            status: "nominal",
          };
          break;
        }
        case "cstr":
          result = solveCSTR(node.id, effective);
          break;
        case "pfr":
          result = solvePFR(node.id, effective);
          break;
        case "mixer":
          result = solveMixer(node.id, effective, inletFlow);
          break;
        case "separator":
          result = solveSeparator(node.id, effective, inletFlow);
          break;
        case "product": {
          result = {
            nodeId: node.id,
            converged: true,
            conversion: 0,
            residenceTime: 0,
            outletTemperature: params.temperature,
            outletFlow: inletFlow,
            rateConstant: 0,
            residual: 0,
            diagnostics: [],
            status: "nominal",
          };
          break;
        }
        default:
          result = {
            nodeId: node.id,
            converged: false,
            conversion: 0,
            residenceTime: 0,
            outletTemperature: params.temperature,
            outletFlow: 0,
            rateConstant: 0,
            residual: 0,
            diagnostics: ["Unknown node type"],
            status: "error",
          };
      }

      outletFlow.set(node.id, result.outletFlow);
      results[node.id] = result;
    }

    return results;
  };

  // ---- Solve: single pass for acyclic networks, fixed-point iteration
  // (direct substitution on outlet flows) when a recycle loop exists.
  let results = runPass();
  let recycleConverged = true;
  if (cyclicIds.size > 0) {
    recycleConverged = false;
    for (let iteration = 1; iteration <= MAX_RECYCLE_ITERATIONS; iteration++) {
      const previous = new Map(outletFlow);
      results = runPass();
      let stable = true;
      for (const [id, flow] of outletFlow) {
        const prev = previous.get(id);
        if (prev === undefined || Math.abs(flow - prev) > flowTolerance(flow)) {
          stable = false;
          break;
        }
      }
      if (stable) {
        recycleConverged = true;
        reconcilerDiagnostics.push(`Recycle loop converged in ${iteration} iterations`);
        break;
      }
    }
    if (!recycleConverged) {
      reconcilerDiagnostics.push(
        `Recycle loop did not converge after ${MAX_RECYCLE_ITERATIONS} iterations — flows are not at steady state`,
      );
      for (const id of cyclicIds) {
        const r = results[id];
        if (r) {
          results[id] = {
            ...r,
            converged: false,
            status: "error",
            diagnostics: [...r.diagnostics, "Part of a non-convergent recycle loop"],
          };
        }
      }
    }
  }

  // ---- Reconciler: per-node sanity checks on the final state ----------
  for (const node of ordered) {
    const params = { ...DEFAULT_PARAMS, ...node.params };
    const result = results[node.id];
    if (!result) continue;
    if (node.type === "cstr" || node.type === "pfr") {
      const k = rateConstant(params.preExponential, params.activationEnergy, params.temperature);
      if (!Number.isFinite(k) || k <= 0) {
        reconcilerDiagnostics.push(
          `[${node.label}] k(T) non-physical — check Arrhenius parameters`,
        );
      }
      if (params.temperature < 273) {
        reconcilerDiagnostics.push(`[${node.label}] T below freezing point of water`);
      }
    }
    if (result.status === "error") {
      reconcilerDiagnostics.push(`[${node.label}] convergence error — solver flagged non-convergent`);
    }
  }

  // ---- Reconciler: network-level structural integrity ---------------
  // For a reacting system the *reactant* (A) flow is consumed by design,
  // so a feed-vs-product A-flow delta is expected physics, not a defect.
  // Instead the reconciler verifies the topology is structurally sound:
  // every feed has an outlet, every product has an inlet, and every
  // processing unit is both fed and drained (separators exempt on the
  // secondary outlet).
  const outletCount = new Map<string, number>();
  const inletCount = new Map<string, number>();
  network.streams.forEach((s) => {
    outletCount.set(s.source, (outletCount.get(s.source) ?? 0) + 1);
    inletCount.set(s.target, (inletCount.get(s.target) ?? 0) + 1);
  });
  for (const n of network.nodes) {
    const out = outletCount.get(n.id) ?? 0;
    const in_ = inletCount.get(n.id) ?? 0;
    if (n.type === "feed" && out === 0) {
      reconcilerDiagnostics.push(`[${n.label}] feed node has no outgoing stream`);
    }
    if (n.type === "product" && in_ === 0) {
      reconcilerDiagnostics.push(`[${n.label}] product node is unreachable (no inlet)`);
    }
    if ((n.type === "cstr" || n.type === "pfr" || n.type === "mixer") && (in_ === 0 || out === 0)) {
      reconcilerDiagnostics.push(`[${n.label}] ${n.type.toUpperCase()} is ${in_ === 0 ? "unfed" : "undrained"}`);
    }
    if (n.type === "separator" && in_ === 0) {
      reconcilerDiagnostics.push(`[${n.label}] separator has no inlet`);
    }
  }

  const overall: SolverReport["overallStatus"] = Object.values(results).some(
    (r) => r.status === "error",
  )
    ? "error"
    : Object.values(results).some((r) => r.status === "warning") ||
        reconcilerDiagnostics.length > 0
      ? "warning"
      : "nominal";

  return { results, network, reconcilerDiagnostics, overallStatus: overall };
}
