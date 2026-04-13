"use client";
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { cleanMarkdownLinks } from "@/components/helpers/textUtils";

interface Message {
  question: string;
  answer: string;
}

export default function ChatMessages({
  messages,
  thinking,
  isTyping,
  thinkingLabel = "🧠 Thinking...",
  theme,
  hideAnswer = false,
}: {
  messages: Message[];
  thinking: boolean;
  isTyping: boolean;
  thinkingLabel?: string;
  theme: string | undefined;
  hideAnswer?: boolean;
}) {
  return (
    <div className="w-full mt-6">
      {messages.map((msg, i) => {
        const hasAnswer = Boolean(msg.answer && msg.answer.trim().length > 0);
        return (
          <div key={i} className="mb-8">

          <h2 className="text-2xl font-semibold mb-3">{msg.question}</h2>

          {!hideAnswer && hasAnswer && (
            <div
              className={`p-6 rounded-2xl leading-relaxed shadow-lg border whitespace-pre-wrap space-y-2 ${
                theme === "light"
                  ? "bg-gray-100 border-gray-200 prose prose-slate"
                  : "bg-[#111] border-gray-800 prose prose-invert"
              } max-w-none`}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
                  a: ({ href, children }) => {
                    if (!href) return <>{children}</>;

                    const domain = href
                      .replace(/^https?:\/\//, "")
                      .replace(/^www\./, "")
                      .split("/")[0];

                    const label =
                      typeof children === "string" && children.trim().length > 1
                        ? children
                        : domain;

                    return (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 underline font-medium"
                      >
                        {label} <span className="opacity-80 text-sm">({domain}) ↗</span>
                      </a>
                    );
                  },
                }}
              >
                {cleanMarkdownLinks(msg.answer)}
              </ReactMarkdown>
            </div>
          )}

          {!hideAnswer && (thinking || isTyping) && i === messages.length - 1 && (
            <div className="mt-2 text-purple-400 animate-pulse text-sm">
              {isTyping ? "⌨️ Typing..." : thinkingLabel}
            </div>
          )}

          </div>
        );
      })}
    </div>
  );
}
