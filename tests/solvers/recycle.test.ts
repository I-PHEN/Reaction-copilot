import { describe, expect, it } from "vitest";
import { rateConstant } from "@/lib/solvers/kinetics";
import { solveNetwork } from "@/lib/solvers/orchestrator";
import { DEFAULT_PARAMS, type ReactorNetwork } from "@/lib/solvers/types";

const REACTOR_PARAMS = {
  volume: 2,
  temperature: 380,
  inletConcentration: 5,
  volumetricFlow: 2,
  feedRate: 10,
  reactionOrder: 1,
};

/** a = k·V·CA0 so that for a first-order CSTR, Da = a / F_A0 and X = a/(F_A0 + a). */
function aParam(): number {
  const k = rateConstant(
    DEFAULT_PARAMS.preExponential,
    DEFAULT_PARAMS.activationEnergy,
    REACTOR_PARAMS.temperature,
  );
  return k * REACTOR_PARAMS.volume * REACTOR_PARAMS.inletConcentration;
}

describe("solveNetwork — propagated feed flow (2-stage train)", () => {
  it("stage 2 consumes stage 1's outlet, not its configured feedRate", () => {
    const net: ReactorNetwork = {
      nodes: [
        { id: "f1", type: "feed", label: "Feed", position: { x: 0, y: 0 }, params: { feedRate: 10, temperature: 380 } },
        { id: "r1", type: "cstr", label: "CSTR-1", position: { x: 300, y: 0 }, params: { ...REACTOR_PARAMS } },
        { id: "r2", type: "cstr", label: "CSTR-2", position: { x: 600, y: 0 }, params: { ...REACTOR_PARAMS } },
        { id: "p1", type: "product", label: "Product", position: { x: 900, y: 0 }, params: {} },
      ],
      streams: [
        { id: "s1", source: "f1", target: "r1", flowRate: 10 },
        { id: "s2", source: "r1", target: "r2", flowRate: 10 },
        { id: "s3", source: "r2", target: "p1", flowRate: 10 },
      ],
      meta: { species: "A,B", reaction: "A → B" },
    };
    const report = solveNetwork(net);
    const a = aParam();
    const r1out = report.results["r1"].outletFlow;
    // Stage 1: F_A0 = 10 ⇒ X1 = a/(10+a), outlet = 10·(1-X1) = 100/(10+a).
    expect(r1out).toBeCloseTo(100 / (10 + a), 4);
    // Stage 2 must see F_A0 = r1out ⇒ outlet = r1out²/(r1out + a).
    expect(report.results["r2"].outletFlow).toBeCloseTo((r1out * r1out) / (r1out + a), 4);
    expect(report.results["p1"].outletFlow).toBeCloseTo((r1out * r1out) / (r1out + a), 4);
  });
});

function recycleNetwork(alpha: number): ReactorNetwork {
  return {
    nodes: [
      { id: "f1", type: "feed", label: "Feed", position: { x: 0, y: 0 }, params: { feedRate: 10, temperature: 380 } },
      { id: "m1", type: "mixer", label: "Mixer", position: { x: 200, y: 0 }, params: {} },
      { id: "r1", type: "cstr", label: "CSTR-1", position: { x: 450, y: 0 }, params: { ...REACTOR_PARAMS } },
      { id: "sep", type: "separator", label: "Separator", position: { x: 750, y: 0 }, params: { splitFraction: alpha } },
      { id: "p1", type: "product", label: "Product", position: { x: 1000, y: 0 }, params: {} },
    ],
    streams: [
      { id: "s1", source: "f1", target: "m1", flowRate: 10 },
      { id: "s2", source: "m1", target: "r1", flowRate: 10 },
      { id: "s3", source: "r1", target: "sep", flowRate: 10 },
      { id: "s4", source: "sep", target: "p1", flowRate: 5 },
      { id: "s5", source: "sep", target: "m1", flowRate: 5 }, // recycle (bottoms)
    ],
    meta: { species: "A,B", reaction: "A → B" },
  };
}

