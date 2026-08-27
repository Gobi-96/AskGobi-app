import { createHmac, randomBytes } from "node:crypto";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "unavailable",
  ) {
    super(message);
  }
}
type Waiter = {
  resolve: (release: () => void) => void;
  reject: (reason: unknown) => void;
  signal: AbortSignal;
  abort: () => void;
};
export class GenerationQueue {
  private active = 0;
  private waiting: Waiter[] = [];
  constructor(
    private capacity = 1,
    private maxWaiting = 3,
  ) {}
  acquire(signal: AbortSignal): Promise<() => void> {
    if (signal.aborted) return Promise.reject(signal.reason);
    if (this.active < this.capacity) {
      this.active++;
      return Promise.resolve(this.release());
    }
    if (this.waiting.length >= this.maxWaiting)
      return Promise.reject(
        new HttpError(
          429,
          "The tiny AI is busy. Try a surprise, or come back in a moment.",
          "busy",
        ),
      );
    return new Promise((resolve, reject) => {
      const waiter: Waiter = {
        resolve,
        reject,
        signal,
        abort: () => {
          this.waiting = this.waiting.filter((item) => item !== waiter);
          reject(signal.reason);
        },
      };
      this.waiting.push(waiter);
      signal.addEventListener("abort", waiter.abort, { once: true });
    });
  }
  private release() {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active--;
      const next = this.waiting.shift();
      if (next) {
        next.signal.removeEventListener("abort", next.abort);
        this.active++;
        next.resolve(this.release());
      }
    };
  }
}

export class RateLimiter {
  private buckets = new Map<string, { count: number; expires: number }>();
  constructor(
    private count: number,
    private windowMs = 60_000,
  ) {}
  allow(key: string, now = Date.now()): boolean {
    for (const [id, bucket] of this.buckets)
      if (bucket.expires <= now) this.buckets.delete(id);
    const bucket = this.buckets.get(key);
    if (bucket) {
      if (bucket.count >= this.count) return false;
      bucket.count++;
      return true;
    }
    if (this.buckets.size >= 10_000) return false;
    this.buckets.set(key, { count: 1, expires: now + this.windowMs });
    return true;
  }
}

const ephemeralKey = randomBytes(32);
export function clientBucket(req: Request) {
  // Enable only when the origin is reachable exclusively through your tunnel.
  // Never trust arbitrary X-Forwarded-For values from direct internet clients.
  const ip =
    process.env.TRUST_CLOUDFLARE_PROXY === "true"
      ? req.headers.get("cf-connecting-ip")
      : null;
  return createHmac("sha256", ephemeralKey)
    .update(ip || "shared-untrusted-origin")
    .digest("hex");
}

export async function readLimitedJson(
  req: Request,
  maxBytes = 16_384,
  signal = req.signal,
): Promise<unknown> {
  if (!req.headers.get("content-type")?.includes("application/json"))
    throw new HttpError(415, "Send JSON content.", "invalid_request");
  if (Number(req.headers.get("content-length")) > maxBytes)
    throw new HttpError(413, "Request is too large.", "invalid_request");
  if (!req.body)
    throw new HttpError(400, "Missing request body.", "invalid_request");
  const reader = req.body.getReader();
  const onAbort = () => {
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener("abort", onAbort, { once: true });
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new HttpError(413, "Request is too large.", "invalid_request");
      }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } catch (err) {
    if (signal.aborted) throw signal.reason;
    if (err instanceof HttpError) throw err;
    throw new HttpError(400, "Invalid JSON body.", "invalid_request");
  } finally {
    signal.removeEventListener("abort", onAbort);
    reader.releaseLock();
  }
}
