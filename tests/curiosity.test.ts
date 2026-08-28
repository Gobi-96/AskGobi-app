import test from "node:test";
import assert from "node:assert/strict";
import {
  cards,
  nextCard,
  cardUrl,
  getCard,
  entryActivity,
} from "../lib/curiosity/cards";
import {
  emptyProgress,
  completeCard,
  milestones,
  readProgress,
  writeProgress,
} from "../lib/curiosity/progress";
import { activityVisit } from "../lib/curiosity/visit";
import {
  nextOpeningQuiz,
  readQuizHistory,
  writeQuizHistory,
  QUIZ_HISTORY_KEY,
} from "../lib/curiosity/opening";
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
test("mobile quiz copy is short and retains the original IDs and correct answers", () => {
  const expected = {
    "quiz-race": "Second",
    "quiz-machines": "5 minutes",
    "quiz-socks": "3",
    "quiz-months": "12",
    "quiz-bat": "5 cents",
    "quiz-lilies": "Day 47",
    "quiz-weight": "They have the same mass",
    "quiz-coin": "Exactly 50%",
    "quiz-corners": "5",
    "quiz-handshakes": "6",
  };
  for (const [id, answer] of Object.entries(expected)) {
    const card = getCard(id);
    assert.equal(card?.kind, "quiz");
    if (card?.kind !== "quiz") throw new Error("Missing quiz: " + id);
    assert.equal(card.options.length, 3);
    assert.equal(card.options[card.answerIndex], answer);
    assert.ok(card.prompt.trim().split(/\s+/).length <= 25, id);
  }
});
test("skipped visits do not complete or award milestones and the deck still exhausts without repeats", () => {
  const events: string[] = [];
  const progress = emptyProgress();
  let seen = [nextOpeningQuiz([], () => 0).card.id];
  // Displaying the first card and discarding its visit is silent.
  activityVisit((event) => events.push(event));
  for (let i = 1; i < cards.length; i++) {
    const next = nextCard(seen, () => 0);
    assert.ok(!seen.includes(next.card.id));
    seen = next.seen;
    const visit = activityVisit((event) => events.push(event));
    visit.start(); // Explicitly skipping selects the next activity, not completion.
  }
  assert.equal(seen.length, 30);
  assert.equal(events.length, 29);
  assert.ok(events.every((event) => event === "activity_start"));
  assert.equal(progress.completedCards.length, 0);
  assert.equal(
    milestones(progress).some((badge) => badge.earned),
    false,
  );
});
test("fresh visits use all ten quizzes before repeating, including across stored reloads", () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
  const ids: string[] = [];
  for (let i = 0; i < 10; i++) {
    const next = nextOpeningQuiz(readQuizHistory(storage), () => 0.5);
    assert.equal(next.card.kind, "quiz");
    assert.ok(!ids.includes(next.card.id));
    ids.push(next.card.id);
    writeQuizHistory(storage, next.seen);
  }
  assert.equal(new Set(ids).size, 10);
  const next = nextOpeningQuiz(readQuizHistory(storage), () => 0.999);
  assert.notEqual(next.card.id, ids.at(-1));
  assert.deepEqual(next.seen, [next.card.id]);
  assert.deepEqual([...data.keys()], [QUIZ_HISTORY_KEY]);
});
test("opening selection is random, immutable and independent of completion", () => {
  const seen = ["quiz-race"];
  const first = nextOpeningQuiz(seen, () => 0);
  const last = nextOpeningQuiz(seen, () => 0.999);
  assert.notEqual(first.card.id, last.card.id);
  assert.deepEqual(seen, ["quiz-race"]);
  const id = first.card.id;
  nextOpeningQuiz(first.seen, () => 0);
  assert.equal(first.card.id, id);
  assert.deepEqual(emptyProgress().completedCards, []);
});
test("quiz history handles absent, blocked, malformed and stale storage", () => {
  const blocked = {
    getItem() {
      throw new Error("denied");
    },
    setItem() {
      throw new Error("denied");
    },
  };
  for (const storage of [undefined, blocked]) {
    assert.deepEqual(readQuizHistory(storage), []);
    assert.doesNotThrow(() => writeQuizHistory(storage, ["quiz-race"]));
    assert.equal(nextOpeningQuiz(readQuizHistory(storage)).card.kind, "quiz");
  }
  for (const value of ["{broken", "null", "{}", '"quiz-race"']) {
    assert.deepEqual(
      readQuizHistory({ getItem: () => value, setItem() {} }),
      [],
    );
  }
  assert.deepEqual(
    readQuizHistory({
      getItem: () =>
        JSON.stringify([
          "quiz-race",
          "quiz-race",
          "unknown",
          null,
          "fact-moon",
          "quiz-socks",
        ]),
      setItem() {},
    }),
    ["quiz-race", "quiz-socks"],
  );
});
test("shared cards resolve first; ordinary and unknown links defer selection to the device", () => {
  const entry = entryActivity({});
  assert.deepEqual(entry, { card: null, challenge: false, introductory: true });
  assert.deepEqual(entryActivity({ card: "unknown" }), entry);
  assert.equal(entryActivity({ challenge: "1" }).challenge, true);
  for (const card of cards) {
    assert.deepEqual(entryActivity({ card: card.id, challenge: "1" }), {
      card,
      challenge: false,
      introductory: false,
    });
    assert.equal(
      getCard(
        new URL(cardUrl("https://askgobi.net", card.id)).searchParams.get(
          "card",
        ),
      ),
      card,
    );
  }
});
test("display is silent; first answer starts and completes once; another selection only starts", () => {
  const events: string[] = [];
  const visit = activityVisit((event) => events.push(event));
  let progress = emptyProgress();
  assert.equal(events.length, 0);
  assert.equal(
    milestones(progress).some((badge) => badge.earned),
    false,
  );
  if (visit.complete()) progress = completeCard(progress, cards[0].id);
  assert.deepEqual(events, ["activity_start", "activity_complete"]);
  assert.equal(visit.complete(), false);
  visit.start();
  assert.equal(events.length, 2);
  assert.equal(progress.completedCards.length, 1);
  const next = activityVisit((event) => events.push(event));
  next.start();
  next.start();
  assert.deepEqual(events, [
    "activity_start",
    "activity_complete",
    "activity_start",
  ]);
  assert.equal(next.complete(), true);
  assert.equal(events.at(-1), "activity_complete");
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
