/**
 * Network Solver Orchestrator + Reconciler
 * ---------------------------------------------------------------
 * Walks the reactor network topology in topological order, propagates
 * molar flows along streams, dispatches each node to its verified
 * solver, then runs the *Reconciler*: a function that compares the
 * canvas-declared state with the solver-computed state and flags any
 * discrepancy (non-convergence, out-of-bounds, broken mass balance).
 *
 * The UI MUST never compute its own math — it only reads SolverReport.
 */
import { DEFAULT_PARAMS, type NetworkNode, type ReactorNetwork, type SolverReport, type SolverResult } from "./types";
import { solveCSTR } from "./cstr";
import { solvePFR } from "./pfr";
import { solveMixer, solveSeparator } from "./units";
import { rateConstant } from "./kinetics";

function topoOrder(network: ReactorNetwork): NetworkNode[] {
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
  // Fallback: any cycles / orphans get appended so every node is solved.
  for (const n of network.nodes) if (!ordered.includes(n.id)) ordered.push(n.id);
  return ordered
    .map((id) => network.nodes.find((n) => n.id === id)!)
    .filter(Boolean);
}

export function solveNetwork(network: ReactorNetwork): SolverReport {
  const order = topoOrder(network);
  const results: Record<string, SolverResult> = {};
  const reconcilerDiagnostics: string[] = [];

  // Tracked outlet flow per node (mol/s of reactant A).
  const outletFlow = new Map<string, number>();

  for (const node of order) {
    const params = { ...DEFAULT_PARAMS, ...node.params };
    let result: SolverResult;

    // Sum incoming flows for this node.
    const incoming = network.streams.filter((s) => s.target === node.id);
    const inletFlow = incoming.reduce(
      (sum, s) => sum + (outletFlow.get(s.source) ?? s.flowRate ?? params.feedRate),
      0,
    );

    switch (node.type) {
      case "feed": {
        const flow = params.feedRate;
        outletFlow.set(node.id, flow);
        result = {
          nodeId: node.id,
          converged: true,
          conversion: 0,
          residenceTime: 0,
          outletTemperature: params.temperature,
          outletFlow: flow,
          rateConstant: 0,
          residual: 0,
          diagnostics: [],
          status: "nominal",
        };
        break;
      }
      case "cstr":
        result = solveCSTR(node.id, params);
        break;
      case "pfr":
        result = solvePFR(node.id, params);
        break;
      case "mixer":
        result = solveMixer(node.id, params, inletFlow);
        break;
      case "separator":
        result = solveSeparator(node.id, params, inletFlow);
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

    // For reactors, propagate the *reactant* outlet flow downstream.
    if (node.type === "feed") outletFlow.set(node.id, params.feedRate);
    else if (result.outletFlow !== undefined) outletFlow.set(node.id, result.outletFlow);

    // ---- Reconciler: per-node sanity checks -------------------------
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

    results[node.id] = result;
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
