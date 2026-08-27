import test from "node:test";
import assert from "node:assert/strict";
import {
  cards,
  dailyCard,
  nextCard,
  cardUrl,
  getCard,
} from "../lib/curiosity/cards";
import {
  emptyProgress,
  completeCard,
  milestones,
  readProgress,
  writeProgress,
} from "../lib/curiosity/progress";
test("30 distinct reviewed cards, ten of each kind, with valid content", () => {
  assert.equal(cards.length, 30);
  assert.equal(new Set(cards.map((c) => c.id)).size, 30);
  for (const kind of ["riddle", "quiz", "fact"])
    assert.equal(cards.filter((c) => c.kind === kind).length, 10);
  for (const card of cards) {
    assert.ok(card.prompt && card.explanation);
    if (card.kind === "quiz") assert.ok(card.options[card.answerIndex]);
    if (card.kind === "fact")
      assert.equal(new URL(card.source.url).protocol, "https:");
  }
});
test("daily selection is stable within UTC day and rotates at midnight", () => {
  assert.equal(
    dailyCard(new Date("2026-08-27T00:00:00Z")),
    dailyCard(new Date("2026-08-27T23:59:59Z")),
  );
  assert.notEqual(
    dailyCard(new Date("2026-08-27T23:59:59Z")),
    dailyCard(new Date("2026-08-28T00:00:00Z")),
  );
});
test("deck does not repeat before exhaustion and avoids immediate repeat after reset", () => {
  let seen: string[] = [];
  for (let n = 0; n < 30; n++) {
    const next = nextCard(seen, () => 0.5);
    assert.ok(!seen.includes(next.card.id));
    seen = next.seen;
  }
  assert.equal(seen.length, 30);
  const next = nextCard(seen, () => 0.999999);
  assert.equal(next.seen.length, 1);
  assert.notEqual(next.card.id, seen[29]);
});
test("milestones deduplicate cards and are earned from real completion", () => {
  let p = emptyProgress();
  assert.equal(milestones(p).filter((b) => b.earned).length, 0);
  p = completeCard(p, cards[0].id);
  p = completeCard(p, cards[0].id);
  assert.equal(p.completedCards.length, 1);
  assert.equal(milestones(p)[0].earned, true);
  p = completeCard(completeCard(p, cards[1].id), cards[2].id);
  assert.equal(milestones(p)[1].earned, true);
  assert.equal(milestones(p)[2].earned, false);
  assert.equal(
    milestones({ ...emptyProgress(), challengeCompleted: true })[0].earned,
    true,
  );
});
test("storage is optional and corrupted/unrecognized data is discarded", () => {
  const blocked = {
    getItem() {
      throw new Error("denied");
    },
    setItem() {
      throw new Error("denied");
    },
  };
  assert.deepEqual(readProgress(blocked), emptyProgress());
  assert.equal(writeProgress(blocked, emptyProgress()), false);
  assert.deepEqual(readProgress(undefined), emptyProgress());
  assert.deepEqual(
    readProgress({ getItem: () => "{broken", setItem() {} }),
    emptyProgress(),
  );
  assert.deepEqual(
    readProgress({
      getItem: () =>
        JSON.stringify({
          version: 1,
          completedCards: [cards[0].id, cards[0].id, "unknown", null],
          challengeCompleted: true,
        }),
      setItem() {},
    }),
    { version: 1, completedCards: [cards[0].id], challengeCompleted: true },
  );
});
test("share links contain only a known card id; invalid ids resolve to no activity", () => {
  assert.equal(
    cardUrl("https://askgobi.net", cards[0].id),
    "https://askgobi.net/?card=riddle-map",
  );
  assert.equal(getCard("<script>"), undefined);
});
