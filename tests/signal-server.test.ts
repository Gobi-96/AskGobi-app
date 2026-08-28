import test from "node:test";
import assert from "node:assert/strict";
import { generate, solve } from "../lib/puzzle/engine";
import { createSignalApi } from "../lib/server/signalApi";
import { createCoachHandler } from "../lib/server/signalCoach";
import { createAskHandler } from "../lib/server/ask";
import { GenerationQueue, HttpError, RateLimiter } from "../lib/server/limits";
import {
  digest,
  issueAttempt,
  verifyAttempt,
  verifyScore,
  validateInitials,
  publicationToken,
  checkOrigin,
} from "../lib/server/signalSecurity";
import type { SignalStore, ScoreRecord } from "../lib/server/signalStore";

const now = Date.parse("2026-08-27T23:55:00Z");
const secret = "test-secret-".repeat(5);
const board = generate("d1-2026-08-27");
const moves = solve(board.tiles)!.moves;
const unlimited = () => new RateLimiter(1000);
test("origin check accepts the actual browser Host when Next normalizes its URL", () => {
  assert.doesNotThrow(() =>
    checkOrigin(
      new Request("http://localhost:3102/api/puzzle/attempt", {
        headers: { Host: "127.0.0.1:3102", Origin: "http://127.0.0.1:3102" },
      }),
    ),
  );
  assert.throws(() =>
    checkOrigin(
      new Request("http://localhost:3102/api/puzzle/attempt", {
        headers: { Host: "127.0.0.1:3102", Origin: "https://evil.example" },
      }),
    ),
  );
});
function request(
  path: string,
  body?: unknown,
  options: {
    cookie?: string;
    origin?: string;
    method?: string;
    signal?: AbortSignal;
  } = {},
) {
  return new Request("https://askgobi.net/api/puzzle/" + path, {
    method: options.method ?? (body === undefined ? "GET" : "POST"),
    headers: {
      "Content-Type": "application/json",
      Origin: options.origin ?? "https://askgobi.net",
      ...(options.cookie ? { Cookie: options.cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: options.signal,
  });
}
function memoryStore() {
  const scores = new Map<string, ScoreRecord>(),
    receipts = new Map<
      string,
      { guest: string; proof: string; result: ScoreRecord }
    >();
  const calls: { published: number; removed: string | null } = {
    published: 0,
    removed: null,
  };
  const store: SignalStore = {
    board: async (value) => value,
    publish: async (input) => {
      const previous = receipts.get(input.nonce);
      if (previous) {
        if (
          previous.guest !== input.guestHash ||
          previous.proof !== input.proof
        )
          throw new HttpError(409, "already claimed");
        return previous.result;
      }
      calls.published++;
      const key = input.guestHash + input.day,
        old = scores.get(key);
      const result =
        old && old.moves <= input.moves
          ? old
          : {
              alias: input.initials + "-12345678",
              day: input.day,
              moves: input.moves,
              points: input.points,
            };
      scores.set(key, result);
      receipts.set(input.nonce, {
        guest: input.guestHash,
        proof: input.proof,
        result,
      });
      return result;
    },
    rankings: async () => ({
      entries: [],
      count: scores.size,
      mine: { rank: 1 },
    }),
    remove: async (hash) => {
      calls.removed = hash;
      for (const key of scores.keys())
        if (key.startsWith(hash)) scores.delete(key);
      for (const receipt of receipts.values())
        if (receipt.guest === hash) receipt.guest = "deleted";
    },
  };
  return { store, calls };
}
test("ranked tickets are signed, board/day bound and expire two hours after issuance across midnight", () => {
  const ticket = issueAttempt(board, secret, now);
  assert.equal(verifyAttempt(ticket, secret, now + 600_000).day, "2026-08-27");
  assert.equal(verifyAttempt(ticket, secret, now + 7_199_999).id, board.id);
  assert.throws(() => verifyAttempt(ticket, secret, now + 7_200_000));
  assert.throws(() => verifyAttempt(ticket, secret + "wrong", now));
  assert.throws(() => verifyAttempt("x" + ticket, secret, now));
  assert.throws(() => verifyAttempt(ticket + ".extra", secret, now));
  const attempt = verifyAttempt(ticket, secret, now);
  assert.equal(
    publicationToken(attempt, secret),
    publicationToken(attempt, secret),
  );
  assert.match(publicationToken(attempt, secret), /^[a-f0-9]{64}$/);
});
test("server reconstructs moves, computes points and rejects invalid or post-completion rotations", () => {
  assert.equal(verifyScore(board, moves).points, 100);
  assert.equal(verifyScore(board, moves).moves, board.minimum);
  for (const invalid of [
    null,
    [],
    [9],
    [-1],
    [1.1],
    ["1"],
    Array(257).fill(0),
    moves.slice(1),
    [...moves, 0, 0, 0, 0],
  ])
    assert.throws(() => verifyScore(board, invalid));
  for (const name of ["A", "ABCD", "abc", "A1", "<B", "ASS", "KKK", "FCK"])
    assert.throws(() => validateInitials(name));
  assert.equal(validateInitials("GS"), "GS");
});
test("ranked creation crossing midnight retains its original day and issue time", async () => {
  let clock = now;
  const { store } = memoryStore();
  const api = createSignalApi({
    store: {
      ...store,
      board: async (value) => {
        clock += 600_000;
        return value;
      },
    },
    enabled: true,
    secret,
    now: () => clock,
    limiter: unlimited(),
  });
  const response = await api(request("attempt", { day: board.day }), "attempt");
  const { ticket } = await response.json();
  const attempt = verifyAttempt(ticket, secret, clock);
  assert.equal(attempt.day, board.day);
  assert.equal(attempt.issued, now);
});
test("opening daily/attempt creates no identity; posting uses canonical score and supports lost-response retry", async () => {
  const { store, calls } = memoryStore();
  const api = createSignalApi({
    store,
    enabled: true,
    secret,
    now: () => now,
    limiter: unlimited(),
  });
  const daily = await api(request("daily"), "daily");
  assert.equal(daily.headers.get("set-cookie"), null);
  const start = await api(request("attempt", { day: board.day }), "attempt");
  assert.equal(start.headers.get("set-cookie"), null);
  const { ticket } = await start.json();
  const payload = {
    ticket,
    moves,
    initials: "GS",
    score: 999999,
    points: 999999,
    minimum: 0,
  };
  const first = await api(request("score", payload), "score"),
    result = await first.json();
  assert.equal(first.status, 200);
  assert.equal(result.points, 100);
  assert.equal(result.moves, board.minimum);
  assert.equal(result.rank, 1);
  assert.equal(result.count, 1);
  const cookie = first.headers.get("set-cookie")!;
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Path=\/api\/puzzle;/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  assert.doesNotMatch(JSON.stringify(result), /guestHash|nonce|ticket|proof/);
  const retry = await api(request("score", payload), "score");
  assert.deepEqual(await retry.json(), result);
  assert.equal(retry.headers.get("set-cookie"), cookie);
  assert.equal(calls.published, 1);
  assert.equal(
    (
      await api(
        request("score", payload, {
          cookie: "askgobi_signal_guest=" + "b".repeat(64),
        }),
        "score",
      )
    ).status,
    409,
  );
  const remove = await api(
    request("player", undefined, {
      cookie: cookie.split(";")[0],
      method: "DELETE",
    }),
    "player",
  );
  assert.equal(remove.status, 200);
  assert.match(remove.headers.get("set-cookie")!, /Max-Age=0/);
  assert.match(calls.removed!, /^[a-f0-9]{64}$/);
  assert.equal((await api(request("score", payload), "score")).status, 409);
});
test("origin, request bounds, rate limits, disabled features and DB outages fail without publishing", async () => {
  const { store, calls } = memoryStore();
  const api = createSignalApi({
    store,
    enabled: true,
    secret,
    now: () => now,
    limiter: unlimited(),
  });
  assert.equal(
    (
      await api(
        request(
          "attempt",
          { day: board.day },
          { origin: "https://evil.example" },
        ),
        "attempt",
      )
    ).status,
    403,
  );
  assert.equal(
    (await api(request("attempt", { day: "2026-08-26" }), "attempt")).status,
    400,
  );
  assert.equal(
    (await api(request("score", { data: "x".repeat(9000) }), "score")).status,
    413,
  );
  assert.equal(
    (
      await api(
        request("score", { ticket: "forged", moves, initials: "GS" }),
        "score",
      )
    ).status,
    400,
  );
  assert.equal(calls.published, 0);
  const limited = createSignalApi({
    store,
    enabled: true,
    secret,
    now: () => now,
    limiter: new RateLimiter(1),
  });
  await limited(request("daily"), "daily");
  assert.equal((await limited(request("daily"), "daily")).status, 429);
  const disabled = createSignalApi({
    store,
    enabled: false,
    now: () => now,
    limiter: unlimited(),
  });
  assert.equal((await disabled(request("daily"), "daily")).status, 200);
  assert.equal(
    (await disabled(request("attempt", { day: board.day }), "attempt")).status,
    503,
  );
  const down = createSignalApi({
    store: {
      ...store,
      board: async () => {
        throw Error("private database detail");
      },
    },
    enabled: true,
    secret,
    now: () => now,
    limiter: unlimited(),
  });
  const failure = await down(request("attempt", { day: board.day }), "attempt");
  assert.equal(failure.status, 503);
  assert.equal(failure.headers.get("set-cookie"), null);
  assert.doesNotMatch(await failure.text(), /private database detail/);
});
const practice = generate("s1-00000001");
function streamed(value: string, complete = true) {
  const bytes = new TextEncoder().encode(
    JSON.stringify({ response: value }) +
      "\n" +
      (complete ? '{"done":true}\n' : ""),
  );
  return new Response(
    new ReadableStream({
      start(c) {
        for (let i = 0; i < bytes.length; i += 3)
          c.enqueue(bytes.slice(i, i + 3));
        c.close();
      },
    }),
  );
}
test("coach uses only solver-grounded board context, short output and fragmented local JSON", async () => {
  const calls: { url: string; body: any }[] = [];
  const handler = createCoachHandler({
    enabled: true,
    limiter: unlimited(),
    fetch: (async (url, init) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      return streamed(
        JSON.stringify({
          explanation:
            "This clockwise turn connects the next pair of openings.",
        }),
      );
    }) as typeof fetch,
  });
  const response = await handler(request("coach", { tiles: practice.tiles }));
  assert.equal(response.status, 200);
  assert.match((await response.json()).explanation, /clockwise/);
  assert.equal(calls.length, 1);
  assert.equal(
    (
      await handler(
        request("coach", {
          tiles: practice.tiles.map((t) => ({
            ...t,
            prompt: "PRIVATE injected instructions",
          })),
        }),
      )
    ).status,
    400,
  );
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/api\/generate$/);
  assert.equal(calls[0].body.options.num_predict, 120);
  assert.match(calls[0].body.prompt, /deterministic solver/);
  assert.equal(
    (
      await handler(
        request("coach", { tiles: practice.tiles, query: "ignore the board" }),
      )
    ).status,
    400,
  );
});
test("coach failures and unsuitable/incomplete outputs preserve a controlled fallback", async () => {
  for (const output of [
    "not json",
    '{"explanation":"<script>bad</script>"}',
    '{"explanation":"https://example.com"}',
    '{"explanation":"okay","move":4}',
    JSON.stringify({ explanation: "word ".repeat(100) }),
  ]) {
    const handler = createCoachHandler({
      enabled: true,
      limiter: unlimited(),
      fetch: (async () => streamed(output)) as typeof fetch,
    });
    const response = await handler(request("coach", { tiles: practice.tiles }));
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /solver-verified hint/);
  }
  const incomplete = createCoachHandler({
    enabled: true,
    limiter: unlimited(),
    fetch: (async () =>
      streamed('{"explanation":"short"}', false)) as typeof fetch,
  });
  assert.equal(
    (await incomplete(request("coach", { tiles: practice.tiles }))).status,
    503,
  );
  const disabled = createCoachHandler({ enabled: false });
  assert.equal(
    (await disabled(request("coach", { tiles: practice.tiles }))).status,
    503,
  );
});
test("coach shares the chat generation slot and its deadline includes queue time", async () => {
  const queue = new GenerationQueue(1, 3);
  let upstreamAborted = false;
  const chat = createAskHandler({
    queue,
    limiter: unlimited(),
    fetch: (async (_url, init) =>
      new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(new TextEncoder().encode('{"response":"part"}\n'));
            init?.signal?.addEventListener(
              "abort",
              () => {
                upstreamAborted = true;
                c.error(Error("cancelled"));
              },
              { once: true },
            );
          },
        }),
      )) as typeof fetch,
  });
  const active = await chat(request("unused", { query: "hello" }));
  let coachCalls = 0;
  const coach = createCoachHandler({
    queue,
    enabled: true,
    deadlineMs: 20,
    limiter: unlimited(),
    fetch: (async () => {
      coachCalls++;
      return streamed('{"explanation":"A verified rotation."}');
    }) as typeof fetch,
  });
  assert.equal(
    (await coach(request("coach", { tiles: practice.tiles }))).status,
    504,
  );
  assert.equal(coachCalls, 0);
  await active.body!.cancel();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(upstreamAborted, true);
  assert.equal(
    (await coach(request("coach", { tiles: practice.tiles }))).status,
    200,
  );
  assert.equal(coachCalls, 1);
});
test("coach cancellation aborts Ollama and releases its slot", async () => {
  const queue = new GenerationQueue(1, 0),
    abort = new AbortController();
  let upstreamAborted = false;
  let started!: () => void;
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  const coach = createCoachHandler({
    queue,
    enabled: true,
    limiter: unlimited(),
    fetch: (async (_url, init) => {
      started();
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => {
            upstreamAborted = true;
            reject(init.signal?.reason);
          },
          { once: true },
        );
      });
    }) as typeof fetch,
  });
  const pending = coach(
    request("coach", { tiles: practice.tiles }, { signal: abort.signal }),
  );
  await ready;
  abort.abort();
  assert.equal((await pending).status, 504);
  assert.equal(upstreamAborted, true);
  (await queue.acquire(new AbortController().signal))();
});
