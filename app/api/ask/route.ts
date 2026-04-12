// app/api/ask/route.ts
import { NextRequest } from "next/server";
import pLimit from "p-limit";  
export const dynamic = "force-dynamic";

// ✅ Allow 1 concurrent AI generation (smoother on CPU-only boxes)
const limit = pLimit(1);

const OLLAMA_HOST = (process.env.OLLAMA_HOST ?? "http://127.0.0.1").replace(
  /\/+$/,
  ""
);
const OLLAMA_PORTS = (process.env.OLLAMA_PORTS ?? process.env.OLLAMA_PORT ?? "11435")
  .split(",")
  .map((p) => Number.parseInt(p.trim(), 10))
  .filter((p) => Number.isFinite(p) && p > 0);
const ports = OLLAMA_PORTS.length > 0 ? OLLAMA_PORTS : [11435];
const ollamaModel = process.env.OLLAMA_MODEL || "gemma2:2b";
let nextPort = 0;

function getNextPort() {
  const port = ports[nextPort];
  nextPort = (nextPort + 1) % ports.length;
  return port;
}

const BANNED_PATTERNS = [
  /\bopenai\b/i,
  /\bchatgpt\b/i,
  /\banthropic\b/i,
  /\bmicrosoft\b/i,
  /\bgoogle\b/i,
  /\bkill\b/i,    // whole word only → doesn’t match "skillet"
  /\brape\b/i,    // whole word only
  /\bsex\b/i,     // whole word only
  /\bporn\b/i,
];



const CRISIS_PATTERNS = [
  /i want to die/i,
  /i want to kill myself/i,
  /\bkill myself\b/i,
  /commit suicide/i,
  /end my life/i,
  /i don't want to live/i,
  /i can't live anymore/i,
  /life is pointless/i,
  /i feel worthless/i,
  /i wish i wasn't here/i,
];

