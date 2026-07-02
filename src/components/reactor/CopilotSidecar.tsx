"use client";

import { useEffect, useRef, useState } from "react";
import {
  Send,
  Sparkles,
  Zap,
  Recycle,
  Gauge,
  FlaskConical,
  Brain,
  ChevronDown,
} from "lucide-react";
import { useTopology, type CopilotMessage } from "@/lib/store/topology";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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

/* ------------------------------------------------------------------ */
/* Thinking block — inline in the chat feed, Claude/Gemini style.      */
/* ------------------------------------------------------------------ */
function ThinkingBlock({ message }: { message: CopilotMessage }) {
  const active = !message.done;
  const steps = message.steps ?? [];
  const duration = message.durationMs ? (message.durationMs / 1000).toFixed(1) : null;

  // Openness model:
  //  - while active (thinking): always expanded
  //  - once done: collapsed by default, but the user can re-expand.
  //    `userToggled` captures an explicit user choice so the auto-collapse
  //    on completion doesn't fight a manual expand.
  const [userToggled, setToggled] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const open = active ? true : userToggled ? userOpen : false;

  return (
    <div className="flex justify-start">
      <div className="w-full max-w-[92%]">
        <Collapsible
          open={open}
          onOpenChange={(v) => {
            setToggled(true);
            setUserOpen(v);
          }}
        >
          <CollapsibleTrigger className="flex w-full items-center gap-1.5 rounded-md px-1 py-1 text-left transition-colors hover:bg-zinc-900/50">
            <Brain className={cn("h-3 w-3", active ? "text-violet-400" : "text-zinc-600")} />
            {active ? (
              <>
                <span className="text-[11px] font-medium text-zinc-400">Thinking</span>
                <span className="flex gap-0.5">
                  <span className="h-1 w-1 animate-pulse rounded-full bg-violet-400" />
                  <span className="h-1 w-1 animate-pulse rounded-full bg-violet-400 [animation-delay:120ms]" />
                  <span className="h-1 w-1 animate-pulse rounded-full bg-violet-400 [animation-delay:240ms]" />
                </span>
              </>
            ) : (
              <span className="text-[11px] text-zinc-600">
                Thought for {duration}s · {steps.length} steps
              </span>
            )}
            <ChevronDown
              className={cn(
                "ml-auto h-3 w-3 text-zinc-700 transition-transform",
                open && "rotate-180",
              )}
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="ml-4 border-l border-zinc-800 pl-3">
              <div className="space-y-1 py-1">
                {steps.map((s) => (
                  <div key={s.id} className="flex items-start gap-1.5 text-[11px] leading-snug">
                    <span
                      className={cn(
                        "mt-1 h-1 w-1 shrink-0 rounded-full",
                        s.kind === "select" && "bg-cyan-400",
                        s.kind === "verify" && "bg-emerald-400",
                        s.kind === "layout" && "bg-violet-400",
                        s.kind === "info" && "bg-zinc-600",
                      )}
                    />
                    <span className="text-zinc-500">{s.text}</span>
                  </div>
                ))}
                {active && (
                  <div className="flex items-center gap-1 pt-0.5 text-[10px] text-zinc-700">
                    <span className="h-1 w-1 animate-pulse rounded-full bg-zinc-600" />
                    working…
                  </div>
                )}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sidecar                                                              */
/* ------------------------------------------------------------------ */
export function CopilotSidecar() {
  const [input, setInput] = useState("");
  const messages = useTopology((s) => s.copilotMessages);
  const isGenerating = useTopology((s) => s.isGenerating);
  const pushMessage = useTopology((s) => s.pushMessage);
  const startThinking = useTopology((s) => s.startThinking);
  const pushReasoning = useTopology((s) => s.pushReasoning);
  const finalizeThinking = useTopology((s) => s.finalizeThinking);
  const setGenerating = useTopology((s) => s.setGenerating);
  const setNetwork = useTopology((s) => s.setNetwork);
  const network = useTopology((s) => s.network);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const runPrompt = async (prompt: string) => {
    if (!prompt.trim() || isGenerating) return;
    setInput("");
    pushMessage({ role: "user", content: prompt });
    setGenerating(true);
    const thinkId = startThinking();
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

      // Stream the reasoning steps with a small stagger so the user
      // perceives the AI "thinking" in real time.
      for (let i = 0; i < data.reasoning.length; i++) {
        const step = data.reasoning[i];
        const kind = /select|choose|cstr|pfr/i.test(step)
          ? "select"
          : /verify|check|converg|kinetic|constraint/i.test(step)
            ? "verify"
            : /layout|position|place|route/i.test(step)
              ? "layout"
              : "info";
        await new Promise((r) => setTimeout(r, 280));
        pushReasoning(step, kind);
      }

      // Commit topology + finalize thinking, then print the answer.
      if (data.topology?.nodes?.length) {
        setNetwork(data.topology);
        pushReasoning("Topology committed · dispatching verified solvers", "info");
      }
      finalizeThinking(thinkId);
      pushMessage({ role: "copilot", content: data.message });
      setGenerating(false);
    } catch (e) {
      finalizeThinking(thinkId);
      setGenerating(false);
      pushMessage({
        role: "copilot",
        content: "Could not reach the reasoning engine. The verified solver layer is still active — adjust parameters in the Deep Dive panel.",
      });
      toast.error("Copilot request failed", { description: (e as Error).message });
    }
  };

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      {/* Header */}
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

      {/* Chat feed — the main flexible region */}
      <ScrollArea className="eng-scroll flex-1">
        <div className="space-y-4 px-4 py-4">
          {messages.map((m) => {
            if (m.role === "thinking") return <ThinkingBlock key={m.id} message={m} />;
            if (m.role === "user") {
              return (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-zinc-800 px-3 py-2 text-[12.5px] leading-relaxed text-zinc-200">
                    {m.content}
                  </div>
                </div>
              );
            }
            return (
              <div key={m.id} className="flex justify-start">
                <div className="max-w-[92%]">
                  <div className="mb-0.5 flex items-center gap-1">
                    <Sparkles className="h-2.5 w-2.5 text-cyan-500/70" />
                    <span className="font-mono text-[9px] uppercase tracking-wider text-zinc-600">
                      copilot
                    </span>
                  </div>
                  <div className="text-[12.5px] leading-relaxed text-zinc-300">{m.content}</div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
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
