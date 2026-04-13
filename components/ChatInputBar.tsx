"use client";
import React, { useState, useRef, useEffect } from "react";

interface ChatInputBarProps {
  question: string;
  setQuestion: (value: string) => void;
  thinking: boolean;
  abortController: AbortController | null;
  theme: string | undefined;
  askGobi: (query: string, onlineMode?: boolean) => void;
  setThinking: (v: boolean) => void;
}

export default function ChatInputBar({
  question,
  setQuestion,
  thinking,
  abortController,
  theme,
  askGobi,
  setThinking,
}: ChatInputBarProps) {

  const [onlineMode, setOnlineMode] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // auto detect online mode
  function autoOnline(q: string) {
    return /today|latest|recent|version|online|live|now|current|new|news|update|price|weather|trending|launch|launched|release|released|announced/i.test(q);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    const finalOnline = onlineMode || autoOnline(question);
    askGobi(question, finalOnline);
    setQuestion("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "44px";
    }
  };

  // auto-resize
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = "44px";
    const scrollH = el.scrollHeight;
    if (scrollH > 44) el.style.height = Math.min(scrollH, 120) + "px";
  }, [question]);

  // enter = submit
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  return (
    <>
      {showPopup && (
        <div className="fixed bottom-20 right-6 bg-black text-white px-4 py-2 rounded-lg shadow-lg text-sm opacity-90 animate-fade z-[999]">
          🌐 Online search enabled — may be slower
        </div>
      )}

      {/* ⭐ NOT FIXED ANYMORE */}
      <form
        onSubmit={handleSubmit}
        className={`w-full p-4 shadow-xl z-40 ${
          theme === "light" ? "bg-white" : "bg-[#0d0d0d]"
        }`}
      >
        <div
          className={`max-w-3xl mx-auto flex items-end gap-2 min-h-[56px] border rounded-2xl px-3 py-2 transition-colors ${
            theme === "light"
              ? "border-gray-300 bg-gray-100"
              : "border-gray-700 bg-[#111]"
          }`}
        >
          {/* TEXTAREA */}
          <textarea
            ref={textareaRef}
            placeholder="Ask anything..."
            value={question}
            maxLength={500}
            onKeyDown={handleKeyDown}
            onChange={(e) => setQuestion(e.target.value)}
            className={`flex-1 resize-none overflow-y-hidden 
              h-[44px] min-h-[44px] max-h-[120px]
              bg-transparent text-base sm:text-lg
              leading-[1.4] px-1 py-2
              outline-none
              ${theme === "light"
                ? "text-gray-900 placeholder-gray-500"
                : "text-white placeholder-gray-500"
              }`}
          />

          {/* GLOBE BUTTON */}
          <button
            type="button"
            onClick={() => {
              setOnlineMode((prev) => {
                const next = !prev;
                if (next) {
                  setShowPopup(true);
                  setTimeout(() => setShowPopup(false), 1800);
                }
                return next;
              });
            }}
            className={`px-3 py-2 rounded-xl text-lg transition ${
              autoOnline(question) || onlineMode
                ? "bg-blue-600 text-white"
                : "bg-gray-700 text-gray-300"
            }`}
          >
            🌐
          </button>

          {/* ASK / STOP */}
          <button
            type={thinking ? "button" : "submit"}
            className={`min-w-[70px] sm:min-w-[90px] h-[44px]
              flex items-center justify-center rounded-xl font-semibold
              transition text-white
              ${
                thinking
                  ? "bg-red-600 hover:bg-red-700 animate-pulse"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
          >
            {thinking ? "Stop" : "Ask"}
          </button>
        </div>
      </form>
    </>
  );
}
