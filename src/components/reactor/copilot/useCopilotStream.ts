"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { optimizeReactor } from "@/lib/solvers";
import { useTopology } from "@/lib/store/topology";
import type { CopilotResponse } from "./constants";

/**
 * Owns the copilot request lifecycle: POST to /api/copilot with the current
 * topology + solver report as context, replay the reasoning steps into the
 * thinking block, commit the returned topology/candidates/optimization to
 * the store, then stream the final message with a typing effect.
 */
export function useCopilotStream() {
  const messages = useTopology((s) => s.copilotMessages);
  const isGenerating = useTopology((s) => s.isGenerating);
  const pushMessage = useTopology((s) => s.pushMessage);
  const updateMessage = useTopology((s) => s.updateMessage);
  const startThinking = useTopology((s) => s.startThinking);
  const pushReasoning = useTopology((s) => s.pushReasoning);
  const finalizeThinking = useTopology((s) => s.finalizeThinking);
  const setGenerating = useTopology((s) => s.setGenerating);
  const setNetwork = useTopology((s) => s.setNetwork);
  const setCandidates = useTopology((s) => s.setCandidates);
  const setOptimization = useTopology((s) => s.setOptimization);
  const network = useTopology((s) => s.network);
  const report = useTopology((s) => s.report);

  const abortRef = useRef<AbortController | null>(null);
  const streamTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      pushMessage({ role: "user", content: prompt });
      setGenerating(true);
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
            prompt,
            context: {
              topology: network,
              report,
            },
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

        if (data.mode === "multi" && data.candidates?.length) {
          setCandidates(data.candidates);
          pushReasoning(`Generated ${data.candidates.length} candidates · running verified solvers on each`, "verify");
        } else if (data.mode === "optimize" && data.optimize) {
          // Run the optimizer locally using the verified solver.
          const targetNode = network.nodes.find((n) => n.id === data.optimize!.nodeId);
          if (targetNode) {
            pushReasoning(`Running parameter sweep: V∈[${data.optimize.volumeRange[0]}, ${data.optimize.volumeRange[1]}] m³, T∈[${data.optimize.temperatureRange[0]}, ${data.optimize.temperatureRange[1]}] K`, "verify");
            const result = optimizeReactor(
              targetNode,
              data.optimize.volumeRange,
              data.optimize.temperatureRange,
              12,
              data.optimize.objective,
            );
            setOptimization(result);
            pushReasoning(`Sweep complete · ${result.evaluations} solver evaluations · optimal X=${(result.optimal.conversion * 100).toFixed(1)}% at V=${result.optimal.volume.toFixed(2)}m³, T=${result.optimal.temperature.toFixed(0)}K`, "verify");
          }
        } else if (data.topology?.nodes?.length) {
          setNetwork(data.topology);
          pushReasoning("Topology committed · dispatching verified solvers", "info");
        } else if (!data.topology) {
          pushReasoning("Analyzed current topology against verified solver report", "verify");
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
    [isGenerating, pushMessage, startThinking, pushReasoning, finalizeThinking, setGenerating, setNetwork, setCandidates, setOptimization, network, report, streamText],
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

  // Clear any in-flight typing timer on unmount.
  useEffect(() => {
    return () => {
      if (streamTimerRef.current) clearInterval(streamTimerRef.current);
    };
  }, []);

  return { messages, isGenerating, runPrompt, stop, regenerate, lastCopilotId };
}
