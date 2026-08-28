export type Tile = { kind: "straight" | "elbow"; rotation: number };
export type PuzzleDefinition = {
  version: 1;
  id: string;
  tiles: Tile[];
  minimum: number;
  day?: string;
};
export type PuzzleRun = { puzzle: PuzzleDefinition; moves: number[] };
export type CoachHint = {
  tile: number;
  row: number;
  column: number;
  remaining: number;
  explanation: string;
};
export const MAX_MOVES = 256;
export const directions = ["up", "right", "down", "left"] as const;
const steps = [-3, 1, 3, -1];
export function ports(tile: Tile): number[] {
  return [
    tile.rotation % 4,
    (tile.rotation + (tile.kind === "straight" ? 2 : 1)) % 4,
  ];
}
function neighbor(index: number, direction: number): number | null {
  if (
    (direction === 0 && index < 3) ||
    (direction === 2 && index > 5) ||
    (direction === 1 && index % 3 === 2) ||
    (direction === 3 && index % 3 === 0)
  )
    return null;
  return index + steps[direction];
}
export function rotate(tiles: readonly Tile[], index: number): Tile[] {
  if (!Number.isInteger(index) || index < 0 || index > 8)
    throw new Error("Invalid tile.");
  return tiles.map((tile, i) =>
    i === index ? { ...tile, rotation: (tile.rotation + 1) % 4 } : { ...tile },
  );
}
export function validateTiles(value: unknown): value is Tile[] {
  return (
    Array.isArray(value) &&
    value.length === 9 &&
    value.every(
      (tile) =>
        tile &&
        Object.keys(tile).length === 2 &&
        (tile.kind === "straight" || tile.kind === "elbow") &&
        Number.isInteger(tile.rotation) &&
        tile.rotation >= 0 &&
        tile.rotation < 4,
    )
  );
}
export function replay(puzzle: PuzzleDefinition, moves: unknown): Tile[] {
  if (
    !Array.isArray(moves) ||
    moves.length > MAX_MOVES ||
    moves.some((i) => !Number.isInteger(i) || i < 0 || i > 8)
  )
    throw new Error("Invalid move list.");
  return moves.reduce(
    (tiles, index) => rotate(tiles, index),
    puzzle.tiles.map((tile) => ({ ...tile })),
  );
}
// A tile has exactly two openings: the powered signal cannot branch.
export function signal(tiles: readonly Tile[]): {
  lit: number[];
  solved: boolean;
} {
  const lit: number[] = [];
  let index = 3,
    incoming = 3;
  while (!lit.includes(index)) {
    const openings = ports(tiles[index]);
    if (!openings.includes(incoming)) break;
    lit.push(index);
    const outgoing = openings.find((d) => d !== incoming)!;
    if (index === 5 && outgoing === 1) return { lit, solved: true };
    const next = neighbor(index, outgoing);
    if (next === null) break;
    index = next;
    incoming = (outgoing + 2) % 4;
  }
  return { lit, solved: false };
}
type PathStep = { index: number; incoming: number; outgoing: number };
const paths: PathStep[][] = [];
function enumerate(
  index: number,
  incoming: number,
  visited: number[],
  path: PathStep[],
) {
  if (index === 5) paths.push([...path, { index, incoming, outgoing: 1 }]);
  for (let outgoing = 0; outgoing < 4; outgoing++) {
    if (outgoing === incoming) continue;
    const next = neighbor(index, outgoing);
    if (next === null || visited.includes(next)) continue;
    enumerate(
      next,
      (outgoing + 2) % 4,
      [...visited, next],
      [...path, { index, incoming, outgoing }],
    );
  }
}
enumerate(3, 3, [3], []);
// Enumerating every simple entrance-to-exit path is exact: a successful signal
// cannot revisit a two-port tile. Choose the cheapest clockwise orientation per tile.
export function solve(
  tiles: readonly Tile[],
): { minimum: number; moves: number[] } | null {
  let best: number[] | null = null;
  for (const path of paths) {
    const moves: number[] = [];
    let possible = true;
    for (const step of path) {
      let turns = -1;
      for (let n = 0; n < 4; n++) {
        const openings = ports({
          ...tiles[step.index],
          rotation: (tiles[step.index].rotation + n) % 4,
        });
        if (
          openings.includes(step.incoming) &&
          openings.includes(step.outgoing)
        ) {
          turns = n;
          break;
        }
      }
      if (turns < 0) {
        possible = false;
        break;
      }
      for (let n = 0; n < turns; n++) moves.push(step.index);
    }
    if (possible && (best === null || moves.length < best.length)) best = moves;
  }
  return best === null ? null : { minimum: best.length, moves: best };
}
export function hint(tiles: readonly Tile[]): CoachHint | null {
  const solution = solve(tiles);
  if (!solution?.moves.length) return null;
  const tile = solution.moves[0],
    row = Math.floor(tile / 3) + 1,
    column = (tile % 3) + 1;
  return {
    tile,
    row,
    column,
    remaining: solution.minimum,
    explanation: `Rotate row ${row}, column ${column} clockwise once. This is the first move of a shortest route from this position (${solution.minimum} rotations remaining).`,
  };
}
function rng(seed: string) {
  let state = 2166136261;
  for (const char of seed)
    state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}