describe("solveNetwork — recycle loop convergence (analytic benchmark)", () => {
  it("converges the mixer flow to the fixed point of M = F0 + (1-α)·M²/(M+a)", () => {
    const alpha = 0.5;
    const F0 = 10;
    const a = aParam();

    // Independent solution by bisection on f(M) = M - F0 - (1-α)·M²/(M+a).
    const f = (M: number) => M - F0 - ((1 - alpha) * M * M) / (M + a);
    let lo = F0;
    let hi = F0 / alpha;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      if (f(lo) * f(mid) <= 0) hi = mid;
      else lo = mid;
    }
    const M = (lo + hi) / 2;

    const report = solveNetwork(recycleNetwork(alpha));
    expect(report.reconcilerDiagnostics.join(" ")).toMatch(/recycle loop converged/i);
    // Mixer outlet = its total inlet = M.
    expect(report.results["m1"].outletFlow).toBeCloseTo(M, 3);
    // CSTR outlet = M²/(M+a).
    expect(report.results["r1"].outletFlow).toBeCloseTo((M * M) / (M + a), 3);
    // Separator bottoms = (1-α)·M²/(M+a).
    expect(report.results["sep"].outletFlow).toBeCloseTo(((1 - alpha) * M * M) / (M + a), 3);
    expect(report.overallStatus).not.toBe("error");
  });

  it("is self-consistent after convergence (inlets equal upstream outlets)", () => {
    const report = solveNetwork(recycleNetwork(0.5));
    const F0 = 10;
    const mixerOut = report.results["m1"].outletFlow;
    const sepOut = report.results["sep"].outletFlow;
    const cstr = report.results["r1"];
    // Spec criterion: self-consistency within 1e-6 *relative* (the fixed-point
    // iteration stops at flowTolerance, so linked quantities agree to that order).
    expect(Math.abs(mixerOut - (F0 + sepOut))).toBeLessThan(1e-6 * mixerOut);
    // CSTR outlet == its inlet (mixer outlet) times (1 - X).
    expect(Math.abs(cstr.outletFlow - mixerOut * (1 - cstr.conversion))).toBeLessThan(
      1e-6 * mixerOut,
    );
  });
});

describe("solveNetwork — divergent loop is flagged, not reported as truth", () => {
  it("flags non-convergence for a mixer loop with no consumption", () => {
    const net: ReactorNetwork = {
      nodes: [
        { id: "f1", type: "feed", label: "Feed", position: { x: 0, y: 0 }, params: { feedRate: 10 } },
        { id: "m1", type: "mixer", label: "Mixer-1", position: { x: 200, y: 0 }, params: {} },
        { id: "m2", type: "mixer", label: "Mixer-2", position: { x: 400, y: 0 }, params: {} },
      ],
      streams: [
        { id: "s1", source: "f1", target: "m1", flowRate: 10 },
        { id: "s2", source: "m1", target: "m2", flowRate: 5 },
        { id: "s3", source: "m2", target: "m1", flowRate: 5 },
      ],
      meta: { species: "A,B", reaction: "A → B" },
    };
    const report = solveNetwork(net);
    expect(report.reconcilerDiagnostics.join(" ")).toMatch(/did not converge/i);
    expect(report.overallStatus).toBe("error");
    expect(report.results["m1"].status).toBe("error");
    expect(report.results["m1"].converged).toBe(false);
  });
});

describe("solveNetwork — acyclic networks take the fast path", () => {
  it("emits no recycle diagnostics for a series network", () => {
    const net: ReactorNetwork = {
      nodes: [
        { id: "f1", type: "feed", label: "Feed", position: { x: 0, y: 0 }, params: { feedRate: 10 } },
        { id: "r1", type: "cstr", label: "CSTR-1", position: { x: 300, y: 0 }, params: { ...REACTOR_PARAMS } },
        { id: "p1", type: "product", label: "Product", position: { x: 600, y: 0 }, params: {} },
      ],
      streams: [
        { id: "s1", source: "f1", target: "r1", flowRate: 10 },
        { id: "s2", source: "r1", target: "p1", flowRate: 10 },
      ],
      meta: { species: "A,B", reaction: "A → B" },
    };
    const report = solveNetwork(net);
    expect(report.reconcilerDiagnostics.join(" ")).not.toMatch(/recycle/i);
  });
});
