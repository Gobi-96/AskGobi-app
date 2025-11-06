import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

export async function askModel(prompt: string, context: string) {
  const system = `You are AskGobi, a helpful, factual assistant. 
- Always cite with [[index]] markers matching the provided sources when relevant.
- If information is uncertain, clearly say so.`;

  const completion = await groq.chat.completions.create({
    model: "llama3-70b-8192",
    messages: [
      { role: "system", content: system },
      { role: "user", content: `Question: ${prompt}

Context:
${context}` }
    ],
    temperature: 0.2,
  });

  return completion.choices[0]?.message?.content ?? "";
}
