/**
 * Optimizer — parameter sweep over the verified solver.
 * ---------------------------------------------------------------
 * Given a reactor node + a parameter grid (volume × temperature),
 * runs the solver at every grid point and returns:
 *   - the full response surface (conversion at each V,T)
 *   - the optimal operating point (max conversion)
 *   - sensitivity: which parameter most affects the objective
 *
 * The LLM proposes the sweep ranges based on the user's goal; the
 * solver does all the math. No LLM-computed numbers reach the UI.
 */
import { DEFAULT_PARAMS, type NetworkNode, type SolverResult } from "./types";
import { solveCSTR } from "./cstr";
import { solvePFR } from "./pfr";

export interface OptimizationPoint {
  volume: number;
  temperature: number;
  conversion: number;
  residenceTime: number;
  rateConstant: number;
  status: SolverResult["status"];
}

export interface OptimizationResult {
  nodeId: string;
  nodeLabel: string;
  reactorType: "cstr" | "pfr";
  objective: string;
  /** Volume grid values [m³]. */
  volumes: number[];
  /** Temperature grid values [K]. */
  temperatures: number[];
  /** Response surface: surface[vIndex][tIndex] = OptimizationPoint. */
  surface: OptimizationPoint[][];
  /** The optimal point (max conversion). */
  optimal: OptimizationPoint;
  /** Sensitivity: which parameter has more effect on the objective. */
  sensitivity: {
    volume: number; // range of conversion across volume axis
    temperature: number; // range of conversion across temperature axis
    dominant: "volume" | "temperature" | "equal";
  };
  /** Total solver evaluations. */
  evaluations: number;
}

/**
 * Run a parameter sweep over volume × temperature for a reactor node.
 * Uses the verified CSTR or PFR solver at each grid point.
 */
export function optimizeReactor(
  node: NetworkNode,
  volumeRange: [number, number],
  temperatureRange: [number, number],
  gridSteps: number = 12,
  objective: string = "maximize conversion",
): OptimizationResult {
  const baseParams = { ...DEFAULT_PARAMS, ...node.params };
  const reactorType = node.type as "cstr" | "pfr";

  // Build the grid axes (linear spacing, inclusive).
  const volumes: number[] = [];
  const temperatures: number[] = [];
  const [vMin, vMax] = volumeRange;
  const [tMin, tMax] = temperatureRange;
  for (let i = 0; i <= gridSteps; i++) {
    volumes.push(vMin + ((vMax - vMin) * i) / gridSteps);
    temperatures.push(tMin + ((tMax - tMin) * i) / gridSteps);
  }

  // Run the solver at each grid point.
  const surface: OptimizationPoint[][] = [];
  let optimal: OptimizationPoint | null = null;
  let evaluations = 0;

  for (let vi = 0; vi < volumes.length; vi++) {
    surface[vi] = [];
    for (let ti = 0; ti < temperatures.length; ti++) {
      const params = {
        ...baseParams,
        volume: volumes[vi],
        temperature: temperatures[ti],
      };
      const result =
        reactorType === "cstr" ? solveCSTR(node.id, params) : solvePFR(node.id, params);
      evaluations++;

      const point: OptimizationPoint = {
        volume: volumes[vi],
        temperature: temperatures[ti],
        conversion: result.conversion,
        residenceTime: result.residenceTime,
        rateConstant: result.rateConstant,
        status: result.status,
      };
      surface[vi][ti] = point;

      if (!optimal || point.conversion > optimal.conversion) {
        optimal = point;
      }
    }
  }

  // Sensitivity: range of conversion across each axis at the midpoint
  // of the other axis.
  const midV = Math.floor(volumes.length / 2);
  const midT = Math.floor(temperatures.length / 2);
  const convAtMidV = surface[midV].map((p) => p.conversion);
  const convAtMidT = surface.map((row) => row[midT].conversion);
  const tempRange = Math.max(...convAtMidV) - Math.min(...convAtMidV);
  const volRange = Math.max(...convAtMidT) - Math.min(...convAtMidT);

  return {
    nodeId: node.id,
    nodeLabel: node.label,
    reactorType,
    objective,
    volumes,
    temperatures,
    surface,
    optimal: optimal!,
    sensitivity: {
      volume: volRange,
      temperature: tempRange,
      dominant:
        Math.abs(volRange - tempRange) < 0.01
          ? "equal"
          : volRange > tempRange
            ? "volume"
            : "temperature",
    },
    evaluations,
  };
}
