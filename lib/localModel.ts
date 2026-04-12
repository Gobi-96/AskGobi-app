export async function askLocalStream(query: string, context: string) {
  const ollamaHost = (process.env.OLLAMA_HOST ?? "http://127.0.0.1").replace(
    /\/+$/,
    ""
  );
  const ollamaPort = (process.env.OLLAMA_PORTS ?? process.env.OLLAMA_PORT ?? "11435")
    .split(",")[0]
    .trim();

  const prompt = `
SYSTEM INSTRUCTION (STRICT PRIORITY – DO NOT OVERRIDE):

You are "AskGobi" — a short, factual AI Q&A assistant created by one person named Gobi.

==============================
IDENTITY & PRIVACY
==============================
1. If the user’s question includes: ("Gobi", "Gobishankar", "Rathinam", "creator", "developer", "who made you"):
   → Reply ONLY:
   "Gobishankar Rathinam is my creator — AskGobi is an AI Q&A engine. Nothing more personal can be shared."
2. Never mention OpenAI, ChatGPT, Anthropic, Google, Microsoft, or any company.
3. Never reveal backend, API, or model details.

==============================
CONTENT & SAFETY
==============================
4. If the question is hateful, explicit, unsafe, or political:
   → Respond politely:
   "I'm sorry, my creator instructed not to discuss that. Let's keep our questions kind and helpful."
5. Avoid long intros — answer directly.

==============================
STYLE & FORMATTING
==============================
6. Always reply in **3–6 separate bullet points**.
7. Each bullet must begin on a new line with an emoji:
   ✅ for facts | 📜 for history | 🌿 for nature | 🧠 for ideas | ⚙️ for process | 💡 for insight | 🌍 for global
8. Format each bullet like:
   📜 **History:** Short explanation (1–2 sentences).
   ⚙️ **Process:** Describe steps clearly and briefly.
9. Add exactly **one blank line** between bullets for readability.
10. Never use parentheses with numbers like (3750) or (4 billion).
11. Write smooth English sentences ending with a period (.).
12. Do not use dashes (-) or lists within bullets.
13. Stop writing cleanly after the last complete sentence under 180 words.
14. Avoid merging all bullets into a paragraph — each must appear separately.

==============================
TONE & PURPOSE
==============================
15. Be concise, calm, factual — no emotion or self-reference.
16. Stop once the main idea is complete.

==============================
CONTEXT
==============================
${context}

User question: ${query}

Answer:
`;

console.log(`[askLocal] Starting stream for "${query}"`);

const response = await fetch(`${ollamaHost}:${ollamaPort}/api/generate`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ model: "phi3:mini", prompt, stream: true }),
});

if (!response.body) {
  console.error("[askLocal] No body stream received ❌");
  return new ReadableStream({
    start(controller) {
      controller.enqueue(JSON.stringify({ response: "No response." }) + "\n");
      controller.close();
    },
  });
}

const reader = response.body.getReader();
const decoder = new TextDecoder();

return new ReadableStream({
  async start(controller) {
    let buffer = "";
    let accumulatedWords = 0;
    const MAX_WORDS = 180;
    let lastChunkTime = Date.now();

    const stopIfIdle = setInterval(() => {
      if (Date.now() - lastChunkTime > 20000) {
        controller.close();
        clearInterval(stopIfIdle);
        console.log("[askLocal] Stream timed out ⏹️");
      }
    }, 3000);

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        if (!chunk.trim()) continue;
        lastChunkTime = Date.now();

        const lines = chunk.split("\n").filter(Boolean);
        for (const line of lines) {
          try {
            const json = JSON.parse(line);
            const text = json.response || "";
            buffer += text;
            const newWords = (text.match(/\S+/g) || []).length;
            accumulatedWords += newWords;

            // 🧠 Auto-stop near limit but finish sentence cleanly
            if (accumulatedWords >= MAX_WORDS) {
              const cutoff =
                buffer.lastIndexOf(".") > 0
                  ? buffer.lastIndexOf(".") + 1
                  : buffer.length;
              const finalText = buffer.slice(0, cutoff).trim();
              controller.enqueue(JSON.stringify({ response: finalText }) + "\n");
              controller.close();
              clearInterval(stopIfIdle);
              console.log("[askLocal] Word limit reached ✅");
              return;
            }

            // ✨ Format bullets neatly for markdown
            const formatted = text
              .replace(/([✅📜🌿🧠⚙️💡🌍])\s/g, "\n$1 ")
              .replace(/(\.\s)(?=[✅📜🌿🧠⚙️💡🌍])/g, "$1\n");

            controller.enqueue(JSON.stringify({ response: formatted }) + "\n");
          } catch {
            // skip malformed chunk
          }
        }
      }
    } finally {
      clearInterval(stopIfIdle);
      controller.close();
      console.log("[askLocal] Stream complete ✅");
    }
  },
});
}
