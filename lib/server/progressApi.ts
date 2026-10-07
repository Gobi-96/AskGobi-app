import { getCard } from "../curiosity/cards";
import { generate, utcDay } from "../puzzle/engine";
import { accountRpc, accountUser, syncEnabled } from "./account";
import {
  checkOrigin,
  digest,
  guestCookie,
  guestToken,
  verifyScore,
} from "./signalSecurity";
import { createSignalStore } from "./signalStore";
import {
  HttpError,
  RateLimiter,
  clientBucket,
  readLimitedJson,
} from "./limits";
const limiter = new RateLimiter(40);
export function validateProgress(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new HttpError(400, "Invalid progress.");
  const body = value as Record<string, unknown>;
  if (body.cardId !== undefined) {
    if (typeof body.cardId !== "string" || !getCard(body.cardId))
      throw new HttpError(400, "Unknown discovery.");
    return { cardId: body.cardId };
  }
  if (typeof body.puzzleId !== "string")
    throw new HttpError(400, "Choose a discovery or completed puzzle.");
  let board;
  try {
    board = generate(body.puzzleId);
  } catch {
    throw new HttpError(400, "Unknown puzzle.");
  }
  if (board.day && board.day > utcDay())
    throw new HttpError(400, "Future puzzles cannot be saved.");
  verifyScore(board, body.moves);
  return { board, moves: body.moves };
}
export async function progressApi(
  req: Request,
  operation: "progress" | "claim",
) {
  try {
    if (!syncEnabled())
      throw new HttpError(
        503,
        "Account sync is not enabled yet. Play and chat still work.",
        "disabled",
      );
    if (req.method !== "GET") checkOrigin(req);
    if (!limiter.allow(clientBucket(req)))
      throw new HttpError(429, "Please try again in a minute.");
    const user = await accountUser(req);
    if (!user)
      throw new HttpError(
        401,
        "Sign in to save across devices.",
        "unauthorized",
      );
    let result;
    if (operation === "claim") {
      const token = guestToken(req);
      result = token
        ? await accountRpc("curiosity_claim", {
            p_user: user,
            p_guest: digest(token),
          })
        : { claimed: false };
      return Response.json(result, {
        headers: {
          "Cache-Control": "no-store",
          "Set-Cookie": guestCookie("", req, true),
        },
      });
    }
    if (req.method === "GET")
      result = await accountRpc("curiosity_progress", { p_user: user });
    else {
      const input = validateProgress(await readLimitedJson(req, 8192));
      if (input.cardId)
        result = await accountRpc("curiosity_save", {
          p_user: user,
          p_card: input.cardId,
        });
      else if (input.board) {
        const board = input.board.day
          ? await createSignalStore().board(input.board)
          : input.board;
        const score = verifyScore(board, input.moves);
        result = await accountRpc("curiosity_save", {
          p_user: user,
          p_puzzle: board.id,
          p_day: board.day || null,
          p_moves: score.moves,
          p_points: score.points,
        });
      }
    }
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const e =
      error instanceof HttpError
        ? error
        : new HttpError(
            503,
            "Sync is unavailable. Your local progress is safe.",
          );
    return Response.json(
      { error: e.message, code: e.code },
      { status: e.status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
