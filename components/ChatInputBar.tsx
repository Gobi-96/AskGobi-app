"use client";
import React, { useState } from "react";

interface ChatInputBarProps {
  question: string;
  setQuestion: (value: string) => void;
  thinking: boolean;
  abortController: AbortController | null;
  theme: string | undefined;
  askGobi: (e: React.FormEvent, onlineMode?: boolean) => void;
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

  // 🌐 NEW: online mode toggle
  const [onlineMode, setOnlineMode] = useState(false);

  // 🔔 NEW: popup visibility
  const [showPopup, setShowPopup] = useState(false);

  // 🧠 Handle submit, passing online mode
  const handleSubmit = (e: React.FormEvent) => {
    askGobi(e, onlineMode);
  };

  return (
    <>
      {/* ⚠️ Popup */}
      {showPopup && (
        <div className="fixed bottom-20 right-6 bg-black text-white px-4 py-2 rounded-lg shadow-lg text-sm opacity-90 animate-fade z-[999]">
          🌐 Online search enabled — may be slower
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className={`fixed bottom-0 left-0 right-0 p-4 shadow-xl backdrop-blur-md z-40 ${
          theme === "light" ? "bg-white/80" : "bg-[#0d0d0d]/80"
        }`}
      >
        <div
          className={`max-w-3xl mx-auto flex flex-wrap items-center gap-2 min-h-[56px] border rounded-2xl px-3 py-2 transition-colors ${
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
  className={`flex-1 min-w-[150px] bg-transparent text-base sm:text-lg focus:outline-none ${
    theme === "light"
      ? "text-gray-900 placeholder-gray-500"
      : "text-white placeholder-gray-500"
  }`}
/>


          {/* 🌐 NEW: Globe Button */}
          <button
            type="button"
            onClick={() => {
              setOnlineMode((prev) => {
                const next = !prev;
            
                // ⭐ Show popup ONLY when user enables online mode
                if (next === true) {
                  setShowPopup(true);
                  setTimeout(() => setShowPopup(false), 1800);
                }
            
                return next;
              });
            }}            
            className={`px-3 py-2 rounded-xl text-lg transition ${
              onlineMode
                ? "bg-blue-600 text-white"
                : "bg-gray-700 text-gray-300"
            }`}
          >
            🌐
          </button>

          {/* ASK / STOP BUTTON */}
          <button
  type={thinking ? "button" : "submit"}
  className={`min-w-[70px] sm:min-w-[90px] h-[44px] flex items-center justify-center rounded-xl font-semibold transition text-white ${
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
