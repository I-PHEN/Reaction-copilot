import { describe, expect, it } from "vitest";
import { rateConstant } from "@/lib/solvers/kinetics";
import { solvePFR } from "@/lib/solvers/pfr";
import { DEFAULT_PARAMS, type NodeParams } from "@/lib/solvers/types";

function params(overrides: Partial<NodeParams> = {}): NodeParams {
  return {
    ...DEFAULT_PARAMS,
    volume: 2,
    temperature: 380,
    inletConcentration: 5,
    volumetricFlow: 2,
    feedRate: 10,
    reactionOrder: 1,
    ...overrides,
  };
}

describe("solvePFR — first order RK4 vs exact", () => {
  it("matches X = 1 - exp(-k*tau) to 1e-4", () => {
    const p = params();
    const k = rateConstant(p.preExponential, p.activationEnergy, p.temperature);
    const tau = p.volume / p.volumetricFlow;
    const exact = 1 - Math.exp(-k * tau);
    const r = solvePFR("n1", p);
    expect(r.converged).toBe(true);
    expect(Math.abs(r.conversion - exact)).toBeLessThan(1e-4);
  });

  it("PFR beats CSTR conversion at identical conditions (first order)", async () => {
    const { solveCSTR } = await import("@/lib/solvers/cstr");
    const p = params();
    expect(solvePFR("n1", p).conversion).toBeGreaterThan(
      solveCSTR("n1", p).conversion,
    );
  });

  it("returns a monotonically non-decreasing profile spanning the volume", () => {
    const r = solvePFR("n1", params());
    expect(r.profile).toBeDefined();
    const conv = r.profile!.map((pt) => pt.conversion);
    for (let i = 1; i < conv.length; i++) {
      expect(conv[i]).toBeGreaterThanOrEqual(conv[i - 1] - 1e-12);
    }
    expect(r.profile![0].position).toBe(0);
    expect(r.profile![r.profile!.length - 1].position).toBeCloseTo(2, 9);
  });
});

describe("solvePFR — n-th order sanity", () => {
  it("second order stays physical and converged", () => {
    const r2 = solvePFR("n1", params({ reactionOrder: 2 }));
    expect(r2.converged).toBe(true);
    expect(r2.conversion).toBeGreaterThan(0);
    expect(r2.conversion).toBeLessThan(1);
  });
  it("zero flow yields zero conversion, no NaN", () => {
    const r = solvePFR("n1", params({ volumetricFlow: 0 }));
    expect(Number.isFinite(r.conversion)).toBe(true);
    expect(r.conversion).toBe(0);
  });
});
