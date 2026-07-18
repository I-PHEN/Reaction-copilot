import { describe, expect, it } from "vitest";
import { solveNetwork } from "@/lib/solvers/orchestrator";
import type { ReactorNetwork } from "@/lib/solvers/types";

function seriesNetwork(): ReactorNetwork {
  return {
    nodes: [
      { id: "f1", type: "feed", label: "Feed", position: { x: 0, y: 0 }, params: { feedRate: 10, temperature: 350 } },
      { id: "r1", type: "cstr", label: "CSTR-1", position: { x: 300, y: 0 }, params: { volume: 2, temperature: 380, feedRate: 10, inletConcentration: 5, volumetricFlow: 2 } },
      { id: "p1", type: "product", label: "Product", position: { x: 600, y: 0 }, params: {} },
    ],
    streams: [
      { id: "s1", source: "f1", target: "r1", flowRate: 10 },
      { id: "s2", source: "r1", target: "p1", flowRate: 10 },
    ],
    meta: { species: "A,B", reaction: "A → B" },
  };
}

describe("solveNetwork — series flow propagation", () => {
  it("solves every node and propagates reactant flow to the product", () => {
    const report = solveNetwork(seriesNetwork());
    expect(Object.keys(report.results)).toHaveLength(3);
    const cstr = report.results["r1"];
    const product = report.results["p1"];
    expect(cstr.conversion).toBeGreaterThan(0);
    expect(product.outletFlow).toBeCloseTo(10 * (1 - cstr.conversion), 6);
    expect(report.overallStatus).not.toBe("error");
  });

  it("feed nodes pass feedRate through", () => {
    const report = solveNetwork(seriesNetwork());
    expect(report.results["f1"].outletFlow).toBe(10);
  });
});

describe("solveNetwork — reconciler", () => {
  it("flags an unfed reactor", () => {
    const net = seriesNetwork();
    net.streams = net.streams.filter((s) => s.id !== "s1"); // sever feed→cstr
    const report = solveNetwork(net);
    expect(report.reconcilerDiagnostics.join(" ")).toMatch(/unfed/i);
    expect(report.overallStatus).not.toBe("nominal");
  });

  it("flags a feed with no outlet and an unreachable product", () => {
    const net = seriesNetwork();
    net.streams = [];
    const report = solveNetwork(net);
    const joined = report.reconcilerDiagnostics.join(" ");
    expect(joined).toMatch(/feed node has no outgoing stream/i);
    expect(joined).toMatch(/unreachable/i);
  });

  it("still solves every node when the graph contains a cycle (recycle fallback)", () => {
    const net = seriesNetwork();
    net.nodes.push({ id: "m1", type: "mixer", label: "Mixer", position: { x: 150, y: 100 }, params: {} });
    net.streams.push(
      { id: "s3", source: "r1", target: "m1", flowRate: 2 },
      { id: "s4", source: "m1", target: "r1", flowRate: 2 },
    );
    const report = solveNetwork(net);
    expect(Object.keys(report.results)).toHaveLength(4);
  });
});
