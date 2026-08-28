import test from "node:test";
import assert from "node:assert/strict";
import {
  fallback,
  generate,
  hint,
  points,
  readPuzzle,
  replay,
  rotate,
  signal,
  solve,
  validDay,
  weekStart,
  boardFingerprint,
} from "../lib/puzzle/engine";
import {
  freshPuzzle,
  readPuzzleProgress,
  recordRun,
  emptyPuzzleProgress,
  savePuzzleProgress,
} from "../lib/puzzle/progress";

test("signal generator is deterministic, solvable, and difficulty bounded", () => {
  for (let i = 0; i < 300; i++) {
    for (const id of [
      "s1-" + i.toString(16).padStart(8, "0"),
      "d1-" + new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10),
    ]) {
      const board = generate(id),
        solution = solve(board.tiles)!;
      assert.deepEqual(board, generate(id));
      assert.equal(signal(board.tiles).solved, false);
      assert.equal(board.minimum, solution.minimum);
      assert.ok(
        board.minimum >= (board.day ? 6 : 3) &&
          board.minimum <= (board.day ? 10 : 6),
      );
      assert.equal(signal(replay(board, solution.moves)).solved, true);
    }
  }
  for (const daily of [false, true])
    assert.equal(
      fallback(daily ? "d1-2026-08-27" : "s1-00000000", daily).minimum,
      daily ? 6 : 3,
    );
});
test("path solver agrees with independent exhaustive orientation search", () => {
  for (const id of ["s1-deadbeef", "s1-00000001", "d1-2026-08-27"]) {
    const board = generate(id),
      candidate = board.tiles.map((t) => ({ ...t }));
    let best = Infinity;
    function search(index: number, cost: number) {
      if (cost >= best) return;
      if (index === 9) {
        if (signal(candidate).solved) best = cost;
        return;
      }
      for (
        let n = 0;
        n < (board.tiles[index].kind === "straight" ? 2 : 4);
        n++
      ) {
        candidate[index].rotation = (board.tiles[index].rotation + n) % 4;
        search(index + 1, cost + n);
      }
    }
    search(0, 0);
    assert.equal(solve(board.tiles)!.minimum, best);
  }
});
test("rotation, hints and move replay are bounded and immutable", () => {
  const board = generate("s1-deadbeef"),
    original = JSON.stringify(board);
  let tiles = board.tiles;
  for (let i = 0; i < 4; i++) tiles = rotate(tiles, 0);
  assert.deepEqual(tiles, board.tiles);
  const suggestion = hint(tiles)!;
  assert.equal(
    solve(rotate(tiles, suggestion.tile))!.minimum,
    board.minimum - 1,
  );
  for (const moves of [[-1], [9], [1.2], ["1"], new Array(257).fill(0), null])
    assert.throws(() => replay(board, moves));
  assert.equal(JSON.stringify(board), original);
  assert.equal(hint(replay(board, solve(board.tiles)!.moves)), null);
});
test("practice remembers boards and best results without requiring storage", () => {
  const first = freshPuzzle([], () => 0.5);
  const next = freshPuzzle([boardFingerprint(first)], () => 0.5);
  assert.notEqual(boardFingerprint(first), boardFingerprint(next));
  let progress = recordRun(emptyPuzzleProgress(), { puzzle: first, moves: [] });
  assert.deepEqual(progress.best, {});
  progress = recordRun(progress, {
    puzzle: first,
    moves: solve(first.tiles)!.moves,
  });
  assert.equal(progress.best[first.id], first.minimum);
  const blocked = {
    getItem() {
      throw Error("denied");
    },
    setItem() {
      throw Error("denied");
    },
  };
  assert.deepEqual(readPuzzleProgress(blocked), emptyPuzzleProgress());
  assert.equal(savePuzzleProgress(blocked, progress), false);
  const storage = { getItem: () => JSON.stringify(progress), setItem() {} };
  assert.deepEqual(readPuzzleProgress(storage), progress);
  assert.deepEqual(
    readPuzzleProgress({ getItem: () => "{", setItem() {} }),
    emptyPuzzleProgress(),
  );
});
test("date IDs, week boundaries and points have explicit semantics", () => {
  assert.equal(validDay("2026-02-30"), false);
  assert.equal(weekStart("2026-08-30"), "2026-08-24");
  assert.equal(weekStart("2026-08-31"), "2026-08-31");
  assert.equal(points(6, 6), 100);
  assert.equal(points(6, 8), 75);
  for (const id of ["s2-00000000", "s1-<script>", "d1-2026-02-30"])
    assert.throws(() => generate(id));
});
test("fresh unopened boards do not overwrite an unfinished saved attempt", () => {
  const first = generate("s1-00000001"),
    second = generate("s1-1234abcd");
  const progress = recordRun(emptyPuzzleProgress(), {
    puzzle: first,
    moves: [0],
  });
  const reopened = recordRun(progress, { puzzle: second, moves: [] });
  assert.deepEqual(reopened.run, progress.run);
  assert.equal(
    recordRun(reopened, { puzzle: second, moves: [0] }).run!.puzzle.id,
    second.id,
  );
});
test("v1 shared boards have frozen regression fixtures and validated definitions", () => {
  for (const [id, fingerprint, minimum] of [
    ["s1-00000001", "s1e1e1s1e0e0s1s0s0", 4],
    ["s1-1234abcd", "e2e1s0e2s1e3e2s0e2", 6],
    ["d1-2026-08-27", "e1e3s0e0e0s0e1s1e3", 7],
  ] as const) {
    const board = generate(id);
    assert.equal(boardFingerprint(board), fingerprint);
    assert.equal(board.minimum, minimum);
    assert.deepEqual(readPuzzle(board), board);
    assert.throws(() => readPuzzle({ ...board, minimum: 0 }));
    assert.throws(() => readPuzzle({ ...board, version: 2 }));
    assert.throws(() => readPuzzle({ ...board, tiles: [] }));
  }
  const board = generate("s1-00000001");
  assert.equal(
    boardFingerprint(board),
    boardFingerprint({
      ...board,
      tiles: board.tiles.map((t) =>
        t.kind === "straight" ? { ...t, rotation: (t.rotation + 2) % 4 } : t,
      ),
    }),
  );
});
