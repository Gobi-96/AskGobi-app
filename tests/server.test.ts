import test from "node:test";
import assert from "node:assert/strict";
import {
  createAskHandler,
  validateInput,
  buildPrompt,
  needsWebSearch,
} from "../lib/server/ask";
import {
  GenerationQueue,
  RateLimiter,
  readLimitedJson,
} from "../lib/server/limits";
import { consumeAnswer } from "../lib/ndjson";
const request = (body: unknown, signal?: AbortSignal) =>
  new Request("http://localhost/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
const streamResponse = (text = "Hello.") =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(c) {
        const bytes = new TextEncoder().encode(
          JSON.stringify({ response: text }) +
            "\n" +
            JSON.stringify({ done: true }) +
            "\n",
        );
        for (let i = 0; i < bytes.length; i += 3)
          c.enqueue(bytes.slice(i, i + 3));
        c.close();
      },
    }),
  );
const unlimited = () => new RateLimiter(1000);
test("input validation, history bounds, and challenge isolation", () => {
  for (const invalid of [
    null,
    [],
    {},
    { query: 42 },
    { query: " " },
    { query: "a".repeat(501) },
    { query: "hi", mode: "nope" },
    { query: "hi", onlineMode: "true" },
    { query: "hi", context: [{ question: 8, answer: "x" }] },
    { query: "hi", context: Array(4).fill({ question: "a", answer: "b" }) },
  ])
    assert.throws(() => validateInput(invalid));
  assert.deepEqual(
    validateInput({
      query: " today? ",
      mode: "challenge",
      onlineMode: true,
      context: [{ question: "secret", answer: "secret" }],
    }),
    { query: "today?", mode: "challenge", onlineMode: false, context: [] },
  );
  assert.equal(validateInput({ query: "hi" }).mode, "chat");
  assert.equal(needsWebSearch("What is the latest news?"), true);
  assert.equal(needsWebSearch("I knew the answer"), false);
  assert.match(
    buildPrompt(validateInput({ query: "hi", mode: "challenge" })),
    /No web search/,
  );
});
test("JSON body is size-limited and malformed data has controlled status", async () => {
  await assert.rejects(
    readLimitedJson(
      new Request("http://local", { method: "POST", body: "hello" }),
    ),
    { status: 415 },
  );
  await assert.rejects(
    readLimitedJson(
      new Request("http://local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
    ),
    { status: 400 },
  );
  await assert.rejects(
    readLimitedJson(request({ query: "x".repeat(100) }), 20),
    { status: 413 },
  );
});
test("queue admits one generation, bounds waiters, and releases only once", async () => {
  const queue = new GenerationQueue(1, 1);
  const signal = new AbortController().signal;
  const release = await queue.acquire(signal);
  let admitted = false;
  const waiting = queue.acquire(signal).then((r) => {
    admitted = true;
    return r;
  });
  await assert.rejects(queue.acquire(signal), { status: 429 });
  await Promise.resolve();
  assert.equal(admitted, false);
  release();
  release();
  const secondRelease = await waiting;
  assert.equal(admitted, true);
  secondRelease();
  (await queue.acquire(signal))();
});
test("aborted queued requests are removed and never acquire a slot", async () => {
  const queue = new GenerationQueue(1, 1);
  const release = await queue.acquire(new AbortController().signal);
  const abort = new AbortController();
  const waiting = queue.acquire(abort.signal);
  abort.abort();
  await assert.rejects(waiting);
  const next = queue.acquire(new AbortController().signal);
  release();
  (await next)();
});
test("rate limiter resets on expiry and isolates keys", () => {
  const limiter = new RateLimiter(2, 100);
  assert.equal(limiter.allow("one", 0), true);
  assert.equal(limiter.allow("one", 1), true);
  assert.equal(limiter.allow("one", 2), false);
  assert.equal(limiter.allow("two", 2), true);
  assert.equal(limiter.allow("one", 101), true);
});
test("challenge never searches or includes previous conversation even when requested", async () => {
  const calls: { url: string; body: any }[] = [];
  const handler = createAskHandler({
    limiter: unlimited(),
    fetch: (async (url, init) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      return streamResponse();
    }) as typeof fetch,
  });
  const response = await handler(
    request({
      query: "latest weather today",
      mode: "challenge",
      onlineMode: true,
      context: [{ question: "PRIVATE", answer: "SECRET" }],
    }),
  );
  assert.equal(await consumeAnswer(response, () => {}), "Hello.");
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /api\/generate/);
  assert.ok(!calls[0].body.prompt.includes("PRIVATE"));
  assert.ok(!calls[0].body.prompt.includes("SECRET"));
});
test("ordinary chat preserves explicit and automatic web search with bounded source context", async () => {
  for (const payload of [
    { query: "today's weather" },
    { query: "a plain question", onlineMode: true },
  ]) {
    const calls: string[] = [];
    const handler = createAskHandler({
      limiter: unlimited(),
      fetch: (async (url, init) => {
        calls.push(String(url));
        if (!init?.body)
          return Response.json({
            results: [
              {
                title: "Weather",
                snippet: "Sunny",
                url: "https://example.com",
              },
            ],
          });
        assert.match(JSON.parse(String(init.body)).prompt, /Sunny/);
        return streamResponse();
      }) as typeof fetch,
    });
    await consumeAnswer(await handler(request(payload)), () => {});
    assert.equal(calls.length, 2);
  }
});
test("failed search is disclosed to the model rather than represented as current facts", async () => {
  const handler = createAskHandler({
    limiter: unlimited(),
    fetch: (async (_url, init) => {
      if (!init?.body) return new Response(null, { status: 503 });
      assert.match(JSON.parse(String(init.body)).prompt, /Live lookup failed/);
      return streamResponse();
    }) as typeof fetch,
  });
  await consumeAnswer(
    await handler(request({ query: "latest news" })),
    () => {},
  );
});
test("HTTP failure, connection refusal, malformed and incomplete upstream streams are not successes", async () => {
  for (const upstream of [
    async () => new Response("not found", { status: 404 }),
    async () => {
      throw new Error("private-host:11435");
    },
    async () => new Response('{"response":"partial"}\n'),
    async () => new Response("malformed\n"),
    async () => new Response('{"error":"internal details"}\n'),
  ]) {
    const handler = createAskHandler({
      limiter: unlimited(),
      fetch: upstream as typeof fetch,
    });
    const response = await handler(request({ query: "hello" }));
    await assert.rejects(
      consumeAnswer(response, () => {}),
      (error) => {
        assert.ok(!String(error).includes("private-host"));
        return true;
      },
    );
  }
});
test("handler emits 400 and 429 without reaching Ollama", async () => {
  let calls = 0;
  const handler = createAskHandler({
    limiter: new RateLimiter(1),
    fetch: (async () => {
      calls++;
      return streamResponse();
    }) as typeof fetch,
  });
  assert.equal((await handler(request({ query: "" }))).status, 400);
  assert.equal((await handler(request({ query: "hi" }))).status, 429);
  assert.equal(calls, 0);
});
test("crisis replies bypass model and cannot become challenge verdicts", async () => {
  const handler = createAskHandler({
    limiter: unlimited(),
    fetch: (async () => {
      throw new Error("must not call model");
    }) as typeof fetch,
  });
  assert.match(
    await consumeAnswer(
      await handler(request({ query: "I want to die" })),
      () => {},
    ),
    /988/,
  );
  await assert.rejects(
    consumeAnswer(
      await handler(request({ query: "I want to die", mode: "challenge" })),
      () => {},
    ),
    /988/,
  );
});
test("deadline includes queue time and upstream wait", async () => {
  const queue = new GenerationQueue(1, 3);
  const release = await queue.acquire(new AbortController().signal);
  const handler = createAskHandler({
    queue,
    limiter: unlimited(),
    deadlineMs: 20,
    fetch: (async () => streamResponse()) as typeof fetch,
  });
  assert.equal((await handler(request({ query: "queued" }))).status, 504);
  release();
  const upstreamWait = createAskHandler({
    limiter: unlimited(),
    deadlineMs: 20,
    fetch: (async (_url, init) =>
      new Promise<Response>((_resolve, reject) =>
        init?.signal?.addEventListener(
          "abort",
          () => reject(init.signal?.reason),
          { once: true },
        ),
      )) as typeof fetch,
  });
  assert.equal((await upstreamWait(request({ query: "slow" }))).status, 504);
});
test("full stream owns the semaphore; cancellation aborts upstream then releases it", async () => {
  const queue = new GenerationQueue(1, 0);
  let upstreamAborted = false;
  let first = true;
  const handler = createAskHandler({
    queue,
    limiter: unlimited(),
    fetch: (async (_url, init) => {
      if (!first) return streamResponse("Next.");
      first = false;
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode('{"response":"partial"}\n'),
            );
            init?.signal?.addEventListener(
              "abort",
              () => {
                upstreamAborted = true;
                controller.error(new Error("aborted"));
              },
              { once: true },
            );
          },
        }),
      );
    }) as typeof fetch,
  });
  const firstResponse = await handler(request({ query: "hello" }));
  assert.equal((await handler(request({ query: "busy" }))).status, 429);
  await firstResponse.body!.cancel();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(upstreamAborted, true);
  assert.equal(
    await consumeAnswer(await handler(request({ query: "next" })), () => {}),
    "Next.",
  );
});
