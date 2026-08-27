"use client";
import { useRef, useEffect, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, Globe2, Square } from "lucide-react";
import { needsWebSearch } from "@/lib/chatInput";

interface ChatInputBarProps {
  question: string;
  setQuestion: (value: string) => void;
  thinking: boolean;
  abortController: AbortController | null;
  askGobi: (query: string, onlineMode?: boolean) => void;
  onlineMode: boolean;
  setOnlineMode: (value: boolean) => void;
  autoFocus?: boolean;
}

export default function ChatInputBar({ question, setQuestion, thinking, abortController,
  askGobi, onlineMode, setOnlineMode, autoFocus = false }: ChatInputBarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const automaticSearch = needsWebSearch(question);
  const searchEnabled = onlineMode || automaticSearch;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    // Keep the visitor's next draft intact while a response is still arriving.
    if (thinking || !question.trim()) return;
    askGobi(question.trim(), searchEnabled);
    setQuestion("");
  };
  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "52px";
    element.style.height = Math.min(element.scrollHeight, 160) + "px";
  }, [question]);
  useEffect(() => { if (autoFocus) textareaRef.current?.focus(); }, [autoFocus]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
      handleSubmit(event);
    }
  };

  return (
    <form className="chat-composer" onSubmit={handleSubmit} aria-label="Ask Gobi">
      <label className="sr-only" htmlFor="chat-question">Your question</label>
      <textarea id="chat-question" ref={textareaRef} placeholder={thinking ? "Your next question can wait here…" : "Ask anything. Start anywhere."}
        value={question} maxLength={500} rows={2} onChange={(event) => setQuestion(event.target.value)}
        onKeyDown={handleKeyDown} aria-describedby="chat-search-note" />
      <div className="chat-composer-tools">
        <button type="button" className={`chat-search-toggle ${searchEnabled ? "is-active" : ""}`}
          aria-label="Always use web search" aria-pressed={onlineMode}
          onClick={() => setOnlineMode(!onlineMode)}>
          <Globe2 size={16} aria-hidden="true" /> Web search <span>{onlineMode ? "On" : "Auto"}</span>
        </button>
        <div className="chat-send-tools">
          {question.length > 400 && <span className="chat-counter">{question.length}/500</span>}
          <button type={thinking ? "button" : "submit"} className={`chat-send ${thinking ? "is-stopping" : ""}`}
            disabled={!thinking && !question.trim()} onClick={thinking ? () => abortController?.abort() : undefined}
            aria-label={thinking ? "Stop response" : "Send question"}>
            {thinking ? <Square size={14} fill="currentColor" aria-hidden="true" /> : <ArrowUp size={19} aria-hidden="true" />}
            <span>{thinking ? "Stop" : "Ask"}</span>
          </button>
        </div>
      </div>
      <p id="chat-search-note" className="chat-search-note">
        {onlineMode ? "Web search is on. Lookups may take a little longer." : automaticSearch
          ? "This question will use web search for current information." : "Search runs automatically for time-sensitive questions."}
      </p>
    </form>
  );
}
