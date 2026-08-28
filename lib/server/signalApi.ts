import { generate, utcDay, validDay } from "../puzzle/engine";
import {
  HttpError,
  RateLimiter,
  clientBucket,
  readLimitedJson,
} from "./limits";
import {
  checkOrigin,
  digest,
  guestCookie,
  guestToken,
  issueAttempt,
  publicationToken,
  validateInitials,
  verifyAttempt,
  verifyScore,
} from "./signalSecurity";
import { createSignalStore, type SignalStore } from "./signalStore";
type Operation = "daily" | "attempt" | "score" | "leaderboard" | "player";
type Dependencies = {
  store?: SignalStore;
  enabled?: boolean;
  secret?: string;
  now?: () => number;
  limiter?: RateLimiter;
};
export function createSignalApi(deps: Dependencies = {}) {
  const store = deps.store ?? createSignalStore(),
    limiter = deps.limiter ?? new RateLimiter(30);
  const now = deps.now ?? Date.now;
  return async (req: Request, operation: Operation): Promise<Response> => {
    try {
      const enabled =
        deps.enabled ?? process.env.SIGNAL_LEADERBOARD_ENABLED === "true";
      const secret = deps.secret ?? process.env.SIGNAL_TICKET_SECRET ?? "";
      const started = now();
      const today = utcDay(new Date(started)),
        url = new URL(req.url);
      if (req.method !== "GET") checkOrigin(req);
      if (!limiter.allow(clientBucket(req)))
        throw new HttpError(
          429,
          "Too many requests. Please try again in a minute.",
          "rate_limited",
        );
      const existing = guestToken(req);
      if (operation === "player") {
        if (req.method === "GET") return json({ hasIdentity: !!existing });
        if (req.method !== "DELETE")
          throw new HttpError(405, "Method not allowed.");
        if (existing) await store.remove(digest(existing));
        return json(
          { removed: true },
          { "Set-Cookie": guestCookie("", req, true) },
        );
      }
      if (operation === "daily") {
        const day = url.searchParams.get("day") ?? today;
        if (!validDay(day) || day > today)
          throw new HttpError(
            400,
            "Choose today or a past UTC date.",
            "invalid_day",
          );
        const board = generate("d1-" + day);
        if (!enabled) return json({ board, rankingEnabled: false });
        return json({
          board: await store.board(board),
          rankingEnabled: secret.length >= 32 && day === today,
        });
      }
      if (!enabled)
        throw new HttpError(
          503,
          "Public scores are not enabled yet. You can still play as practice.",
          "disabled",
        );
      if (operation === "leaderboard") {
        const period = url.searchParams.get("period") ?? "day";
        if (!["day", "week", "all"].includes(period))
          throw new HttpError(400, "Invalid leaderboard period.");
        return json(
          await store.rankings(
            period,
            today,
            existing ? digest(existing) : null,
          ),
        );
      }
      if (secret.length < 32)
        throw new HttpError(
          503,
          "Ranked attempts are not configured yet. Practice still works.",
        );
      const body = await readLimitedJson(req, 8192);
      if (!body || typeof body !== "object" || Array.isArray(body))
        throw new HttpError(400, "Invalid request.");
      const value = body as Record<string, unknown>;
      if (operation === "attempt") {
        if (value.day !== today)
          throw new HttpError(
            400,
            "Start a new attempt on today’s UTC board.",
            "invalid_day",
          );
        const board = await store.board(generate("d1-" + today));
        return json({ board, ticket: issueAttempt(board, secret, started) });
      }
      const attempt = verifyAttempt(value.ticket, secret, now()),
        initials = validateInitials(value.initials);
      const board = await store.board(generate(attempt.id));
      if (digest(JSON.stringify(board)) !== attempt.boardHash)
        throw new HttpError(
          400,
          "This attempt’s board no longer matches. Please start a new daily attempt.",
          "invalid_attempt",
        );
      const score = verifyScore(board, value.moves);
      const token = existing ?? publicationToken(attempt, secret),
        guestHash = digest(token);
      const saved = await store.publish({
        ...score,
        nonce: attempt.nonce,
        guestHash,
        initials,
        day: attempt.day,
        expires: attempt.expires,
      });
      let placement: { rank?: number; count?: number } = {};
      try {
        const rank = await store.rankings("day", attempt.day, guestHash);
        placement = { rank: rank.mine?.rank, count: rank.count };
      } catch {}
      return json(
        { ...saved, ...placement },
        { "Set-Cookie": guestCookie(token, req) },
      );
    } catch (error) {
      const controlled =
        error instanceof HttpError
          ? error
          : new HttpError(
              503,
              "Leaderboard unavailable—your local result is still safe. Please retry.",
              "unavailable",
            );
      return Response.json(
        { error: controlled.message, code: controlled.code },
        {
          status: controlled.status,
          headers: {
            "Cache-Control": "no-store",
            ...(controlled.status === 429 ? { "Retry-After": "60" } : {}),
          },
        },
      );
    }
  };
}
function json(value: unknown, headers: Record<string, string> = {}) {
  return Response.json(value, {
    headers: { "Cache-Control": "no-store", ...headers },
  });
}
export const signalApi = createSignalApi();
