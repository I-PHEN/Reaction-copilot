/**
 * Reactor Network Topology Schema
 * ---------------------------------------------------------------
 * The entire network topology (node connections and types) is
 * serializable into this JSON schema. This is the single source of
 * truth shared between the canvas, the copilot, and the solver layer.
 */

export type NodeType =
  | "feed"
  | "cstr"
  | "pfr"
  | "mixer"
  | "separator"
  | "product";

/** Physical / operating parameters bound to each unit. */
export interface NodeParams {
  /** Reactor volume [m^3] (CSTR / PFR). */
  volume: number;
  /** Operating temperature [K]. */
  temperature: number;
  /** Inlet molar flow of reactant A [mol/s]. */
  feedRate: number;
  /** Inlet concentration of A [mol/m^3]. */
  inletConcentration: number;
  /** Volumetric flow rate [m^3/s]. */
  volumetricFlow: number;
  /** Separator light-key split fraction [0..1]. */
  splitFraction: number;
  /** Pre-exponential factor for Arrhenius k [1/s]. */
  preExponential: number;
  /** Activation energy [J/mol]. */
  activationEnergy: number;
}

export interface NetworkNode {
  id: string;
  type: NodeType;
  label: string;
  position: { x: number; y: number };
  params: Partial<NodeParams>;
}

export interface Stream {
  id: string;
  source: string;
  target: string;
  /** Mass / molar flow carried by this stream [mol/s]. */
  flowRate: number;
}

export interface ReactorNetwork {
  nodes: NetworkNode[];
  streams: Stream[];
  meta: {
    species: string;
    reaction: string;
  };
}

/** Result returned by the verified solver for a single unit. */
export interface SolverResult {
  nodeId: string;
  converged: boolean;
  /** Fractional conversion of key reactant [0..1]. */
  conversion: number;
  /** Residence time [s]. */
  residenceTime: number;
  /** Outlet temperature [K]. */
  outletTemperature: number;
  /** Outlet molar flow of reactant A [mol/s]. */
  outletFlow: number;
  /** Rate constant evaluated at operating T [1/s]. */
  rateConstant: number;
  /** Max ODE residual (PFR) or mass-balance residual (others). */
  residual: number;
  /** Per-step profile for PFR (conversion vs position). */
  profile?: Array<{ position: number; conversion: number; temperature: number }>;
  /** Diagnostic messages from the reconciler. */
  diagnostics: string[];
  /** Status used for color-coding: nominal | warning | error. */
  status: "nominal" | "warning" | "error";
}

export interface SolverReport {
  results: Record<string, SolverResult>;
  network: ReactorNetwork;
  /** Topology-level diagnostics produced by the reconciler. */
  reconcilerDiagnostics: string[];
  overallStatus: "nominal" | "warning" | "error";
}

export const DEFAULT_PARAMS: NodeParams = {
  volume: 2.0,
  temperature: 350,
  feedRate: 10,
  inletConcentration: 5,
  volumetricFlow: 2,
  splitFraction: 0.85,
  preExponential: 1.2e10,
  activationEnergy: 72000,
};

/** Universal gas constant [J/(mol·K)]. */
export const R_GAS = 8.314;
