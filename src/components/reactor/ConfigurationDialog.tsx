"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Beaker, Thermometer, Gauge, Zap } from "lucide-react";
import { useTopology } from "@/lib/store/topology";
import { DEFAULT_PARAMS, type NetworkNode } from "@/lib/solvers";

const REACTION_PRESETS = [
  { expr: "A → B", order: 1, label: "A → B  (1st order)" },
  { expr: "2A → B", order: 2, label: "2A → B  (2nd order)" },
  { expr: "A → products", order: 0, label: "A → products  (0th order)" },
  { expr: "3A → B", order: 3, label: "3A → B  (3rd order)" },
];

/** Inner form — remounts via key when the target node changes, so useState
 *  initializers read the node's current params without setState-in-effect. */
function ConfigForm({ node, onDismiss }: { node: NetworkNode; onDismiss: () => void }) {
  const updateNodeParams = useTopology((s) => s.updateNodeParams);
  const p = { ...DEFAULT_PARAMS, ...node.params };

  const [reactionExpression, setReactionExpression] = useState(p.reactionExpression ?? "A → B");
  const [reactionOrder, setReactionOrder] = useState(p.reactionOrder ?? 1);
  const [temperature, setTemperature] = useState(p.temperature);
  const [volume, setVolume] = useState(p.volume);
  const [preExponential, setPreExponential] = useState(p.preExponential);
  const [activationEnergy, setActivationEnergy] = useState(p.activationEnergy);

  const apply = () => {
    updateNodeParams(node.id, {
      reactionExpression,
      reactionOrder,
      temperature,
      volume,
      preExponential,
      activationEnergy,
    });
    onDismiss();
  };

  return (
    <DialogContent className="border-zinc-700 bg-zinc-900 text-zinc-100">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-sm">
          <Beaker className="h-4 w-4 text-cyan-400" />
          Configure {node.label}
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4 py-2">
        {/* Reaction */}
        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wider text-zinc-500">
            Reaction
          </Label>
          <div className="flex flex-wrap gap-1.5">
            {REACTION_PRESETS.map((preset) => (
              <button
                key={preset.expr}
                onClick={() => {
                  setReactionExpression(preset.expr);
                  setReactionOrder(preset.order);
                }}
                className={`rounded-md border px-2.5 py-1 text-[11px] font-mono transition-colors ${
                  reactionExpression === preset.expr
                    ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-300"
                    : "border-zinc-700 bg-zinc-950/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <Input
            value={reactionExpression}
            onChange={(e) => setReactionExpression(e.target.value)}
            className="mt-1 border-zinc-700 bg-zinc-950 font-mono text-sm text-zinc-100"
            placeholder="e.g. A → B"
          />
        </div>

        {/* Reaction order */}
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-zinc-500">
            <Zap className="h-3 w-3" /> Reaction order (n)
            <span className="ml-auto font-mono text-zinc-300">-rA = k·CA<sup>{reactionOrder}</sup></span>
          </Label>
          <Input
            type="number"
            step="0.5"
            min="0"
            max="5"
            value={reactionOrder}
            onChange={(e) => setReactionOrder(parseFloat(e.target.value) || 0)}
            className="border-zinc-700 bg-zinc-950 text-sm text-zinc-100"
          />
        </div>

        {/* Operating conditions */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-zinc-500">
              <Gauge className="h-3 w-3" /> Volume (m³)
            </Label>
            <Input
              type="number"
              step="0.1"
              min="0.1"
              max="20"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value) || 0)}
              className="border-zinc-700 bg-zinc-950 text-sm text-zinc-100"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-zinc-500">
              <Thermometer className="h-3 w-3" /> Temperature (K)
            </Label>
            <Input
              type="number"
              step="1"
              min="280"
              max="500"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value) || 0)}
              className="border-zinc-700 bg-zinc-950 text-sm text-zinc-100"
            />
          </div>
        </div>

        {/* Kinetics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-zinc-500">
              Pre-exponential A (1/s)
            </Label>
            <Input
              type="number"
              step="1e8"
              value={preExponential}
              onChange={(e) => setPreExponential(parseFloat(e.target.value) || 0)}
              className="border-zinc-700 bg-zinc-950 font-mono text-sm text-zinc-100"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-zinc-500">
              Activation energy Ea (J/mol)
            </Label>
            <Input
              type="number"
              step="1000"
              value={activationEnergy}
              onChange={(e) => setActivationEnergy(parseFloat(e.target.value) || 0)}
              className="border-zinc-700 bg-zinc-950 font-mono text-sm text-zinc-100"
            />
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={apply}
          className="bg-cyan-500 text-zinc-950 hover:bg-cyan-400"
        >
          Apply configuration
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export function ConfigurationDialog() {
  const pendingConfigNodeId = useTopology((s) => s.pendingConfigNodeId);
  const network = useTopology((s) => s.network);
  const dismissConfig = useTopology((s) => s.dismissConfig);

  const node = network.nodes.find((n) => n.id === pendingConfigNodeId) ?? null;
  const isOpen = !!node && (node.type === "cstr" || node.type === "pfr");

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && dismissConfig()}>
      {isOpen && node && <ConfigForm key={node.id} node={node} onDismiss={dismissConfig} />}
    </Dialog>
  );
}
