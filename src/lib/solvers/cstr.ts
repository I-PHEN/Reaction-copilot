/**
 * Verified CSTR Solver (generalized for arbitrary reaction order)
 * ---------------------------------------------------------------
 * Isothermal-to-adiabatic CSTR with n-th order kinetics:
 *     -rA = k * CA^n
 *
 * Design equation (Levenspiel form):
 *     V = F_A0 * X / (-rA(X))
 *   where -rA(X) = k * CA0^n * (1 - X)^n   and   F_A0 = v0 * CA0
 *
 * For n=1 (first-order): analytic solution  X = Da / (1 + Da).
 * For n≠1: Newton-Raphson root-finding on f(X) = V·k·CA0^n·(1-X)^n - F_A0·X = 0.
 *
 * The solver verifies convergence by recomputing the residual
 * |V_design - V_required| and reporting it.
 */
import { rateConstant, adiabaticOutletTemperature, damkohler } from "./kinetics";
import type { NodeParams, SolverResult } from "./types";

/**
 * Newton-Raphson root-finding for the CSTR design equation.
 * Solves f(X) = V * k * CA0^n * (1-X)^n - F_A0 * X = 0.
 * f'(X) = -n * V * k * CA0^n * (1-X)^(n-1) - F_A0.
 */
function solveCSTRConversion(
  k: number,
  CA0: number,
  n: number,
  volume: number,
  feedRate: number,
): { conversion: number; iterations: number; converged: boolean } {
  // For n=1, use the analytic solution.
  if (Math.abs(n - 1) < 1e-9) {
    // Da = k*V*CA0/F_A0 = k*tau (since F_A0 = v0*CA0) ⇒ X = Da/(1+Da).
    const Da = k * volume * CA0 / (feedRate > 0 ? feedRate : 1);
    const x = Da / (1 + Da);
    return { conversion: x, iterations: 0, converged: Number.isFinite(x) };
  }

  // Newton-Raphson for n≠1.
  let X = 0.3; // initial guess
  let converged = false;
  let iterations = 0;
  for (iterations = 0; iterations < 100; iterations++) {
    const oneMinusX = 1 - X;
    if (oneMinusX <= 0) { X = 0.999; break; }
    const rA = k * Math.pow(CA0 * oneMinusX, n);
    const f = volume * rA - feedRate * X;
    const df = -n * volume * k * Math.pow(CA0, n) * Math.pow(oneMinusX, n - 1) - feedRate;
    if (Math.abs(df) < 1e-15) break;
    const dX = f / df;
    X = X - dX;
    if (X < 0) X = 0;
    if (X > 0.9999) X = 0.9999;
    if (Math.abs(dX) < 1e-8) { converged = true; break; }
  }
  if (!converged && iterations >= 100) {
    // Check if we're close enough
    const rA = k * Math.pow(CA0 * (1 - X), n);
    const f = volume * rA - feedRate * X;
    converged = Math.abs(f) < 1e-6;
  }
  return { conversion: X, iterations, converged };
}

export function solveCSTR(
  nodeId: string,
  params: NodeParams,
): SolverResult {
  const diagnostics: string[] = [];
  const {
    volume,
    temperature,
    inletConcentration: CA0,
    volumetricFlow: v0,
    preExponential: A,
    activationEnergy: Ea,
    reactionOrder: n,
  } = params;

  const order = n ?? 1;

  // ---- Guard clauses for physical sanity -------------------------------
  if (v0 <= 0) {
    diagnostics.push("Volumetric flow <= 0: undefined residence time");
  }
  if (CA0 <= 0) {
    diagnostics.push("Inlet concentration <= 0: no reactant to convert");
  }
  if (volume <= 0) {
    diagnostics.push("Volume <= 0: non-physical reactor");
  }
  if (temperature <= 0 || temperature > 2000) {
    diagnostics.push("Temperature out of credible range (0–2000 K)");
  }

  const k = rateConstant(A, Ea, temperature);
  const tau = v0 > 0 ? volume / v0 : 0;

  // Solve for conversion (analytic for n=1, Newton-Raphson for n≠1).
  const { conversion, iterations, converged: nrConverged } = solveCSTRConversion(
    k, CA0, order, volume, params.feedRate,
  );
  const Da = damkohler(k, volume, v0); // first-order Da (for reporting)

  // Numerical verification: recompute V from the design equation and
  // compare with the declared volume. Residual has units of m^3.
  let residual = 0;
  if (conversion > 0 && conversion < 1 && k > 0 && CA0 > 0) {
    const rA = k * Math.pow(CA0 * (1 - conversion), order);
    const vRequired = (params.feedRate * conversion) / rA;
    residual = Math.abs(vRequired - volume);
  }

  const outletTemperature = adiabaticOutletTemperature(temperature, conversion);
  const outletFlow = Math.max(0, params.feedRate * (1 - conversion));

  // ---- Status classification ------------------------------------------
  let status: SolverResult["status"] = "nominal";
  if (!Number.isFinite(conversion) || Number.isNaN(conversion)) {
    status = "error";
    diagnostics.push("Conversion diverged: convergence error");
  } else if (!nrConverged && order !== 1) {
    status = "error";
    diagnostics.push(`Newton-Raphson did not converge in ${iterations} iterations`);
  } else if (tau > 0 && tau < 0.5) {
    status = "warning";
    diagnostics.push(`Residence time too low (τ=${tau.toFixed(2)} s)`);
  } else if (conversion > 0.99) {
    status = "warning";
    diagnostics.push("Near-complete conversion — verify downstream capacity");
  }
  if (residual > volume * 0.1 + 1e-6) {
    status = status === "nominal" ? "warning" : status;
    diagnostics.push("Design equation residual exceeds 10% of volume");
  }

  return {
    nodeId,
    converged: status !== "error",
    conversion,
    residenceTime: tau,
    outletTemperature,
    outletFlow,
    rateConstant: k,
    residual,
    diagnostics,
    status,
  };
}