export function validDay(day: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(Date.parse(day)) &&
    new Date(day).toISOString().slice(0, 10) === day
  );
}
export const utcDay = (now = new Date()) => now.toISOString().slice(0, 10);
export function weekStart(day: string) {
  const date = new Date(day + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return utcDay(date);
}
export function generate(id: string): PuzzleDefinition {
  const daily = id.startsWith("d1-");
  if (!(daily ? validDay(id.slice(3)) : /^s1-[a-f0-9]{8}$/.test(id)))
    throw new Error("Unknown puzzle version or ID.");
  const random = rng(id),
    low = daily ? 6 : 3,
    high = daily ? 10 : 6;
  let tiles: Tile[] = [];
  for (let attempt = 0; attempt < 128; attempt++) {
    tiles = Array.from({ length: 9 }, () => ({
      kind: random() < 0.5 ? "straight" : "elbow",
      rotation: Math.floor(random() * 4),
    }));
    const path = paths[Math.floor(random() * paths.length)];
    for (const step of path)
      tiles[step.index].kind =
        (step.incoming + 2) % 4 === step.outgoing ? "straight" : "elbow";
    const solution = solve(tiles);
    if (solution && solution.minimum >= low && solution.minimum <= high)
      return {
        version: 1,
        id,
        tiles,
        minimum: solution.minimum,
        ...(daily ? { day: id.slice(3) } : {}),
      };
  }
  return fallback(id, daily);
}
export function fallback(id: string, daily: boolean): PuzzleDefinition {
  const kinds = [
    "elbow",
    "straight",
    "elbow",
    "elbow",
    "straight",
    "elbow",
    "straight",
    "straight",
    "straight",
  ] as const;
  const rotations = [daily ? 2 : 1, 1, 2, 0, 0, 0, 0, 0, 0];
  const tiles = kinds.map((kind, i) => ({ kind, rotation: rotations[i] }));
  return {
    version: 1,
    id,
    tiles,
    minimum: solve(tiles)!.minimum,
    ...(daily ? { day: id.slice(3) } : {}),
  };
}
export function readPuzzle(value: unknown): PuzzleDefinition {
  if (!value || typeof value !== "object") throw new Error("Invalid board.");
  const board = value as PuzzleDefinition;
  if (
    board.version !== 1 ||
    typeof board.id !== "string" ||
    !validateTiles(board.tiles)
  )
    throw new Error("Invalid board.");
  const daily = board.id.startsWith("d1-");
  if (
    daily
      ? !validDay(board.id.slice(3)) || board.day !== board.id.slice(3)
      : !/^s1-[a-f0-9]{8}$/.test(board.id) || board.day !== undefined
  )
    throw new Error("Invalid board identity.");
  const minimum = solve(board.tiles)?.minimum;
  if (
    minimum === undefined ||
    minimum !== board.minimum ||
    minimum < (daily ? 6 : 3) ||
    minimum > (daily ? 10 : 6)
  )
    throw new Error("Invalid board difficulty.");
  return {
    version: 1,
    id: board.id,
    tiles: board.tiles.map((tile) => ({
      kind: tile.kind,
      rotation: tile.rotation,
    })),
    minimum,
    ...(daily ? { day: board.day } : {}),
  };
}
export const boardFingerprint = (puzzle: PuzzleDefinition) =>
  puzzle.tiles
    .map((t) => `${t.kind[0]}${t.rotation % (t.kind === "straight" ? 2 : 4)}`)
    .join("");
export const points = (minimum: number, moves: number) =>
  Math.floor((100 * minimum) / moves);
