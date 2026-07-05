/**
 * Verified PFR Solver
 * ---------------------------------------------------------------
 * Plug-flow reactor with first-order kinetics, integrated with a
 * classic 4th-order Runge–Kutta scheme over the reactor volume.
 *
 * mole balance:  dX/dV = -rA / F_A0
 * with  -rA = k(T) * CA0 * (1 - X)      and   F_A0 = v0 * CA0
 *
 * The profile (X vs V) is returned so the Deep Dive overlay can plot
 * the axial conversion/temperature profile. The reported "ODE residual"
 * is the local truncation error estimate between RK4 steps, which is the
 * standard convergence indicator for explicit integrators.
 */
import { rateConstant, adiabaticOutletTemperature } from "./kinetics";
import type { NodeParams, SolverResult } from "./types";

const STEPS = 120;

export function solvePFR(
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

  if (v0 <= 0) diagnostics.push("Volumetric flow <= 0: undefined residence time");
  if (CA0 <= 0) diagnostics.push("Inlet concentration <= 0: no reactant to convert");
  if (volume <= 0) diagnostics.push("Volume <= 0: non-physical reactor");

  const k = rateConstant(A, Ea, temperature);
  const F_A0 = v0 * CA0;

  // Generalized n-th order: dX/dV = k * CA0^n * (1-X)^n / F_A0
  // For n=1 this reduces to k*(1-X)/v0 (since F_A0 = v0*CA0).
  const dXdV = (X: number) => {
    if (v0 <= 0 || F_A0 <= 0) return 0;
    const CA = CA0 * (1 - X);
    return (k * Math.pow(CA, order)) / F_A0;
  };

  let X = 0;
  const profile: SolverResult["profile"] = [];
  let maxLocalError = 0;
  const dV = volume / STEPS;

  for (let i = 0; i <= STEPS; i++) {
    const V = i * dV;
    const T = adiabaticOutletTemperature(temperature, X);
    profile.push({ position: V, conversion: X, temperature: T });

    if (i === STEPS) break;

    // RK4 step
    const k1 = dXdV(X);
    const k2 = dXdV(X + (dV * k1) / 2);
    const k3 = dXdV(X + (dV * k2) / 2);
    const k4 = dXdV(X + dV * k3);
    const Xnew = X + (dV / 6) * (k1 + 2 * k2 + 2 * k3 + k4);

    // Local error estimate: compare RK4 step against a half-step double
    // (Richardson-style truncation probe) — kept lightweight.
    const halfStep = dV / 2;
    const h1 = dXdV(X);
    const h2 = dXdV(X + (halfStep * h1) / 2);
    const h3 = dXdV(X + (halfStep * h2) / 2);
    const h4 = dXdV(X + halfStep * h3);
    const Xhalf = X + (halfStep / 6) * (h1 + 2 * h2 + 2 * h3 + h4);
    const h5 = dXdV(Xhalf);
    const h6 = dXdV(Xhalf + (halfStep * h5) / 2);
    const h7 = dXdV(Xhalf + (halfStep * h6) / 2);
    const h8 = dXdV(Xhalf + halfStep * h7);
    const Xdbl = Xhalf + (halfStep / 6) * (h5 + 2 * h6 + 2 * h7 + h8);
    maxLocalError = Math.max(maxLocalError, Math.abs(Xdbl - Xnew));

    X = Math.max(0, Math.min(1, Xnew));
  }

  const conversion = X;
  const tau = v0 > 0 ? volume / v0 : 0;
  const outletTemperature = adiabaticOutletTemperature(temperature, conversion);
  const outletFlow = Math.max(0, params.feedRate * (1 - conversion));

  let status: SolverResult["status"] = "nominal";
  if (!Number.isFinite(conversion) || Number.isNaN(conversion)) {
    status = "error";
    diagnostics.push("Integration diverged: convergence error");
  } else if (tau > 0 && tau < 0.5) {
    status = "warning";
    diagnostics.push(`Residence time too low (τ=${tau.toFixed(2)} s)`);
  } else if (maxLocalError > 1e-3) {
    status = "warning";
    diagnostics.push("ODE truncation residual exceeds tolerance");
  }

  return {
    nodeId,
    converged: status !== "error",
    conversion,
    residenceTime: tau,
    outletTemperature,
    outletFlow,
    rateConstant: k,
    residual: maxLocalError,
    profile,
    diagnostics,
    status,
  };
}
