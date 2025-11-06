"use client";
import { useState, useEffect, useRef } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  question: string;
  answer: string;
}

export default function HomePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [thinking, setThinking] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 🧠 Helpers
  const sanitize = (text: string) => {
    const banned =
      /(sex|sexual|kill|murder|rape|porn|nsfw|explicit|abuse|nude|fuck|bitch|cock|pussy|hentai)/gi;
    return text
      .replace(banned, "⚠️ [content removed]")
      .replace(/\b(openai|chatgpt|anthropic|google|microsoft)\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  };

  const truncateWords = (text: string, max = 180) => {
    const words = text.split(/\s+/);
    if (words.length <= max) return text;
    const truncated = words.slice(0, max).join(" ");
    const lastPeriod = truncated.lastIndexOf(".");
    if (lastPeriod > 0) return truncated.slice(0, lastPeriod + 1).trim() + " …";
    return truncated.trim() + " …";
  };

  const formatToBullets = (text: string) => {
    if (/^[\s\n]*([✅📜🌿🧠💡⚙️🌍\-•])/m.test(text)) return text;
    const sentences = text.split(/(?<=[.!?])\s+/).slice(0, 5);
    return sentences
      .filter((s) => s.trim().length > 3)
      .map((s) => `✅ ${s.trim()}`)
      .join("\n\n");
  };

  async function askGobi(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || thinking) return;

    const newMessage = { question, answer: "" };
    setMessages((prev) => [...prev, newMessage]);
    setQuestion("");
    setThinking(true);
    setIsTyping(false);

    const controller = new AbortController();
    setAbortController(controller);

    try {
      // 🧠 Thinking phase before streaming
      setMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1
            ? { ...m, answer: "💭 Deeply thinking... firing neural circuits..." }
            : m
        )
      );
      await new Promise((r) => setTimeout(r, 1200));

      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          query: newMessage.question,
          context: messages.slice(-3), // send last 3 messages for context
        }),
        
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No stream");

      let partial = "";
      let typingShown = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter(Boolean);

        for (const line of lines) {
          try {
            const json = JSON.parse(line);
            if (json.response) {
              partial += json.response;

              let cleaned = sanitize(partial);
              cleaned = truncateWords(cleaned, 180);
              const formatted = formatToBullets(cleaned);

              if (!typingShown) {
                setIsTyping(true);
                typingShown = true;
              }
              

              setMessages((prev) =>
                prev.map((m, i) =>
                  i === prev.length - 1 ? { ...m, answer: formatted } : m
                )
              );

              if (cleaned.endsWith(" …")) {
                console.log("[UI] Word limit reached, stopping stream");
                reader.cancel();
                break;
              }
            }
          } catch {}
        }
      }

      let cleanedEnd = sanitize(partial.trim());
      if (!/[.?!…]$/.test(cleanedEnd)) cleanedEnd += ".";
      const finalCleaned = formatToBullets(truncateWords(cleanedEnd, 180));

      setMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1 ? { ...m, answer: finalCleaned } : m
        )
      );
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.log("Stream aborted by user 🚫");
        setMessages((prev) =>
          prev.map((m, i) =>
            i === prev.length - 1
              ? { ...m, answer: "🛑 Stopped by user." }
              : m
          )
        );
      } else {
        console.error(err);
      }
    } finally {
      setThinking(false);
      setIsTyping(false);
      setAbortController(null);
      console.log("[UI] Stream ended — typing stopped ✅");
    }
  }

  if (!mounted) return null;

  return (
    <main
      className={`flex flex-col min-h-screen transition-colors duration-300 ${
        theme === "light"
          ? "bg-white text-gray-900"
          : "bg-[#0d0d0d] text-gray-100"
      }`}
    >
      {/* Header */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4
        transition-all duration-300 backdrop-blur-md ${
          theme === "light"
            ? "bg-white/80 border-b border-gray-200 text-gray-900"
            : "bg-[#0d0d0d]/80 border-b border-gray-800 text-white"
        }`}
      >
        <h1
          className={`text-3xl font-bold transition-colors ${
            theme === "light" ? "text-gray-900" : "text-white"
          }`}
        >
          <span
            className={`${theme === "light" ? "text-gray-900" : "text-white"}`}
          >
            Ask
          </span>
          <span className="text-blue-500">Gobi</span>
        </h1>

        

        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className={`p-2 rounded-full transition-colors border ${
            theme === "light"
              ? "bg-gray-200 hover:bg-gray-300 border-gray-300 text-gray-800"
              : "bg-gray-700 hover:bg-gray-600 border-gray-600 text-yellow-300"
          }`}
        >
          {mounted && (theme === "dark" ? <Sun size={20} /> : <Moon size={20} />)}
        </button>
      </header>

      {/* Chat Section */}
      <div className="flex-1 overflow-y-auto px-4 pt-24 pb-32 max-w-3xl w-full mx-auto flex flex-col items-center">
        {messages.length === 0 && !thinking ? (
          // 🧠 Initial View
<div className="flex flex-col items-center text-center space-y-8">
  <h1
    className={`text-6xl font-bold transition-colors ${
      theme === "light" ? "text-gray-900" : "text-white"
    }`}
  >
    <span className={`${theme === "light" ? "text-gray-900" : "text-white"}`}>
      Ask
    </span>
    <span className="text-blue-500">Gobi</span>
  </h1>

  {/* ✨ Tagline under the title */}
  <p
    className={`text-lg sm:text-xl font-medium ${
      theme === "light" ? "text-gray-600" : "text-gray-400"
    }`}
  >
    Answering your questions short & crisp.
  </p>

  {/* 🧠 Examples */}
  <div className="space-y-3 text-gray-400 mt-4">
    <p>Examples you can try:</p>
    <ul className="space-y-1">
    <li>• Tell me something about Pondicherry.</li>
      <li>• What’s the capital of Japan?</li>
      <li>• Who invented electricity?</li>
      <li>• Who created you?</li>
    </ul>
  </div>
</div>

        ) : (
          // 💬 Chat Messages
          <div className="w-full mt-10 max-w-3xl">
            {messages.map((msg, i) => (
              <div key={i} className="mb-8">
                <h2 className="text-2xl font-semibold mb-3">{msg.question}</h2>
                <div
                  className={`p-6 rounded-2xl leading-relaxed shadow-lg whitespace-pre-wrap space-y-2 border ${
                    theme === "light"
                      ? "bg-gray-100 border-gray-200"
                      : "bg-[#111] border-gray-800"
                  }`}
                  style={{ lineHeight: "1.8" }}
                >
                  <div className="prose prose-invert max-w-none text-base leading-relaxed whitespace-pre-wrap [&>p]:my-1 [&>ul]:my-2 [&>li]:my-0">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.answer}
                    </ReactMarkdown>
                  </div>
                </div>

                {/* Typing Indicator */}
                {(thinking || isTyping) && i === messages.length - 1 && (
  <div className="mt-2 text-purple-400 animate-pulse text-sm">
    {isTyping ? "⌨️ Typing..." : "🧠 Thinking..."}
  </div>
)}
              </div>
            ))}
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Section */}
      <form
        onSubmit={askGobi}
        className={`fixed bottom-0 left-0 right-0 p-4 shadow-xl backdrop-blur-md ${
          theme === "light" ? "bg-white/80" : "bg-[#0d0d0d]/80"
        }`}
      >
        <div
          className={`max-w-3xl mx-auto flex items-center gap-2 border rounded-2xl px-4 py-3 transition-colors ${
            theme === "light"
              ? "border-gray-300 bg-gray-100"
              : "border-gray-700 bg-[#111]"
          }`}
          style={{ overflow: "hidden" }}
        >
<input
  type="text"
  placeholder="Ask anything..."
  value={question}
  onChange={(e) => setQuestion(e.target.value)}
  className={`flex-1 min-w-0 bg-transparent text-base sm:text-lg focus:outline-none ${
    theme === "light"
      ? "text-gray-900 placeholder-gray-500"
      : "text-white placeholder-gray-500"
  }`}
  style={{ flexGrow: 1 }}
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
    </main>
  );
}
