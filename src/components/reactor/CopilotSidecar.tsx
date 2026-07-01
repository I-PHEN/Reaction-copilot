"use client";

import { useEffect, useRef, useState } from "react";
import {
  Send,
  Sparkles,
  Brain,
  Zap,
  Recycle,
  Gauge,
  FlaskConical,
  ChevronDown,
  Eraser,
} from "lucide-react";
import { useTopology } from "@/lib/store/topology";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import type { ReactorNetwork } from "@/lib/solvers";

const QUICK_ACTIONS = [
  { id: "optimize-yield", label: "Optimize yield", icon: Zap, prompt: "Optimize this network for maximum yield of B. Increase reactor volumes and temperature within safe limits to push conversion above 90%, and verify the kinetic model still converges." },
  { id: "add-recycle", label: "Add recycle", icon: Recycle, prompt: "Add a recycle loop from the separator back to the first reactor to recover unreacted A and improve overall conversion. Include a mixer before the first reactor." },
  { id: "two-stage", label: "2-stage train", icon: Gauge, prompt: "Design a two-stage reactor train: a CSTR followed by a PFR in series, with a feed of A at 10 mol/s, CA0 5 mol/m3, v0 2 m3/s, targeting 95% conversion of the first-order reaction A -> B." },
  { id: "separation", label: "Separation", icon: FlaskConical, prompt: "Add a separator after the reactor train to split product B from unreacted A, with a light-key split fraction of 0.9, followed by a product stream." },
];

interface CopilotResponse {
  message: string;
  reasoning: string[];
  topology: ReactorNetwork;
}

