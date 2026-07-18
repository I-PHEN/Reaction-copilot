"use client";

import { useState, useSyncExternalStore } from "react";
import { Brain, Check, ChevronDown, Copy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { CopilotMessage } from "@/lib/store/topology";
import { cn } from "@/lib/utils";

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

export function Timestamp({ ts }: { ts: number }) {
  const mounted = useIsClient();
  if (!mounted || ts === 0) return null;
  return <>{fmtTime(ts)}</>;
}

/** Markdown copilot body. */
export function CopilotBody({ content }: { content: string }) {
  return (
    <div className="text-[12.5px] leading-relaxed text-zinc-300 [&_a]:text-cyan-400 [&_a]:underline [&_code]:rounded [&_code]:bg-zinc-800 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[11px] [&_code]:text-cyan-200 [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:my-1 [&_strong]:text-zinc-100 [&_ul]:list-disc [&_ul]:pl-4">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}

/** Copy button — appears on hover of copilot messages. */
export function CopyButton({ text }: { text: string }) {
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

/** Thinking block — inline in the chat feed. */
export function ThinkingBlock({ message }: { message: CopilotMessage }) {
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
