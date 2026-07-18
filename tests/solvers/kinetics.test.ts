import { describe, expect, it } from "vitest";
import {
  adiabaticOutletTemperature,
  damkohler,
  rateConstant,
  rateOfDisappearance,
} from "@/lib/solvers/kinetics";

describe("rateConstant (Arrhenius)", () => {
  it("matches hand-computed k at T=350K for default params", () => {
    // k = 1.2e10 * exp(-72000 / (8.314 * 350)) ≈ 0.2155 1/s
    const k = rateConstant(1.2e10, 72000, 350);
    expect(k).toBeCloseTo(0.2155, 3);
  });

  it("increases monotonically with temperature", () => {
    const k1 = rateConstant(1.2e10, 72000, 320);
    const k2 = rateConstant(1.2e10, 72000, 360);
    const k3 = rateConstant(1.2e10, 72000, 400);
    expect(k2).toBeGreaterThan(k1);
    expect(k3).toBeGreaterThan(k2);
  });

  it("returns 0 for non-physical inputs", () => {
    expect(rateConstant(1.2e10, 72000, 0)).toBe(0);
    expect(rateConstant(1.2e10, 72000, -10)).toBe(0);
    expect(rateConstant(0, 72000, 350)).toBe(0);
    expect(rateConstant(1.2e10, 72000, NaN)).toBe(0);
  });
});

describe("rateOfDisappearance", () => {
  it("is k*CA for first order", () => {
    expect(rateOfDisappearance(0.5, 4, 1)).toBeCloseTo(2.0, 12);
  });
  it("is k*CA^2 for second order", () => {
    expect(rateOfDisappearance(0.5, 4, 2)).toBeCloseTo(8.0, 12);
  });
  it("is k (CA-independent) for zeroth order", () => {
    expect(rateOfDisappearance(0.5, 4, 0)).toBeCloseTo(0.5, 12);
  });
  it("returns 0 at zero or negative concentration", () => {
    expect(rateOfDisappearance(0.5, 0, 1)).toBe(0);
    expect(rateOfDisappearance(0.5, -1, 2)).toBe(0);
  });
});

describe("adiabaticOutletTemperature", () => {
  it("adds rise*conversion", () => {
    expect(adiabaticOutletTemperature(350, 0.5)).toBeCloseTo(372.5, 9);
  });
  it("clamps conversion to [0,1]", () => {
    expect(adiabaticOutletTemperature(350, 1.7)).toBeCloseTo(395, 9);
    expect(adiabaticOutletTemperature(350, -0.3)).toBeCloseTo(350, 9);
  });
});

describe("damkohler", () => {
  it("is k*V/v0", () => {
    expect(damkohler(0.5, 4, 2)).toBeCloseTo(1.0, 12);
  });
  it("returns 0 for zero flow", () => {
    expect(damkohler(0.5, 4, 0)).toBe(0);
  });
});