export function CopilotSidecar() {
  const [input, setInput] = useState("");
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const messages = useTopology((s) => s.copilotMessages);
  const reasoning = useTopology((s) => s.reasoning);
  const isGenerating = useTopology((s) => s.isGenerating);
  const pushMessage = useTopology((s) => s.pushMessage);
  const pushReasoning = useTopology((s) => s.pushReasoning);
  const clearReasoning = useTopology((s) => s.clearReasoning);
  const setGenerating = useTopology((s) => s.setGenerating);
  const setNetwork = useTopology((s) => s.setNetwork);
  const network = useTopology((s) => s.network);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const reasoningEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    reasoningEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [reasoning]);

  // Auto-expand the ticker while the copilot is actively reasoning.
  useEffect(() => {
    if (isGenerating) setReasoningOpen(true);
  }, [isGenerating]);

  const runPrompt = async (prompt: string) => {
    if (!prompt.trim() || isGenerating) return;
    setInput("");
    pushMessage({ role: "user", content: prompt });
    setGenerating(true);
    clearReasoning();
    pushReasoning("Parsing engineering intent…", "info");
    pushReasoning("Loading first-order Arrhenius kinetic model", "verify");

    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `${prompt}\n\n[Current topology for context: ${network.nodes.length} units, ${network.streams.length} streams. You may extend or replace it.]`,
        }),
      });
      if (!res.ok) throw new Error(`Copilot error ${res.status}`);
      const data = (await res.json()) as CopilotResponse;

      for (let i = 0; i < data.reasoning.length; i++) {
        const step = data.reasoning[i];
        const kind = /select|choose|cstr|pfr/i.test(step) ? "select" : /verify|check|converg|kinetic|constraint/i.test(step) ? "verify" : /layout|position|place|route/i.test(step) ? "layout" : "info";
        setTimeout(() => pushReasoning(step, kind), 280 * (i + 1));
      }

      setTimeout(() => {
        if (data.topology?.nodes?.length) {
          setNetwork(data.topology);
          pushReasoning("Topology committed · dispatching verified solvers", "info");
        }
        pushMessage({ role: "copilot", content: data.message });
        setGenerating(false);
      }, 280 * (data.reasoning.length + 1));
    } catch (e) {
      setGenerating(false);
      pushMessage({
        role: "copilot",
        content: "Could not reach the reasoning engine. The verified solver layer is still active — adjust parameters in the Deep Dive panel.",
      });
      toast.error("Copilot request failed", { description: (e as Error).message });
    }
  };

  const activeReasoning = isGenerating || reasoning.length > 0;

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      {/* Header — minimal */}
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800/80 px-4 py-2.5">
        <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
        <span className="text-[13px] font-medium text-zinc-200">Synthesis Copilot</span>
        <span className="ml-auto font-mono text-[10px] text-zinc-600">verified solvers</span>
      </div>

      {/* Quick actions — single compact row */}
      <div className="shrink-0 border-b border-zinc-800/80 px-3 py-2">
        <div className="eng-scroll flex gap-1.5 overflow-x-auto pb-0.5">
          {QUICK_ACTIONS.map((a) => (
            <button
              key={a.id}
              disabled={isGenerating}
              onClick={() => runPrompt(a.prompt)}
              className="flex shrink-0 items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/60 px-2.5 py-1 text-[11px] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200 disabled:opacity-40"
            >
              <a.icon className="h-3 w-3 text-cyan-500/70" />
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Reasoning ticker — collapsible */}
      <Collapsible open={reasoningOpen} onOpenChange={setReasoningOpen} className="shrink-0 border-b border-zinc-800/80">
        <CollapsibleTrigger className="flex w-full items-center gap-2 px-4 py-2 text-left transition-colors hover:bg-zinc-900/50">
          <Brain className={cn("h-3 w-3", activeReasoning ? "text-violet-400" : "text-zinc-600")} />
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Reasoning</span>
          {isGenerating && (
            <span className="flex gap-0.5">
              <span className="h-1 w-1 animate-pulse rounded-full bg-violet-400" />
              <span className="h-1 w-1 animate-pulse rounded-full bg-violet-400 [animation-delay:120ms]" />
              <span className="h-1 w-1 animate-pulse rounded-full bg-violet-400 [animation-delay:240ms]" />
            </span>
          )}
          {reasoning.length > 0 && !isGenerating && (
            <span className="font-mono text-[10px] text-zinc-600">{reasoning.length} steps</span>
          )}
          <ChevronDown className={cn("ml-auto h-3.5 w-3.5 text-zinc-600 transition-transform", reasoningOpen && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="eng-scroll max-h-32 overflow-y-auto px-4 pb-2">
            {reasoning.length === 0 ? (
              <div className="text-[11px] italic text-zinc-700">No active reasoning.</div>
            ) : (
              <div className="space-y-1">
                {reasoning.map((r) => (
                  <div key={r.id} className="flex items-start gap-1.5 text-[11px] leading-snug">
                    <span
                      className={cn(
                        "mt-1 h-1 w-1 shrink-0 rounded-full",
                        r.kind === "select" && "bg-cyan-400",
                        r.kind === "verify" && "bg-emerald-400",
                        r.kind === "layout" && "bg-violet-400",
                        r.kind === "info" && "bg-zinc-600",
                      )}
                    />
                    <span className="text-zinc-400">{r.text}</span>
                  </div>
                ))}
                <div ref={reasoningEndRef} />
              </div>
            )}
            {reasoning.length > 0 && (
              <button
                onClick={clearReasoning}
                className="mt-1.5 flex items-center gap-1 text-[9px] text-zinc-600 hover:text-zinc-400"
              >
                <Eraser className="h-2.5 w-2.5" /> clear
              </button>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Intent feed — the main flexible region */}
      <ScrollArea className="eng-scroll flex-1 px-4 py-3">
        <div className="space-y-2.5">
          {messages.map((m) => (
            <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[90%]", m.role === "user" ? "text-right" : "text-left")}>
                <div className="mb-0.5 font-mono text-[9px] uppercase tracking-wider text-zinc-700">
                  {m.role === "user" ? "you" : "copilot"}
                </div>
                <div
                  className={cn(
                    "rounded-lg px-2.5 py-1.5 text-[12px] leading-relaxed",
                    m.role === "user"
                      ? "bg-zinc-800 text-zinc-200"
                      : "bg-zinc-900 text-zinc-300",
                  )}
                >
                  {m.content}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input — minimal */}
      <div className="shrink-0 border-t border-zinc-800/80 p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runPrompt(input);
          }}
          className="flex items-center gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe a reactor network…"
            disabled={isGenerating}
            className="border-zinc-800 bg-zinc-900 text-sm text-zinc-200 placeholder:text-zinc-600 focus-visible:ring-cyan-500/30"
          />
          <Button
            type="submit"
            size="icon"
            disabled={isGenerating || !input.trim()}
            className="bg-cyan-500 text-zinc-950 hover:bg-cyan-400"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
