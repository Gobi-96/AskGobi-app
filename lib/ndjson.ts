// Both Ollama and our API may split a JSON line (or a UTF-8 character) anywhere.
export async function* readNdjson<T>(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<T> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let ended = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      pending += done
        ? decoder.decode()
        : decoder.decode(value, { stream: true });
      if (pending.length > 1_048_576)
        throw new Error("Stream record too large");
      let newline: number;
      while ((newline = pending.indexOf("\n")) !== -1) {
        const line = pending.slice(0, newline).trim();
        pending = pending.slice(newline + 1);
        if (line) yield JSON.parse(line) as T;
      }
      if (done) {
        ended = true;
        break;
      }
    }
    if (pending.trim()) yield JSON.parse(pending) as T;
  } finally {
    if (!ended) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
export type AskEvent =
  | { type: "delta"; response: string }
  | { type: "complete"; response?: string }
  | { type: "error"; error: string; code: string };

export async function consumeAnswer(
  response: Response,
  onText: (text: string) => void,
): Promise<string> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      body.error || "The tiny AI is unavailable. Try a surprise instead.",
    );
  }
  if (!response.body) throw new Error("No answer stream received.");
  let text = "";
  let completed = false;
  for await (const event of readNdjson<AskEvent>(response.body)) {
    if (event.type === "error") throw new Error(event.error);
    if ("response" in event && event.response) {
      text += event.response;
      onText(text);
    }
    if (event.type === "complete") {
      completed = true;
      break;
    }
  }
  if (!completed || !text.trim())
    throw new Error("The answer was interrupted. Please try again.");
  return text.trim();
}
