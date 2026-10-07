import { cards, getCard } from "./cards";

export const QUIZ_HISTORY_KEY = "askgobi-quiz-history-v1";
type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function readQuizHistory(storage?: StorageLike): string[] {
  try {
    const value: unknown = JSON.parse(
      storage?.getItem(QUIZ_HISTORY_KEY) || "[]",
    );
    if (!Array.isArray(value)) return [];
    return [
      ...new Set(
        value.filter(
          (id): id is string =>
            typeof id === "string" && getCard(id)?.kind === "quiz",
        ),
      ),
    ];
  } catch {
    return [];
  }
}

export function writeQuizHistory(
  storage: StorageLike | undefined,
  seen: string[],
) {
  try {
    storage?.setItem(QUIZ_HISTORY_KEY, JSON.stringify(seen));
  } catch {
    // Repeat prevention is optional; play must also work without storage.
  }
}

// Openings cycle through quizzes; continuation still uses the full 30-card deck.
// After exhaustion, start a new random cycle without repeating the last quiz.
export function nextOpeningQuiz(seen: readonly string[], random = Math.random) {
  const quizzes = cards.filter((card) => card.kind === "quiz");
  const remaining = quizzes.filter((card) => !seen.includes(card.id));
  const pool = remaining.length
    ? remaining
    : quizzes.filter((card) => card.id !== seen[seen.length - 1]);
  const card =
    pool[
      Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)))
    ];
  return { card, seen: [...(remaining.length ? seen : []), card.id] };
}
