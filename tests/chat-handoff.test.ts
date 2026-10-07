import test from "node:test";
import assert from "node:assert/strict";
import { readChatHandoff } from "../lib/curiosity/chatHandoff";
const now = 1_000_000;
const sample = {
  version: 1,
  createdAt: now,
  ownerId: null,
  exchanges: [{ question: "Why?", answer: "Because." }],
};
test("homepage exchange survives guest continuation in the same tab", () => {
  assert.deepEqual(readChatHandoff(JSON.stringify(sample), null, now), sample);
});
test("homepage continuation rejects switched accounts and guest-to-account transfer", () => {
  assert.equal(readChatHandoff(JSON.stringify(sample), "user-a", now), null);
  const owned = { ...sample, ownerId: "user-a" };
  assert.equal(readChatHandoff(JSON.stringify(owned), "user-b", now), null);
  assert.equal(readChatHandoff(JSON.stringify(owned), null, now), null);
  assert.deepEqual(
    readChatHandoff(JSON.stringify(owned), "user-a", now),
    owned,
  );
});
test("homepage continuation rejects expired, future, invalid and oversized content", () => {
  for (const value of [
    null,
    {},
    { ...sample, version: 2 },
    { ...sample, createdAt: now - 900001 },
    { ...sample, createdAt: now + 1 },
    { ...sample, exchanges: [{ question: "q", answer: "x".repeat(4001) }] },
    {
      ...sample,
      exchanges: [
        sample.exchanges[0],
        sample.exchanges[0],
        sample.exchanges[0],
        sample.exchanges[0],
      ],
    },
  ]) {
    assert.equal(readChatHandoff(JSON.stringify(value), null, now), null);
  }
  assert.equal(readChatHandoff("bad-json", null, now), null);
  assert.equal(readChatHandoff("x".repeat(16001), null, now), null);
});
