import { readPuzzle, type PuzzleDefinition } from "../puzzle/engine";
import { HttpError } from "./limits";
export type ScoreRecord = {
  alias: string;
  day: string;
  moves: number;
  points: number;
};
export type Ranking = {
  entries: {
    alias: string;
    rank: number;
    moves: number | null;
    points: number;
  }[];
  count: number;
  mine?: { rank: number } | null;
};
export interface SignalStore {
  board(board: PuzzleDefinition): Promise<PuzzleDefinition>;
  publish(input: {
    nonce: string;
    guestHash: string;
    initials: string;
    day: string;
    moves: number;
    points: number;
    proof: string;
    expires: number;
  }): Promise<ScoreRecord>;
  rankings(
    period: string,
    day: string,
    guestHash: string | null,
  ): Promise<Ranking>;
  remove(guestHash: string): Promise<void>;
}
export function createSignalStore(fetcher: typeof fetch = fetch): SignalStore {
  async function rpc(name: string, args: Record<string, unknown>) {
    const url =
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
      key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key)
      throw new HttpError(
        503,
        "Leaderboard unavailable—your practice result is saved on this device when storage is available.",
        "unavailable",
      );
    const response = await fetcher(
      url.replace(/\/$/, "") + "/rest/v1/rpc/" + name,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(args),
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (error.message === "attempt_already_claimed")
        throw new HttpError(
          409,
          "This attempt was already published with different details. Start a new attempt.",
          "claimed",
        );
      throw new HttpError(
        503,
        "Leaderboard unavailable—your local result is still safe. Please retry.",
        "unavailable",
      );
    }
    return response.json();
  }
  return {
    board: async (board) =>
      readPuzzle(
        await rpc("signal_freeze_board", { p_day: board.day, p_board: board }),
      ),
    publish: (input) =>
      rpc("signal_publish", {
        p_nonce: input.nonce,
        p_guest_hash: input.guestHash,
        p_initials: input.initials,
        p_day: input.day,
        p_moves: input.moves,
        p_points: input.points,
        p_proof: input.proof,
        p_expires: new Date(input.expires).toISOString(),
      }),
    rankings: (period, day, guestHash) =>
      rpc("signal_rankings", {
        p_period: period,
        p_day: day,
        p_guest_hash: guestHash,
      }),
    remove: async (guestHash) => {
      await rpc("signal_remove_guest", { p_guest_hash: guestHash });
    },
  };
}
