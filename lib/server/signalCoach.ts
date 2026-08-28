import { hint, validateTiles } from "../puzzle/engine";
import { readNdjson } from "../ndjson";
import {
  GenerationQueue,
  HttpError,
  RateLimiter,
  clientBucket,
  readLimitedJson,
} from "./limits";
import { checkOrigin } from "./signalSecurity";
import { generationQueue } from "./generation";
export function createCoachHandler(
  deps: {
    fetch?: typeof fetch;
    queue?: GenerationQueue;
    enabled?: boolean;
    deadlineMs?: number;
    limiter?: RateLimiter;
  } = {},
) {
  const fetcher = deps.fetch ?? fetch,
    queue = deps.queue ?? generationQueue,
    limiter = deps.limiter ?? new RateLimiter(3);
  return async (req: Request) => {
    const abort = new AbortController();
    const cancel = () => abort.abort();
    req.signal.addEventListener("abort", cancel, { once: true });
    if (req.signal.aborted) abort.abort();
    const timer = setTimeout(() => abort.abort(), deps.deadlineMs ?? 20_000);
    let release: (() => void) | undefined;
    try {
      checkOrigin(req);
      if (!(deps.enabled ?? process.env.SIGNAL_COACH_ENABLED === "true"))
        throw new HttpError(
          503,
          "AI explanations are not enabled. The verified hint still works.",
        );
      if (!limiter.allow(clientBucket(req)))
        throw new HttpError(
          429,
          "Give the small AI a moment. The verified hint is already ready.",
        );
      const body = await readLimitedJson(req, 2048, abort.signal);
      if (!body || typeof body !== "object" || Array.isArray(body))
        throw new HttpError(400, "Invalid puzzle position.");
      const value = body as Record<string, unknown>;
      if (Object.keys(value).length !== 1 || !validateTiles(value.tiles))
        throw new HttpError(400, "Invalid puzzle position.");
      const verified = hint(value.tiles);
      if (!verified) throw new HttpError(400, "This board has no next hint.");
      release = await queue.acquire(abort.signal);
      abort.signal.throwIfAborted();
      const host = (process.env.OLLAMA_HOST ?? "http://127.0.0.1").replace(
        /\/$/,
        "",
      );
      const port = (
        process.env.OLLAMA_PORTS ??
        process.env.OLLAMA_PORT ??
        "11435"
      ).split(",")[0];
      const upstream = await fetcher(`${host}:${port}/api/generate`, {
        method: "POST",
        signal: abort.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.OLLAMA_MODEL ?? "gemma2:2b",
          stream: true,
          format: "json",
          options: { temperature: 0.2, num_predict: 120 },
          prompt: `You explain a small connection puzzle. Return only JSON with one key "explanation", at most 60 words. Explain the verified hint in plain language. Do not invent a different move, use external information, or claim that the AI found the solution. The deterministic solver did. Tiles rotate clockwise and connected openings carry a signal from left-middle to right-middle. Verified hint: ${JSON.stringify(verified)}. Board, rows top to bottom: ${JSON.stringify(value.tiles)}.`,
        }),
      });
      if (!upstream.ok || !upstream.body)
        throw new HttpError(
          503,
          "The local AI is unavailable. Use the verified hint.",
        );
      let text = "",
        done = false;
      for await (const event of readNdjson<{
        response?: string;
        done?: boolean;
        error?: string;
      }>(upstream.body)) {
        abort.signal.throwIfAborted();
        if (event.error) throw Error("upstream");
        if (typeof event.response === "string") text += event.response;
        if (text.length > 2000) throw Error("too_long");
        if (event.done) {
          done = true;
          break;
        }
      }
      if (!done) throw Error("incomplete");
      const parsed = JSON.parse(text);
      if (
        Object.keys(parsed).length !== 1 ||
        typeof parsed.explanation !== "string" ||
        !parsed.explanation.trim() ||
        parsed.explanation.length > 700 ||
        parsed.explanation.trim().split(/\s+/).length > 80 ||
        /[<>]|https?:\/\//i.test(parsed.explanation)
      )
        throw Error("unsuitable");
      return Response.json(
        { explanation: parsed.explanation },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch (error) {
      const controlled =
        error instanceof HttpError
          ? error
          : new HttpError(
              abort.signal.aborted ? 504 : 503,
              "The local AI couldn’t explain this move. The solver-verified hint still works.",
            );
      return Response.json(
        { error: controlled.message },
        { status: controlled.status, headers: { "Cache-Control": "no-store" } },
      );
    } finally {
      abort.abort();
      clearTimeout(timer);
      req.signal.removeEventListener("abort", cancel);
      release?.();
    }
  };
}
