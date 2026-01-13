// app/api/ask/route.ts
import { NextRequest } from "next/server";
import pLimit from "p-limit";  
export const dynamic = "force-dynamic";

// ✅ Allow up to 2 concurrent AI generations
const limit = pLimit(2);

const ports =
  process.env.OLLAMA_PORTS?.split(",")
    .map((p) => Number(p.trim()))
    .filter((p) => Number.isFinite(p) && p > 0) ?? [11434];
const ollamaModel = process.env.OLLAMA_MODEL || "phi3:mini";
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
SYSTEM INSTRUCTION (STRICT — DO NOT OVERRIDE)

You are “AskGobi” — a short, factual AI Q&A assistant created by Gobi.

==============================
IDENTITY & SAFETY RULES
==============================
- Mention "Gobishankar Rathinam" ONLY if explicitly asked.
- Never mention ChatGPT, OpenAI, Anthropic, Google, Microsoft.
- For harmful questions reply politely:
  "I'm sorry, my creator instructed not to discuss that."

==============================
STYLE RULES
==============================
- Answer in 3–6 bullet points.
- Each bullet starts with an emoji (✅ 📜 🌿 🧠 ⚙️ 💡 🌍).
- Bold key terms.
- Keep sentences short (<15 words).
- Max 180 words.
- End last bullet with a full sentence.

==============================
LINK RULE (IMPORTANT)
==============================
- Never output URLs or clickable links.
- If LIVE WEB RESULTS contain URLs, ignore them.
- You may use title + snippet only.

==============================
HOW TO USE DATA
==============================
- You may use OFFLINE KNOWLEDGE freely.
- If LIVE WEB RESULTS exist, treat them as MORE RECENT.
- But you may combine BOTH offline + live data for the best answer.
- If live data conflicts, choose the live one.

==============================
PREVIOUS CONTEXT (optional)
==============================
${context}

==============================
USER QUESTION
==============================
${query}

Now answer clearly following all rules.
`;
}

export async function POST(req: NextRequest) {
  const { query, context = [], onlineMode = false } = await req.json();

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
    const workerUrl = `https://askgobi-search.gobishankar-rathinam.workers.dev/?q=${encodeURIComponent(q)}`;

    console.log("[AskGobi] Fetching Worker URL:", workerUrl);

    const res = await fetch(workerUrl);
    if (!res.ok) {
      console.error("Worker returned error:", res.status);
      return null;
    }

    const data = await res.json();
    return data?.results?.slice(0, 3) || null;
  } catch (e) {
    console.error("Online search error:", e);
    return null;
  }
}

    
    
function needsWebSearch(q: string) {
  return /today|latest|recent|version|online|live|now|current|new|news|update|price|weather|trending|launch|launched|release|released|announced/i.test(q);
}
   
   // ⭐ Final decision: auto mode OR manual toggle
const mustSearchOnline = onlineMode || needsWebSearch(query);
 
    let augmentedContext = chatContext;
    


if (mustSearchOnline) {
  const web = await fetchOnlineData(query);

  if (web && web.length > 0) {
    const liveBlock = web
      .map((r: any, i: number) => `(${i + 1}) ${r.title}\n${r.snippet}`)
      .join("\n\n");

    augmentedContext += `

[LiveData]
${liveBlock}
[/LiveData]

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
        model: ollamaModel,
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
