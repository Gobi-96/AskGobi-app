// app/api/ask/route.ts
import { NextRequest } from "next/server";
import pLimit from "p-limit";  
export const dynamic = "force-dynamic";

// ✅ Allow up to 4 concurrent AI generations
const limit = pLimit(2);

// after imports
const ports = Array.from({ length: 2 }, (_, i) => 11435 + i); 
let nextPort = 0;

function getNextPort() {
  const port = ports[nextPort];
  nextPort = (nextPort + 1) % ports.length;
  return port;
}


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
1) If the question is *specifically* asking about "Gobi", "Gobishankar":
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
LINKS & LIVE DATA
==============================
14) When using websites from LIVE WEB RESULTS, copy their URLs exactly.
15) Format all links in Markdown: [Title](https://example.com).
16) Prefer LIVE WEB RESULTS over any older memorized knowledge if they conflict.


==============================
LIVE WEB RESULTS (highest priority data)
==============================
${(() => {
  const marker = "Latest online lookup:";
  return context.includes(marker)
    ? context.substring(context.indexOf(marker) + marker.length).trim()
    : "No live data";
})()}

==============================
CONTEXT
==============================
${context}

User question: ${query}

Answer using the LIVE WEB RESULTS above as your most recent data:
`;
}

export async function POST(req: NextRequest) {
  const { query, context = [] } = await req.json();

  if (!query || typeof query !== "string") {
    return new Response(JSON.stringify({ error: "Missing 'query' string" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const chatContext = Array.isArray(context)
    ? context.map((m: any) => `User: ${m.question}\nAskGobi: ${m.answer}`).join("\n")
    : "";

    async function fetchOnlineData(q: string) {
      try {
        const base = req.nextUrl.origin;  // auto-detect server host (localhost:3000)
        const url = `${base}/api/search?q=${encodeURIComponent(q)}`;
    
        const res = await fetch(url);
        if (!res.ok) return null;
    
        const data = await res.json();
        return data?.results?.slice(0, 3) || null;
      } catch (e) {
        console.error("Online search error:", e);
        return null;
      }
    }
    
    
    function needsWebSearch(q: string) {
      return /today|latest|online|live|now|current|news|update|price|weather|trending|launch|launched|release|released|announced/i.test(q);
    }    
    
    let augmentedContext = chatContext;
    
    if (needsWebSearch(query)) {
      console.log("[AskGobi] Online lookup triggered for:", query);
      const web = await fetchOnlineData(query);
    
      if (web && web.length > 0) {
        augmentedContext += `
    
    Latest online lookup:
    ${web
      .map(
        (r: any, i: number) =>
          `(${i + 1}) [${r.title}](${r.link})\n${r.snippet}`
      )
      .join("\n\n")}
    `;
      }
    }
    

  const prompt = buildPrompt(query, augmentedContext);
  console.log(`[API] Streaming response for: "${query}"`);

  // 🚀 Wrap the full generation inside limit() so up to 4 can run concurrently
  return limit(async () => {
    const abortController = new AbortController();
    const timeout = setTimeout(() => {
      if (!abortController.signal.aborted) {
        abortController.abort();
        console.warn("[askLocal] Timeout — model aborted (60s limit).");
      }
    }, 60000);

    const port = getNextPort();
    console.log(`[AskGobi] Using Ollama port ${port} for "${query}"`);

    console.log(`[AskGobi] Sending "${query}" → port ${port}`);


    const remote = await fetch(`http://127.0.0.1:${port}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: abortController.signal,
      body: JSON.stringify({
        model: "phi3", // or "llama3" in testing
        prompt,
        stream: true,
        options: { temperature: 0.6, top_p: 0.9, num_predict: 150 },
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

    const response = new Response(
      new ReadableStream({
        async start(controller) {
          let accumulatedWords = 0;
          const MAX_WORDS = 180;
          let buffer = "";
          let closed = false;

          const safeClose = () => {
            if (!closed) {
              controller.close();
              closed = true;
              console.log("[askLocal] Stream closed cleanly ✅");
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
                      clearTimeout(timeout);
                      return;
                    }
                  }

                  accumulatedWords += (text.match(/\S+/g) || []).length;

                  const formatted = text
                  // Insert newline before bullet emojis only when NOT inside a markdown link
                  .replace(/(?<!\])([✅📜🌿🧠⚙️💡🌍])\s/g, "\n$1 ")
                
                  // Do NOT break after dots inside URLs
                  .replace(/(?<=[a-zA-Z0-9]\. )(?=[A-Z])/g, "\n");
                

                  controller.enqueue(
                    new TextEncoder().encode(
                      JSON.stringify({ response: formatted }) + "\n"
                    )
                  );

if (accumulatedWords % 20 === 0 && text.trim() !== "") {
  controller.enqueue(
    new TextEncoder().encode(JSON.stringify({ response: " " }) + "\n")
  );
}

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
            safeClose();
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

    return response;
  });
}