import { describe, expect, it } from "vitest";
import { solveCSTR } from "@/lib/solvers/cstr";
import { rateConstant } from "@/lib/solvers/kinetics";
import { DEFAULT_PARAMS, type NodeParams } from "@/lib/solvers/types";

/** Consistent params: feedRate = v0 * CA0 so Da = k*tau exactly. */
function params(overrides: Partial<NodeParams> = {}): NodeParams {
  return {
    ...DEFAULT_PARAMS,
    volume: 2,
    temperature: 380,
    inletConcentration: 5,
    volumetricFlow: 2,
    feedRate: 10, // = v0 * CA0
    reactionOrder: 1,
    ...overrides,
  };
}

describe("solveCSTR — first order (analytic)", () => {
  it("matches X = Da/(1+Da)", () => {
    const p = params();
    const k = rateConstant(p.preExponential, p.activationEnergy, p.temperature);
    const tau = p.volume / p.volumetricFlow; // 1 s
    const Da = k * tau;
    const expected = Da / (1 + Da);
    const r = solveCSTR("n1", p);
    expect(r.converged).toBe(true);
    expect(r.conversion).toBeCloseTo(expected, 6);
    expect(r.residenceTime).toBeCloseTo(tau, 9);
    expect(r.outletFlow).toBeCloseTo(p.feedRate * (1 - expected), 6);
  });

  it("conversion increases with volume", () => {
    const x1 = solveCSTR("n1", params({ volume: 1 })).conversion;
    const x2 = solveCSTR("n1", params({ volume: 4 })).conversion;
    expect(x2).toBeGreaterThan(x1);
  });
});

describe("solveCSTR — second order (Newton-Raphson vs closed form)", () => {
  it("matches the quadratic closed-form solution", () => {
    // Design eq (n=2): k*CA0*tau*(1-X)^2 = X, let a = k*CA0*tau
    // => a X^2 - (2a+1) X + a = 0 => X = [(2a+1) - sqrt((2a+1)^2 - 4a^2)] / (2a)
    const p = params({ reactionOrder: 2, temperature: 350 });
    const k = rateConstant(p.preExponential, p.activationEnergy, p.temperature);
    const tau = p.volume / p.volumetricFlow;
    const a = k * p.inletConcentration * tau;
    const expected =
      (2 * a + 1 - Math.sqrt((2 * a + 1) ** 2 - 4 * a * a)) / (2 * a);
    const r = solveCSTR("n1", p);
    expect(r.converged).toBe(true);
    expect(r.conversion).toBeCloseTo(expected, 5);
  });

  it("converges for fractional order n=1.5", () => {
    const r = solveCSTR("n1", params({ reactionOrder: 1.5 }));
    expect(r.converged).toBe(true);
    expect(r.conversion).toBeGreaterThan(0);
    expect(r.conversion).toBeLessThan(1);
  });
});

describe("solveCSTR — guard rails", () => {
  it("flags non-physical volumetric flow", () => {
    const r = solveCSTR("n1", params({ volumetricFlow: 0 }));
    expect(r.diagnostics.join(" ")).toMatch(/Volumetric flow/i);
  });
  it("never returns NaN conversion for zero concentration", () => {
    const r = solveCSTR("n1", params({ inletConcentration: 0 }));
    expect(Number.isFinite(r.conversion)).toBe(true);
  });
});
