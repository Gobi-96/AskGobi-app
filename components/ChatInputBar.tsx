"use client";
import React from "react";

interface ChatInputBarProps {
  question: string;
  setQuestion: (value: string) => void;
  thinking: boolean;
  abortController: AbortController | null;
  theme: string | undefined;
  askGobi: (e: React.FormEvent) => void;
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
  return (
    <form
      onSubmit={askGobi}
      className={`fixed bottom-0 left-0 right-0 p-4 shadow-xl backdrop-blur-md z-40 ${
        theme === "light" ? "bg-white/80" : "bg-[#0d0d0d]/80"
      }`}
    >
      <div
        className={`max-w-3xl mx-auto flex items-center gap-2 border rounded-2xl px-4 py-3 transition-colors ${
          theme === "light"
            ? "border-gray-300 bg-gray-100"
            : "border-gray-700 bg-[#111]"
        }`}
      >
        <input
          type="text"
          placeholder="Ask anything..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className={`flex-1 bg-transparent text-base sm:text-lg focus:outline-none ${
            theme === "light"
              ? "text-gray-900 placeholder-gray-500"
              : "text-white placeholder-gray-500"
          }`}
        />
        <button
          type={thinking ? "button" : "submit"}
          onClick={() => {
            if (thinking && abortController) {
              abortController.abort();
              setThinking(false);
            }
          }}
          className={`min-w-[90px] h-[44px] flex items-center justify-center rounded-xl font-semibold transition text-white ${
            thinking
              ? "bg-red-600 hover:bg-red-700 animate-pulse"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {thinking ? "Stop" : "Ask"}
        </button>
      </div>
    </form>
  );
}
