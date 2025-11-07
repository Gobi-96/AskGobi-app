"use client";
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  question: string;
  answer: string;
}

export default function ChatMessages({
  messages,
  thinking,
  isTyping,
  theme,
}: {
  messages: Message[];
  thinking: boolean;
  isTyping: boolean;
  theme: string | undefined;
}) {
  return (
    <div className="w-full mt-6">
      {messages.map((msg, i) => (
        <div key={i} className="mb-8">
          <h2 className="text-2xl font-semibold mb-3">{msg.question}</h2>
          <div
            className={`p-6 rounded-2xl leading-relaxed shadow-lg border whitespace-pre-wrap space-y-2 ${
              theme === "light"
                ? "bg-gray-100 border-gray-200"
                : "bg-[#111] border-gray-800"
            }`}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {msg.answer}
            </ReactMarkdown>
          </div>
          {(thinking || isTyping) && i === messages.length - 1 && (
            <div className="mt-2 text-purple-400 animate-pulse text-sm">
              {isTyping ? "⌨️ Typing..." : "🧠 Thinking..."}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
