"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, RotateCcw, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { EXAMPLE_PROMPTS, QUICK_ACTIONS } from "./copilot/constants";
import { Composer } from "./copilot/Composer";
import { CopilotBody, CopyButton, ThinkingBlock, Timestamp } from "./copilot/MessageParts";
import { useCopilotStream } from "./copilot/useCopilotStream";

export function CopilotSidecar() {
  const [input, setInput] = useState("");
  const { messages, isGenerating, runPrompt, stop, regenerate, lastCopilotId } =
    useCopilotStream();

  const feedRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

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

  // Clear the composer and re-stick the feed, then hand off to the hook.
  const send = useCallback(
    (prompt: string) => {
      setInput("");
      stickToBottomRef.current = true;
      runPrompt(prompt);
    },
    [runPrompt],
  );

  const showExamples = messages.length === 0;

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-950">
      {/* Quick actions — only show in empty state (onboarding affordance) */}
      {messages.length === 0 && !isGenerating && (
        <div className="shrink-0 px-3 py-2">
          <div className="eng-scroll flex gap-1.5 overflow-x-auto pb-0.5">
            {QUICK_ACTIONS.map((a) => (
              <button
                key={a.id}
                disabled={isGenerating}
                onClick={() => send(a.prompt)}
                className="flex shrink-0 items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/60 px-2.5 py-1 text-[11px] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200 disabled:opacity-40"
              >
                <a.icon className="h-3 w-3 text-cyan-500/70" />
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat feed */}
      <div className="relative min-h-0 flex-1">
        <div ref={feedRef} onScroll={onFeedScroll} className="eng-scroll absolute inset-0 overflow-y-auto">
          <div className="space-y-4 px-4 py-4">
            {messages.map((m) => {
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
                      onClick={() => send(ex)}
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
        onSend={() => send(input)}
        onStop={stop}
        isGenerating={isGenerating}
      />
    </div>
  );
}
