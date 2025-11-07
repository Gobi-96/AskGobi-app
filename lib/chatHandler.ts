import { askLocalStream } from "./localModel";

// 🧠 Store the last 5 turns of conversation
const chatHistory: string[] = [];

// Wrapper to manage context & handle streaming
export async function ask(query: string): Promise<string> {
  console.log(`[AskGobi] New question: ${query}`);

  // Prepare context from recent history
  const context = chatHistory.join("\n");
  const stream = await askLocalStream(query, context);

  let fullResponse = "";
  const reader = stream.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    try {
      const json = JSON.parse(chunk);
      const text = json.response || "";
      fullResponse += text;

      // optional: print streaming chunks to console
      process.stdout.write(text);
    } catch {
      continue;
    }
  }

  // Store new Q&A in history (keep last 5)
  chatHistory.push(`User: ${query}\nAskGobi: ${fullResponse}`);
  if (chatHistory.length > 5) chatHistory.shift();

  console.log("\n[AskGobi] Response complete ✅");
  return fullResponse.trim();
}
