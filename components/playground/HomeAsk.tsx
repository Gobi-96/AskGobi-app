"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Radio, X } from "lucide-react";
import { useAskGobi } from "@/app/hooks/useAskGobi";
import ChatInputBar from "@/components/ChatInputBar";
import ChatMessages from "@/components/ChatMessages";
import {
  CHAT_HANDOFF_KEY,
  type ChatHandoff,
} from "@/lib/curiosity/chatHandoff";
import { getCard } from "@/lib/curiosity/cards";
import { needsWebSearch } from "@/lib/chatInput";

const starters = [
  {
    label: "Why does traffic stop?",
    question: "Why does traffic sometimes stop even when there is no accident?",
  },
  {
    label: "Explain simply",
    question: "Explain how GPS finds me, in simple terms.",
  },
  {
    label: "A strange what-if",
    question:
      "What if humans could photosynthesize? Give me a fun, short thought experiment.",
  },
];
export type HomeSuggestion = { text: string; cardId: string; nonce: number };
export default function HomeAsk({
  suggestion,
}: {
  suggestion?: HomeSuggestion;
}) {
  const [question, setQuestion] = useState("");
  const [onlineMode, setOnlineMode] = useState(false);
  const [cardId, setCardId] = useState<string>();
  const [handoffNotice, setHandoffNotice] = useState("");
  const [showLauncher, setShowLauncher] = useState(false);
  const section = useRef<HTMLElement>(null);
  const chat = useAskGobi({ cardId: cardId ?? null });
  useEffect(() => {
    if (!suggestion) return;
    setQuestion(suggestion.text.slice(0, 500));
    setCardId(suggestion.cardId);
    section.current?.scrollIntoView({ behavior: "auto", block: "start" });
    section.current
      ?.querySelector<HTMLTextAreaElement>("textarea")
      ?.focus({ preventScroll: true });
  }, [suggestion]);
  useEffect(() => {
    let visible = true;
    function update() {
      const typing = document.activeElement?.matches(
        "input,textarea,[contenteditable=true]",
      );
      const keyboard =
        window.visualViewport &&
        window.visualViewport.height < window.innerHeight * 0.75;
      setShowLauncher(!visible && !typing && !keyboard);
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    });
    if (section.current) observer.observe(section.current);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, []);
  const last = chat.messages.at(-1);
  const completed =
    last?.status === "complete" && !!last.answer && !chat.thinking;
  function continueChat() {
    if (!completed) return;
    if (chat.activeConversationId && !last?.notice) {
      window.location.assign(
        "/chat?conversation=" +
          encodeURIComponent(chat.activeConversationId) +
          (cardId ? "&card=" + encodeURIComponent(cardId) : ""),
      );
      return;
    }
    const handoff: ChatHandoff = {
      version: 1,
      createdAt: Date.now(),
      ownerId: chat.currentUserId,
      cardId,
      exchanges: chat.messages
        .filter((m) => m.status === "complete")
        .slice(-3)
        .map((m) => ({
          question: m.question.slice(0, 500),
          answer: m.answer.slice(0, 4000),
        })),
    };
    try {
      sessionStorage.setItem(CHAT_HANDOFF_KEY, JSON.stringify(handoff));
      window.location.assign(
        "/chat?from=home" +
          (cardId ? "&card=" + encodeURIComponent(cardId) : ""),
      );
    } catch {
      setHandoffNotice(
        "This browser can’t carry the answer to chat. You can keep asking here, or open a fresh chat.",
      );
    }
  }
  return (
    <>
      <section
        id="ask"
        ref={section}
        className="pg-home-ask"
        aria-labelledby="home-ask-title"
        tabIndex={-1}
      >
        <div className="pg-ai-heading">
          <span className="pg-signal-mark" aria-hidden="true">
            <Radio size={20} />
          </span>
          <div>
            <h2 id="home-ask-title">What are you curious about?</h2>
            <p>Ask my AI. Follow a question somewhere interesting.</p>
          </div>
        </div>
        {cardId && (
          <p className="pg-card-context">
            Exploring: {getCard(cardId)?.title || "this discovery"}
            <button
              type="button"
              onClick={() => setCardId(undefined)}
              aria-label="Clear discovery context"
            >
              <X size={16} />
            </button>
          </p>
        )}
        <ChatInputBar
          question={question}
          setQuestion={setQuestion}
          thinking={chat.thinking}
          abortController={chat.abortController}
          askGobi={(q, online) => {
            setHandoffNotice("");
            void chat.handleAsk(q, online);
          }}
          onlineMode={onlineMode}
          setOnlineMode={setOnlineMode}
          disabled={!chat.historyReady || chat.historyLoading}
        />
        {!chat.messages.length && (
          <div className="pg-prompt-chips" aria-label="Try a question">
            {starters.map((starter) => (
              <button
                type="button"
                key={starter.label}
                disabled={!chat.historyReady || chat.thinking}
                onClick={() => {
                  setCardId(undefined);
                  setQuestion("");
                  void chat.handleAsk(
                    starter.question,
                    needsWebSearch(starter.question),
                  );
                }}
              >
                {starter.label}
                <ArrowUpRight size={14} aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
        <p className="pg-ai-note">No account needed. AI can make mistakes.</p>
        {!!chat.messages.length && (
          <div className="pg-home-answer">
            <ChatMessages
              messages={chat.messages.slice(-1)}
              thinking={chat.thinking}
              isTyping={chat.isTyping}
              thinkingLabel={chat.thinkingLabel}
            />
            {completed && (
              <>
                <div className="pg-followups" aria-label="Explore further">
                  <button
                    type="button"
                    onClick={() =>
                      void chat.handleAsk(
                        "Explain your last answer more simply.",
                      )
                    }
                  >
                    Explain more simply
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void chat.handleAsk(
                        "Give me one concrete example of your last answer.",
                      )
                    }
                  >
                    Give me an example
                  </button>
                </div>
                <button
                  type="button"
                  className="pg-button pg-primary"
                  onClick={continueChat}
                >
                  Continue chatting <ArrowUpRight size={16} />
                </button>
              </>
            )}
            {!chat.thinking && last?.status === "error" && (
              <button
                type="button"
                className="pg-small-link"
                onClick={() => void chat.regenerateLastMessage(onlineMode)}
              >
                Try the answer again
              </button>
            )}
            {handoffNotice && (
              <p role="status" className="pg-status">
                {handoffNotice} <a href="/chat">Open chat</a>
              </p>
            )}
          </div>
        )}
      </section>
      {showLauncher && (
        <a
          href="#ask"
          className="pg-ask-launcher"
          onClick={() =>
            section.current
              ?.querySelector<HTMLTextAreaElement>("textarea")
              ?.focus({ preventScroll: true })
          }
        >
          <Radio size={18} aria-hidden="true" /> Ask Gobi
        </a>
      )}
    </>
  );
}