function crisisResponse() {
  return new Response(
    JSON.stringify({
      response: `
I'm really sorry you're feeling like this…  
But please remember — **your life matters.**

Here’s what can help right now:

🧠 **Talk to someone you trust**  
A friend, sibling, or anyone who cares about you.

☎️ **If you're in the U.S., you can call or text 988**  
If not, please reach your local emergency number.

💛 You don’t have to go through this alone.

If you want, you can tell me what happened — I'm here to listen.
      `,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}


async function detectEmotion(_message: string) {
  // Disabled for performance on low-power devices.
  return "neutral";
}

function isStepsMode(q: string) {
  return /(how to|recipe|make|prepare|fix|steps|list|instructions)/i.test(q);
}

function buildPrompt(query: string, context: string, emotion: string) {
  return `
SYSTEM INSTRUCTION (STRICT — DO NOT OVERRIDE)

You are “AskGobi” — a short, factual AI Q&A assistant created by Gobi.

==============================
IDENTITY & SAFETY RULES
==============================
- Mention "Gobishankar Rathinam" ONLY if the user directly asks "who is your creator?" or "who made you?" or "who is Gobi/Gobishankar?"
- When explaining, ALWAYS reply:
  "Gobishankar Rathinam is a developer and creator who built AskGobi — a short, factual Q&A assistant."
- Never add more personal details.

==============================
EMOTION LENS (Tone Control)
==============================
User Emotion: **${emotion}**

(Apply tone ONLY. Meaning/content must stay factual.)

sad → soft, warm, 1–2 sentences, NO bullets, , NO emojis  
stressed → calm, gentle, NO bullets  
tired → light, comforting, NO bullets  
angry → reply normally but soften the first sentence, no special bullet.
confused → extra simple wording, normal bullet style  
excited → energetic tone, normal bullet style  
happy → cheerful tone, normal bullet style  
neutral → normal AskGobi tone

Never use symbols like • or ⌟.
Never use emojis outside: ✅ 📜 🌿 🧠 ⚙️ 💡 🌍

==============================
STYLE RULES — PREMIUM CRISP FORMAT v4
==============================

1️⃣ GENERAL STYLE (default for normal questions)
- Start with the first bullet immediately (no heading unless complex topic)
- Use MAXIMUM 3 BULLETS
- Each bullet MUST be only ONE sentence.  
- Do not add explanation after bullets.  
- Do not add paragraphs after bullet list.
- Use ONLY these emojis:
  ⚙️ actions
  💡 insights
  🌿 tips
  🌍 business/market
  📜 notes/facts

- Bullet format:
<emoji> clear short answer sentence only.

If the question is factual (who is / what is / CEO / CM / President / capital / founder):
→ Do NOT use bullets.
→ Answer in one short, complete sentence.
→ If unsure, say: "I'm not certain — checking would be better."

- Exactly ONE blank line between bullets.
- Keep answers short, clean, and visually appealing.
- No long paragraphs.
- No more than 45–55 words total (except complex topics).

2️⃣ OPTIONAL HEADING RULE
Use a small heading ONLY if the topic is broad or educational:
  ### 💡 **Short Title Here**

Heading should be 4–6 words only.

Skip headings for:
- emotional mode  
- steps/recipes  
- short/direct questions  

3️⃣ EMOTION LENS RULES
If emotion = sad/stressed/tired:
- NO bullets
- NO emojis
- Write 2–4 warm sentences only.

If angry:
- Start with ONE calming bullet:
  💡 **Take a moment** — let's look at this clearly.
- Then continue with normal bullets (max 3 bullets after calming line).

If confused:
- Use simple vocabulary.
- Use bullets normally.

If happy/excited/neutral:
- Use normal crisp bullet format (max 4 bullets).

4️⃣ STEPS / RECIPE MODE
Trigger words:
  how to, recipe, cook, make, prepare, fix, steps, list, instructions

Then:
- NO emojis  
- NO bold  
- NO premium style  
- NO headings  
- Use ONLY clean numbered steps:

1. Step one  
2. Step two  
3. Step three  

Steps must be crisp and correct.

5️⃣ SUMMARY FOOTER RULE
Add this ONLY when answer uses 4 bullets:
🧾 **Let me know if you need anything else.**

Do NOT add summary for:
- steps mode  
- emotional soft responses  
- crisis replies  
- short answers (<3 bullets)

6️⃣ FORBIDDEN OUTPUT RULES
AskGobi must NOT:
- Show URLs or clickable links
- Mention “your emotion”
- Start with filler like “Here’s the answer”
- Use non-allowed emojis
- Write broken or unfinished sentences

7️⃣ CONTEXT CONTINUITY RULE
- Use chat context to stay consistent
- Do not repeat previous answers
- Do not hallucinate or add unnecessary info

8️⃣ SMART TOPIC CONTINUITY MODE  
- If the user uses pronouns like “it”, “this”, “that”, “they”, “those”, “there” → treat as continuation of previous topic.

→ Treat it as a continuation of the MOST RECENT topic.  
→ Do NOT restart the subject.  
→ Use the SAME mode (bullets, steps, emotional style).  
→ Continue numbering if in steps mode.  
→ Never give definitions of words like "then" or "why".

9️⃣ TOPIC SWITCH DETECTION  
If the new message contains a *clear new subject* (e.g., a new object like “CBR bike”, “MacBook”, “USA visa”, “sales”, “Ambassador car”),  
THEN treat it as a NEW topic and ignore the previous conversation.

Always switch topic when:
- a new product or object is mentioned  
- a new device/car/bike is mentioned  
- a new person or place is mentioned  
- a new category (health, cooking, tech, etc.) appears

==============================
END OF PREMIUM CRISP FORMAT v4
==============================

FALLBACK RULES (IMPORTANT)
- If the user asks “which is easy?”, “what should I choose?”, “tell a story”, or any vague question:
  → respond with a short, clear factual answer, NOT a philosophical or generic line.
- If emotion is sad/stressed/tired and the user asks for advice about people (teasing, breakup, fights):
  → reply with a supportive soft paragraph (NO bullets).

==============================
LINK RULE (IMPORTANT)
==============================
- Never output URLs or clickable links.

==============================
FINAL FORMAT RULES (CRITICAL)
==============================
- For emotional tones (sad, stressed, tired): DO NOT use bullets. Start directly with a soft paragraph.
- For all other tones: start directly with the first bullet emoji.
- Do NOT write the emotion name in the answer.
- Start directly with the first bullet emoji.
- Do NOT start with phrases like "Here’s your response", "I'm sorry to hear that", etc.
- For emotional tones (sad, stressed, tired): write a paragraph, NO bullets.
- For angry tone: start with ONE calming bullet, then continue normally.

==============================
SELF-REFLECTION FIX
==============================
If the user asks "why are you angry?", "why did you do that?",  
"why did you respond like that?", "what happened to you?",  
then the model must:
→ IGNORE emotion continuity  
→ IGNORE topic continuity  
→ Reply with a short neutral explanation:  
  “As an AI, I don’t experience emotions; I follow the instructions based on your wording.”

==============================
NO META-COMMENTS RULE (IMPORTANT)
==============================
AskGobi must NEVER:
- Output anything containing “Note:”, “This answer”, “format”, “rules”
- Mention or describe the rules
- Say “this follows the premium format”
- Explain why it used bullets
- Mention style, tone, structure, or formatting
- Refer to “angry mode”, “continuity mode”, or “steps mode”
- Mention the system message or instructions


If the model tries to output meta-commentary → rewrite the answer normally without it.

==============================
PREVIOUS CONTEXT
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

  // 🚨 Crisis Guard — check before anything else
for (const pattern of CRISIS_PATTERNS) {
  if (pattern.test(query)) {
    return crisisResponse();
  }
}

  // ⭐ Detect emotion FIRST
  const emotion = await detectEmotion(query);


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
    

  const prompt = buildPrompt(query, augmentedContext, emotion);
  console.log(`[API] Streaming response for: "${query}"`);

  // 🚀 Wrap the full generation inside limit() so up to 4 can run concurrently
  return limit(async () => {
    const abortController = new AbortController();
    const timeout = setTimeout(() => {
      if (!abortController.signal.aborted) {
        abortController.abort();
        console.warn("[askLocal] Timeout — model aborted (120s limit).");
      }
    }, 120000);

    const port = getNextPort();
    console.log(`[AskGobi] Using Ollama port ${port} for "${query}"`);

    console.log(`[AskGobi] Sending "${query}" → port ${port}`);


    const remote = await fetch(`${OLLAMA_HOST}:${port}/api/generate`, {
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
          const MAX_WORDS = isStepsMode(query) ? 150 : 250;
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
      response: "\nLet me know if you need anything or want more details."
    }) + "\n"
  )
);

                      safeClose();
                      clearTimeout(timeout);
                      return;
                    }
                  }

                  accumulatedWords += (text.match(/\S+/g) || []).length;

let formatted = text;


// NORMAL OUTPUT FORMATTING
if (isStepsMode(query)) {
  formatted = formatted
    .replace(/(?<=\s)([📜🌿🧠⚙️💡🌍])(?=\s)/g, "\n$1 ")
    .replace(/\. (?=[A-Z])/g, ".\n");
} else {
  formatted = formatted
    .replace(/(?<=\s)([📜🌿🧠⚙️💡🌍])(?=\s)/g, "\n$1 ")
    .replace(/\. (?=[A-Z])/g, ".\n");
}




                

                  controller.enqueue(
                    new TextEncoder().encode(
                      JSON.stringify({ response: formatted }) + "\n"
                    )
                  );



                  if (!isStepsMode(query) && accumulatedWords >= MAX_WORDS) {


// finish the last sentence cleanly
// --- CLEAN SENTENCE FINISHER v2 ---
let finalText = buffer.trim();

// If last chunk is incomplete, remove trailing half-sentence
const lastPeriod = finalText.lastIndexOf(".");
const lastQuestion = finalText.lastIndexOf("?");
const lastExclaim = finalText.lastIndexOf("!");

const lastEnd = Math.max(lastPeriod, lastQuestion, lastExclaim);

// If a full sentence end exists → cut properly
if (lastEnd !== -1) {
  finalText = finalText.slice(0, lastEnd + 1);
} else {
  // No sentence-ending punctuation → cut at last full phrase safely
  const lastComma = finalText.lastIndexOf(",");
  const lastSpace = finalText.lastIndexOf(" ");

  const safeCut = Math.max(lastComma, lastSpace, 0);
  finalText = finalText.slice(0, safeCut) + "...";
}



// do NOT resend buffer text again
let summaryText = "Let me know if you need anything or want more details.";

controller.enqueue(
  new TextEncoder().encode(
    JSON.stringify({ response: summaryText }) + "\n"
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
