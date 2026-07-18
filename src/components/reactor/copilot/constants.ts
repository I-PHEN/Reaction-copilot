import { FlaskConical, Gauge, Recycle, Zap } from "lucide-react";
import type { ReactorNetwork } from "@/lib/solvers";

export const QUICK_ACTIONS = [
  { id: "optimize-yield", label: "Optimize yield", icon: Zap, prompt: "Optimize this network for maximum yield of B. Increase reactor volumes and temperature within safe limits to push conversion above 90%, and verify the kinetic model still converges." },
  { id: "add-recycle", label: "Add recycle", icon: Recycle, prompt: "Add a recycle loop from the separator back to the first reactor to recover unreacted A and improve overall conversion. Include a mixer before the first reactor." },
  { id: "two-stage", label: "2-stage train", icon: Gauge, prompt: "Design a two-stage reactor train: a CSTR followed by a PFR in series, with a feed of A at 10 mol/s, CA0 5 mol/m3, v0 2 m3/s, targeting 95% conversion of the first-order reaction A -> B." },
  { id: "separation", label: "Separation", icon: FlaskConical, prompt: "Add a separator after the reactor train to split product B from unreacted A, with a light-key split fraction of 0.9, followed by a product stream." },
];

export const EXAMPLE_PROMPTS = [
  "Design a 3-CSTR cascade for 99% conversion of A → B",
  "Compare CSTR vs PFR for the same reactor volume",
  "Add a separator and recycle loop to maximize yield",
  "Design a PFR train targeting 95% conversion at 380 K",
];

export interface CopilotResponse {
  mode?: "multi" | "analyze" | "generate" | "optimize";
  message: string;
  reasoning: string[];
  topology: ReactorNetwork | null;
  candidates?: { label: string; rationale: string; topology: ReactorNetwork }[];
  optimize?: {
    nodeId: string;
    objective: string;
    volumeRange: [number, number];
    temperatureRange: [number, number];
  };
}
