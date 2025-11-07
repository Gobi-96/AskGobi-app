"use client";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { AnimatePresence } from "framer-motion";

import ChatHeader from "@/components/ChatHeader";
import ChatInputBar from "@/components/ChatInputBar";
import ChatMessages from "@/components/ChatMessages";
import EmptyChatScreen from "@/components/EmptyChatScreen";
import IntroScreen from "@/components/IntroScreen";
import { useAskGobi } from "@/app/hooks/useAskGobi";

export default function HomePage() {
  const {
    messages,
    setMessages,
    thinking,
    setThinking,
    isTyping,
    abortController,
    handleAsk,
  } = useAskGobi();

  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [question, setQuestion] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  if (!mounted) return null;

  return (
    <main
      className={`relative flex flex-col h-screen overflow-hidden transition-colors duration-300 ${
        theme === "light"
          ? "bg-white text-gray-900"
          : "bg-[#0d0d0d] text-gray-100"
      }`}
    >
      <AnimatePresence>
        {showIntro && <IntroScreen onTryNow={() => setShowIntro(false)} />}
      </AnimatePresence>

      {!showIntro && (
        <>
          <div className="flex flex-col h-screen">
            <ChatHeader />

            {/* Scrollable middle section */}
            <div className="flex-1 overflow-y-auto pt-20 pb-28 px-4 max-w-3xl mx-auto w-full">
              {messages.length === 0 && !thinking ? (
                <EmptyChatScreen
                  askExample={(example) => handleAsk(example)}
                  theme={theme}
                />
              ) : (
                <ChatMessages
                  messages={messages}
                  thinking={thinking}
                  isTyping={isTyping}
                  theme={theme}
                />
              )}
              <div ref={chatEndRef} />
            </div>
          </div>

          {/* Input bar */}
          <ChatInputBar
            question={question}
            setQuestion={setQuestion}
            thinking={thinking}
            abortController={abortController}
            theme={theme}
            askGobi={(e) => {
              e.preventDefault();
              handleAsk(question);
              setQuestion("");
            }}
            setThinking={setThinking}
          />
        </>
      )}
    </main>
  );
}
