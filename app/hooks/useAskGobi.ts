"use client";
import { useState } from "react";
import { sanitize, truncateWords, formatToBullets } from "@/components/helpers/textUtils";

interface Message {
  question: string;
  answer: string;
  answerHistory: string[];
  answerIndex: number;
}

export function useAskGobi() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [thinking, setThinking] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [thinkingLabel, setThinkingLabel] = useState("🧠 Thinking...");
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  async function runAsk(
    query: string,
    onlineMode: boolean = false,
    opts: { replaceLast?: boolean; preserveLastHistory?: boolean } = {}
  ) {
    if (!query.trim() || thinking) return;

    const replaceLast = Boolean(opts.replaceLast);
    const preserveLastHistory = Boolean(opts.preserveLastHistory);
    const isFirstQuestion = !replaceLast && messages.length === 0;
    const context = (replaceLast ? messages.slice(0, -1) : messages).slice(-3);
    const previous = replaceLast ? messages[messages.length - 1] : null;
    const previousHistory = preserveLastHistory
      ? previous?.answerHistory?.length
        ? previous.answerHistory
        : previous?.answer
          ? [previous.answer]
          : []
      : [];

    const newMessage: Message = {
      question: query,
      answer: "",
      answerHistory: previousHistory,
      answerIndex: previousHistory.length,
    };

    setMessages((prev) =>
      replaceLast
        ? prev.length > 0
          ? [...prev.slice(0, -1), newMessage]
          : [newMessage]
        : [...prev, newMessage]
    );
    setThinking(true);
    setIsTyping(false);

    const controller = new AbortController();
    let phaseTimer: ReturnType<typeof setTimeout> | null = null;
    setAbortController(controller);

    try {
      setThinkingLabel("🧠 Thinking...");
      if (isFirstQuestion) {
        phaseTimer = setTimeout(() => {
          setThinkingLabel("💭 Firing neural circuits...");
        }, 1800);
      }

      await new Promise((r) => setTimeout(r, 500));

      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ query, context, onlineMode }),
      });

      if (!res.ok) {
        let errMsg = `Request failed (${res.status})`;
        try {
          const errJson = await res.json();
          if (errJson?.error) errMsg = String(errJson.error);
        } catch {}
        throw new Error(errMsg);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No stream");

      let partial = "";
      let typingShown = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter(Boolean);

        for (const line of lines) {
          try {
            const json = JSON.parse(line);
            if (!json.response) continue;

            partial += json.response;
            let cleaned = sanitize(partial);
            cleaned = truncateWords(cleaned, 180);
            const formatted = formatToBullets(cleaned);

            if (!typingShown) {
              setIsTyping(true);
              typingShown = true;
              if (phaseTimer) {
                clearTimeout(phaseTimer);
                phaseTimer = null;
              }
            }

            setMessages((prev) =>
              prev.map((m, i) =>
                i === prev.length - 1 ? { ...m, answer: formatted } : m
              )
            );

            if (cleaned.endsWith(" ...") || cleaned.endsWith(" …")) {
              reader.cancel();
              break;
            }
          } catch {}
        }
      }

      let cleanedEnd = sanitize(partial.trim());
      if (!cleanedEnd) {
        cleanedEnd = "No response from local model. Check Ollama logs and try again.";
      } else if (!/[.?!…]$/.test(cleanedEnd)) {
        cleanedEnd += ".";
      }
      const finalCleaned = formatToBullets(truncateWords(cleanedEnd, 180));

      setMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1
            ? {
                ...m,
                answer: finalCleaned,
                answerHistory: [...m.answerHistory, finalCleaned],
                answerIndex: m.answerHistory.length,
              }
            : m
        )
      );
    } catch (err: any) {
      const msg =
        err?.name === "AbortError"
          ? "Stopped by user."
          : err?.message || "Request failed. Check Ollama connection and model.";

      setMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1 ? { ...m, answer: msg } : m
        )
      );
      console.error(err);
    } finally {
      if (phaseTimer) {
        clearTimeout(phaseTimer);
      }
      setThinking(false);
      setIsTyping(false);
      setThinkingLabel("🧠 Thinking...");
      setAbortController(null);
    }
  }

  async function handleAsk(query: string, onlineMode: boolean = false) {
    return runAsk(query, onlineMode);
  }

  async function regenerateLastMessage(onlineMode: boolean = false) {
    const last = messages[messages.length - 1];
    if (!last) return;
    return runAsk(last.question, onlineMode, {
      replaceLast: true,
      preserveLastHistory: true,
    });
  }

  async function editLastMessage(newQuestion: string, onlineMode: boolean = false) {
    return runAsk(newQuestion, onlineMode, {
      replaceLast: true,
      preserveLastHistory: false,
    });
  }

  function viewLastResponseVariant(direction: "prev" | "next") {
    setMessages((prev) => {
      if (!prev.length) return prev;
      const lastIdx = prev.length - 1;
      const last = prev[lastIdx];
      if (!last.answerHistory.length) return prev;

      const nextIndex =
        direction === "prev"
          ? Math.max(0, last.answerIndex - 1)
          : Math.min(last.answerHistory.length - 1, last.answerIndex + 1);
      if (nextIndex === last.answerIndex) return prev;

      const next = [...prev];
      next[lastIdx] = {
        ...last,
        answerIndex: nextIndex,
        answer: last.answerHistory[nextIndex],
      };
      return next;
    });
  }

  return {
    messages,
    setMessages,
    thinking,
    setThinking,
    isTyping,
    thinkingLabel,
    abortController,
    handleAsk,
    regenerateLastMessage,
    editLastMessage,
    viewLastResponseVariant,
  };
}
