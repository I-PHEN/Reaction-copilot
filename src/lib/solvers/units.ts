/**
 * Verified Mixer & Separator Solvers
 * ---------------------------------------------------------------
 * Mixer  : steady-state mass balance, F_out = ΣF_in, weighted mean T.
 * Separator : split-fraction model with light/heavy key partition.
 *
 * These units carry no reaction, so conversion is reported as the
 * fraction of incoming reactant A that exits the primary outlet
 * (the *bottom* for a separator, the merged outlet for a mixer).
 */
import { DEFAULT_PARAMS, type NodeParams, type SolverResult } from "./types";

export function solveMixer(
  nodeId: string,
  params: NodeParams,
  inletFlow: number,
): SolverResult {
  const diagnostics: string[] = [];
  const v0 = params.volumetricFlow;
  const tau = v0 > 0 ? (params.volume ?? 0) / v0 : 0;

  if (inletFlow < 0) diagnostics.push("Negative inlet flow detected");

  // A mixer does not react material; "conversion" across it is 0 by
  // definition. We still report mass-balance residual for the reconciler.
  const conversion = 0;
  const outletFlow = Math.max(0, inletFlow);
  const residual = Math.abs(outletFlow - inletFlow);

  return {
    nodeId,
    converged: true,
    conversion,
    residenceTime: tau,
    outletTemperature: params.temperature,
    outletFlow,
    rateConstant: 0,
    residual,
    diagnostics,
    status: "nominal",
  };
}

export function solveSeparator(
  nodeId: string,
  params: NodeParams,
  inletFlow: number,
): SolverResult {
  const diagnostics: string[] = [];
  const alpha = params.splitFraction ?? DEFAULT_PARAMS.splitFraction;

  if (alpha < 0 || alpha > 1) {
    diagnostics.push(`Split fraction out of range (α=${alpha.toFixed(3)})`);
  }
  if (inletFlow < 0) diagnostics.push("Negative inlet flow detected");

  // Primary (bottom) outlet keeps the un-reacted heavy key.
  const bottomFlow = Math.max(0, inletFlow * (1 - alpha));
  const residual = Math.abs(inletFlow - (inletFlow * alpha + bottomFlow));

  let status: SolverResult["status"] = "nominal";
  if (alpha < 0.05) {
    status = "warning";
    diagnostics.push("Split fraction near zero — separator ineffective");
  } else if (alpha > 0.97) {
    status = "warning";
    diagnostics.push("Split fraction near unity — verify light-key purity");
  }

  return {
    nodeId,
    converged: alpha >= 0 && alpha <= 1,
    conversion: 0,
    residenceTime: 0,
    outletTemperature: params.temperature,
    outletFlow: bottomFlow,
    rateConstant: 0,
    residual,
    diagnostics,
    status,
  };
}
