import { describe, expect, it } from "vitest";
import { optimizeReactor } from "@/lib/solvers/optimizer";
import type { NetworkNode } from "@/lib/solvers/types";

const cstrNode: NetworkNode = {
  id: "r1",
  type: "cstr",
  label: "CSTR-1",
  position: { x: 0, y: 0 },
  params: { inletConcentration: 5, volumetricFlow: 2, feedRate: 10, reactionOrder: 1 },
};

describe("optimizeReactor — first-order CSTR grid search", () => {
  it("finds the optimum at max volume + max temperature (monotonic surface)", () => {
    const result = optimizeReactor(cstrNode, [1, 5], [320, 400], 4);
    expect(result.optimal.volume).toBeCloseTo(5, 9);
    expect(result.optimal.temperature).toBeCloseTo(400, 9);
    expect(result.evaluations).toBe(25); // (4+1)^2
  });

  it("surface dimensions match the grid", () => {
    const result = optimizeReactor(cstrNode, [1, 5], [320, 400], 4);
    expect(result.volumes).toHaveLength(5);
    expect(result.temperatures).toHaveLength(5);
    expect(result.surface).toHaveLength(5);
    expect(result.surface[0]).toHaveLength(5);
  });

  it("temperature dominates sensitivity for Arrhenius kinetics in this range", () => {
    const result = optimizeReactor(cstrNode, [1, 5], [320, 400], 8);
    expect(result.sensitivity.dominant).toBe("temperature");
  });
});
