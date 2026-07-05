/**
 * Reaction Kinetics
 * ---------------------------------------------------------------
 * Irreversible, liquid-phase kinetics with arbitrary reaction order:
 *     A -> products
 * Rate constant follows the Arrhenius equation:
 *     k(T) = A * exp(-Ea / (R * T))
 * Rate law (n-th order w.r.t. A):
 *     -rA = k * CA^n
 *
 * For n=1 this reduces to the classic first-order law. For n≠1 the
 * CSTR design equation requires numerical root-finding (see cstr.ts).
 *
 * For the exothermic reaction we apply a lumped adiabatic temperature
 * rise so the solver can report an outlet temperature without
 * requiring a full energy balance solve.
 */
import { R_GAS } from "./types";

/** Arrhenius rate constant [1/s]. Returns 0 for non-physical T. */
export function rateConstant(
  preExponential: number,
  activationEnergy: number,
  temperature: number,
): number {
  if (!Number.isFinite(temperature) || temperature <= 0) return 0;
  if (!Number.isFinite(preExponential) || preExponential <= 0) return 0;
  return preExponential * Math.exp(-activationEnergy / (R_GAS * temperature));
}

/**
 * Rate of disappearance of A: -rA = k * CA^n  [mol/(m³·s)].
 * CA is the local concentration of A [mol/m³], n is the reaction order.
 */
export function rateOfDisappearance(
  k: number,
  CA: number,
  order: number,
): number {
  if (CA <= 0) return 0;
  return k * Math.pow(CA, order);
}

/** Adiabatic outlet temperature for a given conversion (lumped model). */
export function adiabaticOutletTemperature(
  inletTemperature: number,
  conversion: number,
  /** dT per unit conversion [K], exotherm > 0. */
  adiabaticRise = 45,
): number {
  const x = Math.max(0, Math.min(1, conversion));
  return inletTemperature + adiabaticRise * x;
}

/**
 * Damköhler number for a first-order reaction in a flow reactor.
 * Da = k * tau, where tau = V / v0. (First-order only; for n≠1 the
 * CSTR solver uses a generalized design equation.)
 */
export function damkohler(
  k: number,
  volume: number,
  volumetricFlow: number,
): number {
  if (volumetricFlow <= 0) return 0;
  return (k * volume) / volumetricFlow;
}
