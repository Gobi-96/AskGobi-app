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
    thinking,
    isTyping,
    abortController,
    handleAsk,
  } = useAskGobi();

  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [question, setQuestion] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // scroll latest content into view
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, thinking, isTyping]);

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
          <ChatHeader />

          {/* Scrollable area */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 pt-4 pb-[220px] max-w-3xl mx-auto w-full"
          >
            {messages.length === 0 && !thinking ? (
              <EmptyChatScreen
                askExample={(example) => handleAsk(example)}
                theme={theme}
              />
            ) : (
              <>
                {/* OLD messages above header style */}
                <div className="flex flex-col gap-6 mt-20">
                  {messages.slice(0, -1).map((msg, i) => (
                    <ChatMessages
                      key={i}
                      messages={[msg]}
                      thinking={false}
                      isTyping={false}
                      theme={theme}
                    />
                  ))}
                </div>

                {/* Latest Q/A */}
                {messages.length > 0 && (
                  <ChatMessages
                    messages={[messages[messages.length - 1]]}
                    thinking={thinking}
                    isTyping={isTyping}
                    theme={theme}
                  />
                )}
              </>
            )}
          </div>

          {/* BOTTOM SECTION */}
          <div
            className={`fixed bottom-0 left-0 right-0 flex flex-col items-center z-40 pb-3 pt-2 border-t ${
              theme === "light"
                ? "bg-white border-gray-200"
                : "bg-[#0d0d0d] border-gray-800"
            }`}
          >

            <ChatInputBar
              question={question}
              setQuestion={setQuestion}
              thinking={thinking}
              abortController={abortController}
              theme={theme}
              askGobi={(q, online) => handleAsk(q, online)}
              setThinking={() => {}}
            />

            {/* FOOTER */}
            <div
              className={`text-center text-xs mt-2 opacity-60 ${
                theme === "light" ? "text-gray-700" : "text-gray-400"
              }`}
              style={{ pointerEvents: "none" }}
            >
              AskGobi can make mistakes — still under development.
            </div>

          </div>
        </>
      )}
    </main>
  );
}
