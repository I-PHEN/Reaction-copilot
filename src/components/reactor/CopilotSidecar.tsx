"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  Send,
  Sparkles,
  Zap,
  Recycle,
  Gauge,
  FlaskConical,
  Brain,
  ChevronDown,
  Square,
  ArrowDown,
} from "lucide-react";
import { useTopology, type CopilotMessage } from "@/lib/store/topology";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
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

function fmtTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Renders a timestamp only after client mount. SSR renders nothing, so
 * server/client never disagree on locale-formatted time (hydration-safe).
 * useSyncExternalStore is the lint-compliant way to detect client mount.
 */
const emptySubscribe = () => () => {};
function useIsClient() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true, // client snapshot
    () => false, // server snapshot
  );
}
function Timestamp({ ts }: { ts: number }) {
  const mounted = useIsClient();
  if (!mounted || ts === 0) return null;
  return <>{fmtTime(ts)}</>;
}

/* ------------------------------------------------------------------ */
/* Markdown copilot body (lists, bold, code) — minimal styling.        */
/* ------------------------------------------------------------------ */
function CopilotBody({ content }: { content: string }) {
  return (
    <div className="text-[12.5px] leading-relaxed text-zinc-300 [&_a]:text-cyan-400 [&_a]:underline [&_code]:rounded [&_code]:bg-zinc-800 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[11px] [&_code]:text-cyan-200 [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:my-1 [&_strong]:text-zinc-100 [&_ul]:list-disc [&_ul]:pl-4">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Thinking block — inline in the chat feed, Claude/Gemini style.      */
/* ------------------------------------------------------------------ */
function ThinkingBlock({ message }: { message: CopilotMessage }) {
  const active = !message.done;
  const steps = message.steps ?? [];
  const duration = message.durationMs ? (message.durationMs / 1000).toFixed(1) : null;

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
              className={cn("ml-auto h-3 w-3 text-zinc-700 transition-transform", open && "rotate-180")}
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
/* Auto-resizing composer                                              */
/* ------------------------------------------------------------------ */
function Composer({
  value,
  onChange,
  onSend,
  onStop,
  isGenerating,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  isGenerating: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-resize: reset to auto then cap at 6 rows (~144px).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !isGenerating) onSend();
    }
  };

  return (
    <div className="shrink-0 border-t border-zinc-800/80 p-3">
      <div className="flex items-end gap-2 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2 transition-colors focus-within:border-zinc-700">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe a reactor network…  (Enter to send, Shift+Enter for newline)"
          rows={1}
          disabled={isGenerating}
          className="eng-scroll max-h-[144px] flex-1 resize-none bg-transparent text-sm leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-600 disabled:opacity-50"
        />
        {isGenerating ? (
          <Button
            type="button"
            size="icon"
            onClick={onStop}
            title="Stop generating"
            className="h-8 w-8 shrink-0 bg-zinc-700 text-zinc-100 hover:bg-zinc-600"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
          </Button>
        ) : (
          <Button
            type="button"
            size="icon"
            onClick={onSend}
            disabled={!value.trim()}
            title="Send"
            className="h-8 w-8 shrink-0 bg-cyan-500 text-zinc-950 hover:bg-cyan-400 disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        )}
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

  const feedRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Smart auto-scroll: only stick to bottom if the user is already there.
  const onFeedScroll = useCallback(() => {
    const el = feedRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    stickToBottomRef.current = nearBottom;
    setShowJump(!nearBottom);
  }, []);

  useEffect(() => {
    const el = feedRef.current;
    if (!el || !stickToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const jumpToBottom = useCallback(() => {
    const el = feedRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    stickToBottomRef.current = true;
    setShowJump(false);
  }, []);

  const runPrompt = async (prompt: string) => {
    if (!prompt.trim() || isGenerating) return;
    setInput("");
    pushMessage({ role: "user", content: prompt });
    setGenerating(true);
    stickToBottomRef.current = true;
    const thinkId = startThinking();
    pushReasoning("Parsing engineering intent…", "info");
    pushReasoning("Loading first-order Arrhenius kinetic model", "verify");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `${prompt}\n\n[Current topology for context: ${network.nodes.length} units, ${network.streams.length} streams. You may extend or replace it.]`,
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Copilot error ${res.status}`);
      const data = (await res.json()) as CopilotResponse;

      for (let i = 0; i < data.reasoning.length; i++) {
        if (controller.signal.aborted) break;
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

      if (controller.signal.aborted) {
        pushReasoning("Stopped by user", "info");
        finalizeThinking(thinkId);
        setGenerating(false);
        return;
      }

      if (data.topology?.nodes?.length) {
        setNetwork(data.topology);
        pushReasoning("Topology committed · dispatching verified solvers", "info");
      }
      finalizeThinking(thinkId);
      pushMessage({ role: "copilot", content: data.message });
      setGenerating(false);
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        pushReasoning("Stopped by user", "info");
        finalizeThinking(thinkId);
        setGenerating(false);
        return;
      }
      finalizeThinking(thinkId);
      setGenerating(false);
      pushMessage({
        role: "copilot",
        content: "Could not reach the reasoning engine. The verified solver layer is still active — adjust parameters in the Deep Dive panel.",
      });
      toast.error("Copilot request failed", { description: (e as Error).message });
    } finally {
      abortRef.current = null;
    }
  };

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-950">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800/80 px-4 py-2.5">
        <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
        <span className="text-[13px] font-medium text-zinc-200">Synthesis Copilot</span>
        <span className="ml-auto font-mono text-[10px] text-zinc-600">verified solvers</span>
      </div>

      {/* Quick actions */}
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

      {/* Chat feed — NATIVE scroll, min-h-0 so it never pushes the composer */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={feedRef}
          onScroll={onFeedScroll}
          className="eng-scroll absolute inset-0 overflow-y-auto"
        >
          <div className="space-y-4 px-4 py-4">
            {messages.map((m) => {
              if (m.role === "thinking") return <ThinkingBlock key={m.id} message={m} />;
              if (m.role === "user") {
                return (
                  <div key={m.id} className="group flex justify-end">
                    <div className="flex max-w-[85%] flex-col items-end">
                      <div className="rounded-2xl rounded-br-sm bg-zinc-800 px-3 py-2 text-[12.5px] leading-relaxed text-zinc-200 whitespace-pre-wrap">
                        {m.content}
                      </div>
                      <span className="mt-0.5 px-1 text-[9px] text-zinc-700 opacity-0 transition-opacity group-hover:opacity-100">
                        <Timestamp ts={m.ts} />
                      </span>
                    </div>
                  </div>
                );
              }
              return (
                <div key={m.id} className="group flex justify-start">
                  <div className="flex max-w-[92%] flex-col">
                    <div className="mb-0.5 flex items-center gap-1">
                      <Sparkles className="h-2.5 w-2.5 text-cyan-500/70" />
                      <span className="font-mono text-[9px] uppercase tracking-wider text-zinc-600">
                        copilot
                      </span>
                    </div>
                    <CopilotBody content={m.content} />
                    <span className="mt-0.5 px-1 text-[9px] text-zinc-700 opacity-0 transition-opacity group-hover:opacity-100">
                      <Timestamp ts={m.ts} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Jump-to-latest pill */}
        {showJump && (
          <button
            onClick={jumpToBottom}
            className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900/95 px-2.5 py-1 text-[10px] text-zinc-300 shadow-lg backdrop-blur transition-colors hover:border-zinc-600 hover:text-white"
          >
            <ArrowDown className="h-2.5 w-2.5" />
            Latest
          </button>
        )}
      </div>

      <Composer
        value={input}
        onChange={setInput}
        onSend={() => runPrompt(input)}
        onStop={stop}
        isGenerating={isGenerating}
      />
    </div>
  );
}
