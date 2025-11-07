"use client";
import { useState } from "react";
import { sanitize, truncateWords, formatToBullets } from "@/components/helpers/textUtils";

interface Message {
  question: string;
  answer: string;
}

export function useAskGobi() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [thinking, setThinking] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  // 🌟 Common function to handle both askGobi and askExample
  async function handleAsk(query: string) {
    if (!query.trim() || thinking) return;

    const newMessage = { question: query, answer: "" };
    setMessages((prev) => [...prev, newMessage]);
    setThinking(true);
    setIsTyping(false);

    const controller = new AbortController();
    setAbortController(controller);

    try {
      // 🧠 Thinking phase
      setMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1
            ? { ...m, answer: "💭 Deeply thinking... firing neural circuits..." }
            : m
        )
      );

      await new Promise((r) => setTimeout(r, 1000));

      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          query,
          context: messages.slice(-3),
        }),
      });

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
            if (json.response) {
              partial += json.response;

              let cleaned = sanitize(partial);
              cleaned = truncateWords(cleaned, 180);
              const formatted = formatToBullets(cleaned);

              if (!typingShown) {
                setIsTyping(true);
                typingShown = true;
              }

              setMessages((prev) =>
                prev.map((m, i) =>
                  i === prev.length - 1 ? { ...m, answer: formatted } : m
                )
              );

              if (cleaned.endsWith(" …")) {
                reader.cancel();
                break;
              }
            }
          } catch {}
        }
      }

      let cleanedEnd = sanitize(partial.trim());
      if (!/[.?!…]$/.test(cleanedEnd)) cleanedEnd += ".";
      const finalCleaned = formatToBullets(truncateWords(cleanedEnd, 180));

      setMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1 ? { ...m, answer: finalCleaned } : m
        )
      );
    } catch (err: any) {
      if (err.name === "AbortError") {
        setMessages((prev) =>
          prev.map((m, i) =>
            i === prev.length - 1
              ? { ...m, answer: "🛑 Stopped by user." }
              : m
          )
        );
      } else {
        console.error(err);
      }
    } finally {
      setThinking(false);
      setIsTyping(false);
      setAbortController(null);
    }
  }

  return {
    messages,
    setMessages,
    thinking,
    setThinking,
    isTyping,
    abortController,
    handleAsk,
  };
}
