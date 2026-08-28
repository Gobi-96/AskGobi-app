import {
  boardFingerprint,
  generate,
  readPuzzle,
  replay,
  signal,
  type PuzzleDefinition,
  type PuzzleRun,
} from "./engine";
export const PUZZLE_KEY = "askgobi-signal-v1";
export type PuzzleProgress = {
  version: 1;
  seen: string[];
  best: Record<string, number>;
  run?: PuzzleRun;
};
type StorageLike = Pick<Storage, "getItem" | "setItem">;
export const emptyPuzzleProgress = (): PuzzleProgress => ({
  version: 1,
  seen: [],
  best: {},
});
export function readPuzzleProgress(storage?: StorageLike): PuzzleProgress {
  try {
    const raw = JSON.parse(storage?.getItem(PUZZLE_KEY) || "null");
    if (raw?.version !== 1) return emptyPuzzleProgress();
    const best: Record<string, number> = {};
    for (const [id, moves] of Object.entries(raw.best ?? {}).slice(-100)) {
      try {
        const puzzle = generate(id);
        if (
          Number.isInteger(moves) &&
          Number(moves) >= puzzle.minimum &&
          Number(moves) <= 256
        )
          best[id] = Number(moves);
      } catch {}
    }
    const seen = Array.isArray(raw.seen)
      ? raw.seen
          .filter(
            (s: unknown) =>
              typeof s === "string" && /^(?:[se][0-3]){9}$/.test(s),
          )
          .slice(-50)
      : [];
    let run: PuzzleRun | undefined;
    if (raw.run?.puzzle?.id) {
      try {
        const puzzle = readPuzzle(raw.run.puzzle);
        replay(puzzle, raw.run.moves);
        run = { puzzle, moves: raw.run.moves };
      } catch {
        /* A corrupt saved attempt must not erase the other progress. */
      }
    }
    return { version: 1, seen, best, run };
  } catch {
    return emptyPuzzleProgress();
  }
}
export function savePuzzleProgress(
  storage: StorageLike | undefined,
  value: PuzzleProgress,
): boolean {
  try {
    if (!storage) return false;
    storage.setItem(PUZZLE_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export function freshPuzzle(
  seen: readonly string[],
  random = Math.random,
): PuzzleDefinition {
  for (let i = 0; i < 64; i++) {
    const id =
      "s1-" +
      ((Math.floor(random() * 0x100000000) + i) >>> 0)
        .toString(16)
        .padStart(8, "0");
    const puzzle = generate(id);
    if (!seen.includes(boardFingerprint(puzzle))) return puzzle;
  }
  // A failing/custom RNG must not trap the interface in a selection loop.
  return generate("s1-" + (Date.now() >>> 0).toString(16).padStart(8, "0"));
}
export function recordRun(
  progress: PuzzleProgress,
  run: PuzzleRun,
): PuzzleProgress {
  const best = { ...progress.best };
  if (run.moves.length && signal(replay(run.puzzle, run.moves)).solved)
    best[run.puzzle.id] = Math.min(
      best[run.puzzle.id] ?? Infinity,
      run.moves.length,
    );
  return {
    version: 1,
    seen: [
      ...progress.seen.filter((s) => s !== boardFingerprint(run.puzzle)),
      boardFingerprint(run.puzzle),
    ].slice(-50),
    best: Object.fromEntries(Object.entries(best).slice(-100)),
    // A fresh opening is not a started attempt. Keep the previous unfinished
    // run until the visitor actually rotates a tile on the new board.
    run:
      !run.moves.length &&
      progress.run?.moves.length &&
      !signal(replay(progress.run.puzzle, progress.run.moves)).solved
        ? progress.run
        : run,
  };
}
