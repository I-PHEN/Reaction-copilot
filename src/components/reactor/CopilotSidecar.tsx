"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  ArrowUp,
  Square,
  Sparkles,
  Zap,
  Recycle,
  Gauge,
  FlaskConical,
  Brain,
  ChevronDown,
  Copy,
  Check,
  RotateCcw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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

const EXAMPLE_PROMPTS = [
  "Design a 3-CSTR cascade for 99% conversion of A → B",
  "Compare CSTR vs PFR for the same reactor volume",
  "Add a separator and recycle loop to maximize yield",
  "Design a PFR train targeting 95% conversion at 380 K",
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

const emptySubscribe = () => () => {};
function useIsClient() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
function Timestamp({ ts }: { ts: number }) {
  const mounted = useIsClient();
  if (!mounted || ts === 0) return null;
  return <>{fmtTime(ts)}</>;
}

/* ------------------------------------------------------------------ */
/* Markdown copilot body                                                */
/* ------------------------------------------------------------------ */
function CopilotBody({ content }: { content: string }) {
  return (
    <div className="text-[12.5px] leading-relaxed text-zinc-300 [&_a]:text-cyan-400 [&_a]:underline [&_code]:rounded [&_code]:bg-zinc-800 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[11px] [&_code]:text-cyan-200 [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:my-1 [&_strong]:text-zinc-100 [&_ul]:list-disc [&_ul]:pl-4">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Copy button — appears on hover of copilot messages                  */
/* ------------------------------------------------------------------ */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy");
    }
  };
  return (
    <button
      onClick={onCopy}
      className="rounded p-1 text-zinc-600 opacity-0 transition-all hover:bg-zinc-800 hover:text-zinc-300 group-hover:opacity-100"
      title="Copy"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Thinking block — inline in the chat feed                             */
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
/* Circular send button (upward arrow, cyan)                            */
/* ------------------------------------------------------------------ */
function SendButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title="Send"
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all",
        disabled
          ? "bg-zinc-800 text-zinc-600"
          : "bg-cyan-500 text-zinc-950 hover:bg-cyan-400 hover:scale-105 active:scale-95",
      )}
    >
      <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Auto-resizing composer                                               */
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
    <div className="shrink-0 p-3">
      <div className="flex items-end gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/80 px-3 py-2 transition-all focus-within:border-zinc-600 focus-within:ring-1 focus-within:ring-zinc-600/50">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe a reactor network…"
          rows={1}
          disabled={isGenerating}
          className="eng-scroll max-h-[144px] flex-1 resize-none bg-transparent text-sm leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-600 disabled:opacity-50"
        />
        {isGenerating ? (
          <button
            type="button"
            onClick={onStop}
            title="Stop"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-zinc-100 transition-all hover:bg-zinc-600 hover:scale-105 active:scale-95"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
          </button>
        ) : (
          <SendButton disabled={!value.trim()} onClick={onSend} />
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
  const updateMessage = useTopology((s) => s.updateMessage);
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
  const streamTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Stream text character-by-character into a message (typing effect).
  const streamText = useCallback(
    (msgId: string, fullText: string) => {
      let i = 0;
      const chunk = Math.max(2, Math.ceil(fullText.length / 120));
      if (streamTimerRef.current) clearInterval(streamTimerRef.current);
      streamTimerRef.current = setInterval(() => {
        i += chunk;
        if (i >= fullText.length) {
          updateMessage(msgId, fullText);
          if (streamTimerRef.current) clearInterval(streamTimerRef.current);
          streamTimerRef.current = null;
          setGenerating(false);
        } else {
          updateMessage(msgId, fullText.slice(0, i));
        }
      }, 16);
    },
    [updateMessage, setGenerating],
  );

  const runPrompt = useCallback(
    async (prompt: string) => {
      if (!prompt.trim() || isGenerating) return;
      // If streaming is still in progress, stop it first.
      if (streamTimerRef.current) {
        clearInterval(streamTimerRef.current);
        streamTimerRef.current = null;
      }
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

        // Push an empty copilot message, then stream the text into it.
        const msgId = `m${Date.now()}`;
        pushMessage({ role: "copilot", content: "" });
        // The message just pushed gets a new id from the store; find it by
        // looking for the last copilot message with empty content.
        const state = useTopology.getState();
        const lastCopilot = [...state.copilotMessages].reverse().find((m) => m.role === "copilot" && m.content === "");
        const targetId = lastCopilot?.id ?? msgId;
        streamText(targetId, data.message);
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
    },
    [isGenerating, pushMessage, startThinking, pushReasoning, finalizeThinking, setGenerating, setNetwork, network, streamText],
  );

  const stop = useCallback(() => {
    if (streamTimerRef.current) {
      clearInterval(streamTimerRef.current);
      streamTimerRef.current = null;
      setGenerating(false);
    }
    abortRef.current?.abort();
  }, [setGenerating]);

  // Regenerate: find the last user message and re-run it.
  const regenerate = useCallback(() => {
    if (isGenerating) return;
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser) runPrompt(lastUser.content);
  }, [isGenerating, messages, runPrompt]);

  // Find the last copilot message id (for regenerate button placement).
  const lastCopilotId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "copilot") return messages[i].id;
    }
    return null;
  }, [messages]);

  const showExamples = messages.length === 0;

  useEffect(() => {
    return () => {
      if (streamTimerRef.current) clearInterval(streamTimerRef.current);
    };
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

      {/* Chat feed */}
      <div className="relative min-h-0 flex-1">
        <div ref={feedRef} onScroll={onFeedScroll} className="eng-scroll absolute inset-0 overflow-y-auto">
          <div className="space-y-4 px-4 py-4">
            {messages.map((m, idx) => {
              if (m.role === "thinking") {
                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ThinkingBlock message={m} />
                  </motion.div>
                );
              }
              if (m.role === "user") {
                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="group flex justify-end"
                  >
                    <div className="flex max-w-[85%] flex-col items-end">
                      <div className="rounded-2xl rounded-br-sm bg-zinc-800 px-3 py-2 text-[12.5px] leading-relaxed text-zinc-200 whitespace-pre-wrap">
                        {m.content}
                      </div>
                      <span className="mt-0.5 px-1 text-[9px] text-zinc-700 opacity-0 transition-opacity group-hover:opacity-100">
                        <Timestamp ts={m.ts} />
                      </span>
                    </div>
                  </motion.div>
                );
              }
              const isLast = m.id === lastCopilotId;
              const isStreaming = isGenerating && isLast && m.content.length > 0;
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="group flex flex-col items-start"
                >
                  <div className="flex max-w-[92%] flex-col">
                    <div className="mb-0.5 flex items-center gap-1">
                      <Sparkles className="h-2.5 w-2.5 text-cyan-500/70" />
                      <span className="font-mono text-[9px] uppercase tracking-wider text-zinc-600">
                        copilot
                      </span>
                      {/* streaming cursor */}
                      {isStreaming && (
                        <span className="ml-0.5 inline-block h-3 w-0.5 animate-pulse bg-cyan-400" />
                      )}
                    </div>
                    {m.content ? (
                      <CopilotBody content={m.content} />
                    ) : (
                      <div className="flex gap-0.5 py-1.5">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-600" />
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-600 [animation-delay:120ms]" />
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-600 [animation-delay:240ms]" />
                      </div>
                    )}
                    <div className="flex items-center gap-1 mt-0.5 px-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <CopyButton text={m.content} />
                      {isLast && !isGenerating && (
                        <button
                          onClick={regenerate}
                          className="rounded p-1 text-zinc-600 transition-all hover:bg-zinc-800 hover:text-zinc-300"
                          title="Regenerate"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </button>
                      )}
                      <span className="text-[9px] text-zinc-700">
                        <Timestamp ts={m.ts} />
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {/* Example prompts in empty state */}
            <AnimatePresence>
              {showExamples && !isGenerating && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-1.5 pt-2"
                >
                  <div className="px-1 text-[10px] uppercase tracking-wider text-zinc-600">
                    Try
                  </div>
                  {EXAMPLE_PROMPTS.map((ex) => (
                    <button
                      key={ex}
                      onClick={() => runPrompt(ex)}
                      className="block w-full rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-left text-[12px] text-zinc-400 transition-colors hover:border-zinc-700 hover:bg-zinc-900/70 hover:text-zinc-200"
                    >
                      {ex}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Jump-to-latest pill */}
        {showJump && (
          <button
            onClick={jumpToBottom}
            className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900/95 px-2.5 py-1 text-[10px] text-zinc-300 shadow-lg backdrop-blur transition-colors hover:border-zinc-600 hover:text-white"
          >
            <ArrowUp className="h-2.5 w-2.5" />
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
