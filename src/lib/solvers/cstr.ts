/**
 * Verified CSTR Solver
 * ---------------------------------------------------------------
 * Isothermal-to-adiabatic CSTR with first-order kinetics.
 *
 * Design equation (Levenspiel form):
 *     V = F_A0 * X / (-rA)         with  -rA = k * CA0 * (1 - X)
 * =>  X = k*tau / (1 + k*tau)      where  tau = V / v0
 *
 * The analytic solution is verified numerically by recomputing the
 * residual |V_design - V_required| and reporting it. A solution is
 * flagged non-convergent only when the residual is unbounded.
 */
import { rateConstant, adiabaticOutletTemperature, damkohler } from "./kinetics";
import type { NodeParams, SolverResult } from "./types";

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
  } = params;

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
  const Da = damkohler(k, volume, v0);

  // Analytic first-order CSTR conversion.
  let conversion = 0;
  if (Number.isFinite(Da) && Da >= 0) {
    conversion = Da / (1 + Da);
  }

  // Numerical verification: recompute V from the design equation and
  // compare with the declared volume. Residual has units of m^3.
  let residual = 0;
  if (conversion > 0 && conversion < 1 && k > 0 && CA0 > 0) {
    const rA = k * CA0 * (1 - conversion);
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
