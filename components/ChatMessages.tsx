"use client";
import { useState } from "react";
import Link from "next/link";
import { Copy, Check, ArrowUpRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cleanMarkdownLinks } from "@/components/helpers/textUtils";

interface Message {
  question: string;
  answer: string;
  status?: "complete" | "error" | "stopped";
  notice?: string;
}

export default function ChatMessages({ messages, thinking, isTyping, thinkingLabel = "Thinking…", hideAnswer = false }: {
  messages: Message[];
  thinking: boolean;
  isTyping: boolean;
  thinkingLabel?: string;
  hideAnswer?: boolean;
}) {
  const [copyNotice, setCopyNotice] = useState<{ answer: string; text: string } | null>(null);
  async function copyAnswer(answer: string) {
    try {
      await navigator.clipboard.writeText(answer);
      setCopyNotice({ answer, text: "Copied" });
    } catch {
      setCopyNotice({ answer, text: "Couldn’t copy. Select the answer to copy it." });
    }
  }
  return (
    <div className="chat-exchanges">
      {messages.map((message, index) => {
        const pending = (thinking || isTyping) && index === messages.length - 1;
        const interrupted = message.status === "error" || message.status === "stopped";
        return (
          <article className="chat-exchange" key={index} aria-label="Conversation exchange">
            <div className="chat-user-message"><span className="sr-only">You: </span>{message.question}</div>
            {!hideAnswer && (
              <div className="chat-assistant-message">
                <div className="chat-assistant-label"><span className="chat-avatar" aria-hidden="true">g.</span> AskGobi <span>tiny local AI</span></div>
                {message.answer && <div className="chat-answer">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{
                    a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children} ↗</a>,
                  }}>{cleanMarkdownLinks(message.answer)}</ReactMarkdown>
                </div>}
                {pending && <p className="chat-thinking" role="status">{isTyping ? "Writing an answer…" : thinkingLabel}</p>}
                {!pending && interrupted && <div className="chat-response-notice" role="status">
                  <strong>{message.status === "stopped" ? "Response stopped" : "Couldn’t finish this answer"}</strong>
                  <p>{message.notice || "Please try again in a moment."}</p>
                  <Link href="/">Back to surprises <ArrowUpRight size={14} /></Link>
                </div>}
                {!pending && !interrupted && message.answer && <div className="chat-copy-row">
                  <button type="button" className="chat-copy" onClick={() => void copyAnswer(message.answer)}>
                    {copyNotice?.answer === message.answer && copyNotice.text === "Copied" ? <Check size={14} /> : <Copy size={14} />} Copy answer
                  </button>
                  <span role="status">{copyNotice?.answer === message.answer ? copyNotice.text : ""}</span>
                </div>}
                {!interrupted && message.notice && <p className="chat-thinking" role="status">{message.notice}</p>}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
