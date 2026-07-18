"use client";

import { useEffect, useRef } from "react";
import { ArrowUp, Square } from "lucide-react";
import { cn } from "@/lib/utils";

/** Circular send button (upward arrow, cyan). */
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

/** Auto-resizing composer. */
export function Composer({
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
