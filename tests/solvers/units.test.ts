import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS } from "@/lib/solvers/types";
import { solveMixer, solveSeparator } from "@/lib/solvers/units";

describe("solveMixer", () => {
  it("conserves molar flow", () => {
    const r = solveMixer("m1", DEFAULT_PARAMS, 7.3);
    expect(r.outletFlow).toBeCloseTo(7.3, 12);
    expect(r.residual).toBeCloseTo(0, 12);
    expect(r.conversion).toBe(0);
    expect(r.converged).toBe(true);
  });
  it("clamps negative inflow to zero outlet and flags it", () => {
    const r = solveMixer("m1", DEFAULT_PARAMS, -1);
    expect(r.outletFlow).toBe(0);
    expect(r.diagnostics.join(" ")).toMatch(/Negative inlet/i);
  });
});

describe("solveSeparator", () => {
  it("splits by (1 - alpha) to the bottom outlet", () => {
    const r = solveSeparator("s1", { ...DEFAULT_PARAMS, splitFraction: 0.85 }, 10);
    expect(r.outletFlow).toBeCloseTo(1.5, 9); // bottoms = 10 * (1 - 0.85)
    expect(r.converged).toBe(true);
  });
  it("conserves mass: overhead + bottoms = inlet", () => {
    const alpha = 0.6;
    const inlet = 8;
    const r = solveSeparator("s1", { ...DEFAULT_PARAMS, splitFraction: alpha }, inlet);
    const overhead = inlet * alpha;
    expect(overhead + r.outletFlow).toBeCloseTo(inlet, 9);
  });
  it("warns at extreme split fractions", () => {
    expect(
      solveSeparator("s1", { ...DEFAULT_PARAMS, splitFraction: 0.99 }, 10).status,
    ).toBe("warning");
    expect(
      solveSeparator("s1", { ...DEFAULT_PARAMS, splitFraction: 0.01 }, 10).status,
    ).toBe("warning");
  });
});
