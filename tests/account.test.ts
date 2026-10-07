import test from "node:test";
import assert from "node:assert/strict";
import { validateProgress } from "../lib/server/progressApi";
import { accountUser } from "../lib/server/account";
import { generate, solve } from "../lib/puzzle/engine";
import { validateInput, buildPrompt } from "../lib/server/ask";
test("saved scores require a valid completed replay, never a claimed count", () => {
  const board = generate("d1-2026-10-07");
  assert.throws(() =>
    validateProgress({ puzzleId: board.id, moves: 6, points: 100 }),
  );
  assert.throws(() => validateProgress({ puzzleId: board.id, moves: [0] }));
  assert.ok(
    validateProgress({ puzzleId: board.id, moves: solve(board.tiles)!.moves })
      .board,
  );
  assert.throws(() => validateProgress({ cardId: "invented-card" }));
  assert.deepEqual(
    validateProgress({ cardId: "quiz-race", user_id: "forged" }),
    { cardId: "quiz-race" },
  );
});
test("context uses a known public card and challenges ignore it", () => {
  const input = validateInput({
    query: "Why?",
    cardId: "quiz-race",
    card: { prompt: "FORGED-CARD" },
  });
  assert.match(buildPrompt(input), /quiz-race/);
  assert.doesNotMatch(buildPrompt(input), /FORGED-CARD/);
  assert.equal(
    validateInput({ query: "Why?", cardId: "fake" }).cardId,
    undefined,
  );
  assert.equal(
    validateInput({ query: "Why?", mode: "challenge", cardId: "quiz-race" })
      .cardId,
    undefined,
  );
});
test("account identity is obtained from Auth, not the request body", async () => {
  const old = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    db: process.env.SUPABASE_URL,
  };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_URL = "https://example.supabase.co";
  try {
    assert.equal(await accountUser(new Request("http://localhost/")), null);
    await assert.rejects(
      accountUser(
        new Request("http://localhost/", {
          headers: { Authorization: "Bearer fake" },
        }),
        async () => Response.json({}, { status: 401 }),
      ),
    );
    const uid = "11111111-1111-4111-8111-111111111111";
    assert.equal(
      await accountUser(
        new Request("http://localhost/", {
          headers: { Authorization: "Bearer example" },
        }),
        async () => Response.json({ id: uid }),
      ),
      uid,
    );
    process.env.SUPABASE_URL = "https://other.supabase.co";
    await assert.rejects(
      accountUser(
        new Request("http://localhost/", {
          headers: { Authorization: "Bearer example" },
        }),
      ),
    );
  } finally {
    if (old.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = old.url;
    if (old.db === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = old.db;
  }
});
test("maker biography is served without calling the model", async () => {
  const { createAskHandler } = await import("../lib/server/ask");
  const handle = createAskHandler({
    fetch: async () => {
      throw new Error("model must not be called");
    },
  });
  const r = await handle(
    new Request("http://localhost/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "Who is Gobi?" }),
    }),
  );
  assert.equal(r.status, 200);
  assert.match(await r.text(), /Gobishankar Rathinam/);
});
