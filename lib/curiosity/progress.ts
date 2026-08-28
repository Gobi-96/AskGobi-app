import { getCard } from "./cards";
export type Progress = {
  version: 1;
  completedCards: string[];
  challengeCompleted: boolean;
  puzzleCompleted?: boolean;
};
export const emptyProgress = (): Progress => ({
  version: 1,
  completedCards: [],
  challengeCompleted: false,
});
export const PROGRESS_KEY = "askgobi-curiosity-v1";
export const DECK_KEY = "askgobi-deck-v1";
type StorageLike = Pick<Storage, "getItem" | "setItem">;
export function readProgress(storage: StorageLike | undefined): Progress {
  try {
    const value = JSON.parse(storage?.getItem(PROGRESS_KEY) || "null");
    if (value?.version !== 1 || !Array.isArray(value.completedCards))
      return emptyProgress();
    return {
      version: 1,
      completedCards: Array.from(
        new Set<string>(
          value.completedCards.filter(
            (id: unknown) => typeof id === "string" && getCard(id),
          ),
        ),
      ),
      challengeCompleted: value.challengeCompleted === true,
      ...(value.puzzleCompleted === true ? { puzzleCompleted: true } : {}),
    };
  } catch {
    return emptyProgress();
  }
}
export function writeProgress(
  storage: StorageLike | undefined,
  progress: Progress,
): boolean {
  try {
    if (!storage) return false;
    storage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}
export function completeCard(progress: Progress, id: string): Progress {
  return getCard(id) && !progress.completedCards.includes(id)
    ? { ...progress, completedCards: [...progress.completedCards, id] }
    : progress;
}
export function milestones(progress: Progress) {
  return [
    {
      name: "First Spark",
      earned:
        progress.completedCards.length > 0 ||
        progress.challengeCompleted ||
        progress.puzzleCompleted === true,
      description: "Complete any activity.",
    },
    {
      name: "Explorer",
      earned: progress.completedCards.length >= 3,
      description: "Complete three different cards.",
    },
    {
      name: "Challenger",
      earned: progress.challengeCompleted,
      description: "Finish one AI challenge.",
    },
  ];
}
