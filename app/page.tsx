"use client";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Pencil, RotateCcw, X } from "lucide-react";

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
    thinkingLabel,
    abortController,
    handleAsk,
    regenerateLastMessage,
    editLastMessage,
    viewLastResponseVariant,
  } = useAskGobi();

  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [question, setQuestion] = useState("");
  const [isEditingLast, setIsEditingLast] = useState(false);
  const [editDraft, setEditDraft] = useState("");

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
                  <>
                    <ChatMessages
                      messages={[messages[messages.length - 1]]}
                      thinking={thinking}
                      isTyping={isTyping}
                      thinkingLabel={thinkingLabel}
                      theme={theme}
                      hideAnswer={isEditingLast}
                    />

                    {isEditingLast && (
                      <div
                        className={`rounded-xl border p-3 mb-3 ${
                          theme === "light"
                            ? "border-gray-300 bg-gray-50"
                            : "border-gray-700 bg-[#151515]"
                        }`}
                      >
                        <input
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          placeholder="Edit prompt"
                          className={`w-full rounded-lg px-3 py-2 border outline-none ${
                            theme === "light"
                              ? "bg-white border-gray-300 text-gray-900"
                              : "bg-[#111] border-gray-700 text-gray-100"
                          }`}
                        />
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            disabled={thinking || !editDraft.trim()}
                            onClick={() => {
                              const edited = editDraft.trim();
                              if (!edited) return;
                              setIsEditingLast(false);
                              setEditDraft("");
                              void editLastMessage(edited);
                            }}
                            className="px-3 py-1.5 rounded-lg text-sm bg-blue-600 text-white disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            disabled={thinking}
                            onClick={() => {
                              setIsEditingLast(false);
                              setEditDraft("");
                            }}
                            className={`px-3 py-1.5 rounded-lg text-sm border ${
                              theme === "light"
                                ? "border-gray-300 bg-white text-gray-800"
                                : "border-gray-700 bg-[#161616] text-gray-200"
                            }`}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        disabled={thinking}
                        onClick={() => regenerateLastMessage()}
                        title="Regenerate"
                        className={`h-8 w-8 inline-flex items-center justify-center rounded-full border transition ${
                          theme === "light"
                            ? "bg-white border-gray-300 text-gray-800"
                            : "bg-[#161616] border-gray-700 text-gray-200"
                        }`}
                      >
                        <RotateCcw size={14} />
                      </button>
                      <button
                        type="button"
                        disabled={thinking}
                        onClick={() => {
                          const last = messages[messages.length - 1];
                          if (!last) return;
                          setEditDraft(last.question);
                          setIsEditingLast(true);
                        }}
                        title="Edit prompt"
                        className={`h-8 w-8 inline-flex items-center justify-center rounded-full border transition ${
                          theme === "light"
                            ? "bg-white border-gray-300 text-gray-800"
                            : "bg-[#161616] border-gray-700 text-gray-200"
                        }`}
                      >
                        <Pencil size={14} />
                      </button>

                      {messages[messages.length - 1].answerHistory?.length > 1 && (
                        <>
                          <button
                            type="button"
                            disabled={thinking || messages[messages.length - 1].answerIndex <= 0}
                            onClick={() => viewLastResponseVariant("prev")}
                            title="Previous response"
                            className={`h-8 w-8 inline-flex items-center justify-center rounded-full border ${
                              theme === "light"
                                ? "bg-white border-gray-300 text-gray-800 disabled:opacity-40"
                                : "bg-[#161616] border-gray-700 text-gray-200 disabled:opacity-40"
                            }`}
                          >
                            <ChevronLeft size={14} />
                          </button>
                          <div className="text-xs opacity-70 min-w-[56px] text-center">
                            {messages[messages.length - 1].answerIndex + 1}/
                            {messages[messages.length - 1].answerHistory.length}
                          </div>
                          <button
                            type="button"
                            disabled={
                              thinking ||
                              messages[messages.length - 1].answerIndex >=
                                messages[messages.length - 1].answerHistory.length - 1
                            }
                            onClick={() => viewLastResponseVariant("next")}
                            title="Next response"
                            className={`h-8 w-8 inline-flex items-center justify-center rounded-full border ${
                              theme === "light"
                                ? "bg-white border-gray-300 text-gray-800 disabled:opacity-40"
                                : "bg-[#161616] border-gray-700 text-gray-200 disabled:opacity-40"
                            }`}
                          >
                            <ChevronRight size={14} />
                          </button>
                        </>
                      )}

                      {isEditingLast && (
                        <button
                          type="button"
                          disabled={thinking}
                          onClick={() => {
                            setIsEditingLast(false);
                            setEditDraft("");
                          }}
                          title="Cancel edit"
                          className={`h-8 w-8 inline-flex items-center justify-center rounded-full border ${
                            theme === "light"
                              ? "bg-white border-gray-300 text-gray-800"
                              : "bg-[#161616] border-gray-700 text-gray-200"
                          }`}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </>
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
