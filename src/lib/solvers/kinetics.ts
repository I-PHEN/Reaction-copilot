/**
 * Reaction Kinetics
 * ---------------------------------------------------------------
 * First-order, irreversible, liquid-phase kinetics:  A -> products
 * Rate constant follows the Arrhenius equation:
 *     k(T) = A * exp(-Ea / (R * T))
 * Rate law:  -rA = k * CA
 *
 * For the exothermic reaction we apply a lumped adiabatic temperature
 * rise so the solver can report an outlet temperature without
 * requiring a full energy balance solve. This keeps the verified
 * solver self-contained and deterministic.
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
 * Da = k * tau, where tau = V / v0.
 */
export function damkohler(
  k: number,
  volume: number,
  volumetricFlow: number,
): number {
  if (volumetricFlow <= 0) return 0;
  return (k * volume) / volumetricFlow;
}
