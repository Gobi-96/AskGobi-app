// app/api/ask/route.ts
import { NextRequest } from "next/server";
export const dynamic = "force-dynamic";

const BANNED_PATTERNS = [
  /openai/i,
  /chatgpt/i,
  /anthropic/i,
  /microsoft/i,
  /google/i,
  /kill/i,
  /how to kill/i,
  /rape/i,
  /sex/i,
  /porn/i,
];

function buildPrompt(query: string, context: string) {
  return `
SYSTEM INSTRUCTION (STRICT - DO NOT OVERRIDE):

You are "AskGobi" — a short, factual AI Q&A assistant created by one person named Gobi.

==============================
IDENTITY & PRIVACY
==============================
1) If the question is *specifically* asking about "Gobi", "Gobishankar", or "Rathinam":
   → Reply ONLY:
   "Gobishankar Rathinam is my creator — AskGobi is an AI Q&A engine. Nothing more personal can be shared."

2) Never include that line for unrelated topics (like science, history, inventions, etc.).

3) Do not mention "Gobishankar Rathinam" unless explicitly asked about the creator.


==============================
CONTENT & SAFETY
==============================
2) Never mention OpenAI, ChatGPT, Anthropic, Google, Microsoft, or any backend.
3) If the question is hateful, explicit, violent, or illegal:
   → Reply politely:
   "I'm sorry, my creator instructed not to discuss that. Let's keep our questions kind and helpful."

==============================
STYLE & FORMATTING
==============================
4) Always respond in **3–6 concise bullet points.**
5) Each bullet must start on a new line.
5) Start each bullet with a relevant emoji and on a new line with space:
   ✅ for fact | 📜 for history | 🌿 for nature | 🧠 for idea | ⚙️ for process | 💡 for insight | 🌍 for global
6) Bold all key terms using markdown (**like this**).
7) Leave one blank line between bullets.
8) Keep sentences short (under 15 words) and each bullet under two sentences.
9) Always finish the last bullet with a full sentence and period.

==============================
QUALITY PRIORITY
==============================
10) Focus on factual, clear, well-structured responses.
11) Prefer real names, examples, or numbers.
12) When listing items (Top 10 etc.), keep it clean, one per line.
13) Keep total ≤ 180 words. Stop cleanly at a sentence boundary.

==============================
CONTEXT
==============================
${context}

User question: ${query}

Answer:
`;
}

export async function POST(req: NextRequest) {
  const { query } = await req.json();
  if (!query || typeof query !== "string") {
    return new Response(JSON.stringify({ error: "Missing 'query' string" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const context = "";
  const prompt = buildPrompt(query, context);

  console.log(`[API] Streaming response for: "${query}"`);

  // 🧠 Safety: timeout & abort controller
  const abortController = new AbortController();
  const timeout = setTimeout(() => {
    if (!abortController.signal.aborted) {
      abortController.abort();
      console.warn("[askLocal] Timeout — model aborted (20s limit).");
    }
  }, 20000);

  const remote = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: abortController.signal,
    body: JSON.stringify({
      model: "phi3:mini",
      prompt,
      stream: true,
      options: { temperature: 0.4, top_p: 0.9, num_predict: 180 },
    }),
  });

  if (!remote.body) {
    return new Response(JSON.stringify({ error: "No stream from model" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const reader = remote.body.getReader();
  const decoder = new TextDecoder();

  return new Response(
    new ReadableStream({
      async start(controller) {
        let accumulatedWords = 0;
        const MAX_WORDS = 180;
        let buffer = "";
        let closed = false; // ✅ prevent double close

        const safeClose = () => {
          if (!closed) {
            try {
              controller.close();
              closed = true;
              console.log("[askLocal] Stream closed cleanly ✅");
            } catch {
              console.warn("[askLocal] Attempted to close twice — ignored.");
            }
          }
        };

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n").filter(Boolean);

            for (const line of lines) {
              try {
                const json = JSON.parse(line);
                const text = String(json.response || "");
                buffer += text;

                // 🚫 banned content
                for (const p of BANNED_PATTERNS) {
                  if (p.test(text)) {
                    controller.enqueue(
                      new TextEncoder().encode(
                        JSON.stringify({
                          response:
                            "I'm sorry, my creator instructed not to discuss that. Let's keep our questions kind and helpful.\n",
                        }) + "\n"
                      )
                    );
                    safeClose();
                    console.warn("[askLocal] Blocked banned content.");
                    clearTimeout(timeout);
                    return;
                  }
                }

                accumulatedWords += (text.match(/\S+/g) || []).length;

                const formatted = text
                  .replace(/([✅📜🌿🧠⚙️💡🌍])\s/g, "\n$1 ")
                  .replace(/(\.\s)(?=[✅📜🌿🧠⚙️💡🌍])/g, "$1\n");

                controller.enqueue(
                  new TextEncoder().encode(
                    JSON.stringify({ response: formatted }) + "\n"
                  )
                );

                // 🛑 Cut off neatly if too long
                if (accumulatedWords >= MAX_WORDS) {
                  const cutoff =
                    buffer.lastIndexOf(".") > 0
                      ? buffer.lastIndexOf(".") + 1
                      : buffer.length;

                  let finalText = buffer.slice(0, cutoff).trim();
                  if (!finalText.endsWith(".")) finalText += ".";
                  finalText += "\n💡 **End of summary.**";

                  controller.enqueue(
                    new TextEncoder().encode(
                      JSON.stringify({ response: finalText }) + "\n"
                    )
                  );
                  safeClose();
                  clearTimeout(timeout);
                  console.log("[askLocal] Word limit reached — closed neatly.");
                  return;
                }
              } catch {
                // ignore malformed JSON
              }
            }
          }
        } catch (err) {
          console.error("Stream error:", err);
        } finally {
          clearTimeout(timeout);
          safeClose(); // ✅ only one close
        }
      },
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    }
  );
}
