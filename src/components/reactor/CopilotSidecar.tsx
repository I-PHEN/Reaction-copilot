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
  Eraser,
  ChevronRight,
} from "lucide-react";
import { useTopology } from "@/lib/store/topology";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import type { ReactorNetwork } from "@/lib/solvers";

const QUICK_ACTIONS = [
  {
    id: "optimize-yield",
    label: "Optimize for yield",
    icon: Zap,
    prompt:
      "Optimize this network for maximum yield of B. Increase reactor volumes and temperature within safe limits to push conversion above 90%, and verify the kinetic model still converges.",
  },
  {
    id: "add-recycle",
    label: "Add recycle loop",
    icon: Recycle,
    prompt:
      "Add a recycle loop from the separator back to the first reactor to recover unreacted A and improve overall conversion. Include a mixer before the first reactor.",
  },
  {
    id: "two-stage",
    label: "2-stage CSTR+PFR",
    icon: Gauge,
    prompt:
      "Design a two-stage reactor train: a CSTR followed by a PFR in series, with a feed of A at 10 mol/s, CA0 5 mol/m3, v0 2 m3/s, targeting 95% conversion of the first-order reaction A -> B.",
  },
  {
    id: "separation",
    label: "Add separation train",
    icon: FlaskConical,
    prompt:
      "Add a separator after the reactor train to split product B from unreacted A, with a light-key split fraction of 0.9, followed by a product stream.",
  },
];

interface CopilotResponse {
  message: string;
  reasoning: string[];
  topology: ReactorNetwork;
}

export function CopilotSidecar() {
  const [input, setInput] = useState("");
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

      // Stream the reasoning steps into the ticker with a small stagger
      // so the user perceives the AI "thinking".
      for (let i = 0; i < data.reasoning.length; i++) {
        const step = data.reasoning[i];
        const kind = /select|choose|cstr|pfr/i.test(step)
          ? "select"
          : /verify|check|converg|kinetic|constraint/i.test(step)
            ? "verify"
            : /layout|position|place|route/i.test(step)
              ? "layout"
              : "info";
        // staggered push
        setTimeout(() => pushReasoning(step, kind), 280 * (i + 1));
      }

      // Apply topology after reasoning has begun streaming.
      setTimeout(() => {
        if (data.topology?.nodes?.length) {
          setNetwork(data.topology);
          pushReasoning("Topology committed to canvas · dispatching verified solvers", "info");
        }
        pushMessage({ role: "copilot", content: data.message });
        setGenerating(false);
      }, 280 * (data.reasoning.length + 1));
    } catch (e) {
      setGenerating(false);
      pushMessage({
        role: "copilot",
        content:
          "I could not reach the reasoning engine. The verified solver layer is still active — adjust parameters directly in the Deep Dive panel.",
      });
      toast.error("Copilot request failed", { description: (e as Error).message });
    }
  };

  return (
    <div className="flex h-full flex-col bg-slate-950/60">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-cyan-500/15">
          <Sparkles className="h-4 w-4 text-cyan-400" />
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-100">Synthesis Copilot</div>
          <div className="text-[10px] text-slate-500">Reactor engineering partner · grounded in verified solvers</div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="border-b border-slate-800 px-3 py-2.5">
        <div className="mb-1.5 text-[9px] uppercase tracking-wider text-slate-500">Quick Actions</div>
        <div className="grid grid-cols-2 gap-1.5">
          {QUICK_ACTIONS.map((a) => (
            <button
              key={a.id}
              disabled={isGenerating}
              onClick={() => runPrompt(a.prompt)}
              className="flex items-center gap-1.5 rounded-md border border-slate-700/60 bg-slate-900/60 px-2 py-1.5 text-left text-[11px] font-medium text-slate-300 transition-colors hover:border-cyan-500/40 hover:bg-slate-800/70 hover:text-cyan-200 disabled:opacity-40"
            >
              <a.icon className="h-3 w-3 shrink-0 text-cyan-400" />
              <span className="truncate">{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Reasoning Ticker */}
      <div className="border-b border-slate-800">
        <div className="flex items-center justify-between px-4 pt-2.5">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
            <Brain className="h-3 w-3 text-violet-400" />
            Reasoning Ticker
          </div>
          {reasoning.length > 0 && (
            <button
              onClick={clearReasoning}
              className="flex items-center gap-1 text-[9px] text-slate-500 hover:text-slate-300"
            >
              <Eraser className="h-2.5 w-2.5" /> clear
            </button>
          )}
        </div>
        <ScrollArea className="eng-scroll h-24 px-4 py-2">
          {reasoning.length === 0 ? (
            <div className="text-[10px] italic text-slate-600">No active reasoning. Submit a prompt or quick action.</div>
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
                      r.kind === "info" && "bg-slate-500",
                    )}
                  />
                  <span className="text-slate-300">{r.text}</span>
                </div>
              ))}
              <div ref={reasoningEndRef} />
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Intent Feed */}
      <ScrollArea className="eng-scroll flex-1 px-4 py-3">
        <div className="space-y-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex flex-col gap-1",
                m.role === "user" ? "items-end" : "items-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[92%] rounded-lg px-3 py-2 text-[12px] leading-relaxed",
                  m.role === "user"
                    ? "bg-cyan-500/15 text-cyan-50 ring-1 ring-cyan-500/20"
                    : "bg-slate-800/60 text-slate-200 ring-1 ring-slate-700/50",
                )}
              >
                {m.content}
              </div>
            </div>
          ))}
          {isGenerating && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <span className="flex gap-0.5">
                <span className="h-1 w-1 animate-pulse rounded-full bg-cyan-400" />
                <span className="h-1 w-1 animate-pulse rounded-full bg-cyan-400 [animation-delay:120ms]" />
                <span className="h-1 w-1 animate-pulse rounded-full bg-cyan-400 [animation-delay:240ms]" />
              </span>
              synthesizing flowsheet…
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-slate-800 p-3">
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
            className="border-slate-700 bg-slate-900/70 text-sm text-slate-100 placeholder:text-slate-600 focus-visible:ring-cyan-500/40"
          />
          <Button
            type="submit"
            size="icon"
            disabled={isGenerating || !input.trim()}
            className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
        <div className="mt-2 flex items-center gap-1 text-[9px] text-slate-600">
          <ChevronRight className="h-2.5 w-2.5" />
          Generated baselines are inspectable — adjust params in the Deep Dive to iterate.
        </div>
      </div>
    </div>
  );
}
