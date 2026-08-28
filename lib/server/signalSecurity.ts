import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import {
  generate,
  points,
  replay,
  signal,
  utcDay,
  type PuzzleDefinition,
} from "../puzzle/engine";
import { HttpError } from "./limits";
export const GUEST_COOKIE = "askgobi_signal_guest";
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export type Attempt = {
  v: 1;
  id: string;
  day: string;
  boardHash: string;
  nonce: string;
  issued: number;
  expires: number;
};
export function issueAttempt(
  board: PuzzleDefinition,
  secret: string,
  now = Date.now(),
) {
  const value: Attempt = {
    v: 1,
    id: board.id,
    day: board.day!,
    boardHash: digest(JSON.stringify(board)),
    nonce: randomBytes(24).toString("hex"),
    issued: now,
    expires: now + 7_200_000,
  };
  const encoded = Buffer.from(JSON.stringify(value)).toString("base64url");
  return (
    encoded +
    "." +
    createHmac("sha256", secret).update(encoded).digest("base64url")
  );
}
export function verifyAttempt(
  token: unknown,
  secret: string,
  now = Date.now(),
): Attempt {
  try {
    if (typeof token !== "string" || token.length > 1024) throw Error();
    const [encoded, signature, ...extra] = token.split(".");
    if (extra.length || !signature) throw Error();
    const expected = createHmac("sha256", secret).update(encoded).digest();
    const supplied = Buffer.from(signature, "base64url");
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    )
      throw Error();
    const value = JSON.parse(
      Buffer.from(encoded, "base64url").toString(),
    ) as Attempt;
    if (
      value.v !== 1 ||
      !/^[a-f0-9]{48}$/.test(value.nonce) ||
      value.id !== "d1-" + value.day ||
      !Number.isInteger(value.issued) ||
      value.expires !== value.issued + 7_200_000 ||
      value.issued > now + 30_000 ||
      now >= value.expires ||
      value.day !== utcDay(new Date(value.issued))
    )
      throw Error();
    if (!/^[a-f0-9]{64}$/.test(value.boardHash)) throw Error();
    generate(value.id);
    return value;
  } catch {
    throw new HttpError(
      400,
      "This ranked attempt is invalid or expired. Your local result is safe; start today’s challenge again.",
      "invalid_attempt",
    );
  }
}
export function validateInitials(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[A-Z]{2,3}$/.test(value) ||
    ["ASS", "KKK", "FUK", "FCK", "WTF", "SEX"].includes(value)
  )
    throw new HttpError(
      400,
      "Use two or three suitable uppercase initials.",
      "invalid_initials",
    );
  return value;
}
export function verifyScore(board: PuzzleDefinition, moves: unknown) {
  try {
    const final = replay(board, moves);
    if (
      !Array.isArray(moves) ||
      !moves.length ||
      !signal(final).solved ||
      moves.length < board.minimum
    )
      throw Error();
    // The play UI stops at completion; reject fabricated moves after an earlier solve.
    let current = board.tiles;
    for (let i = 0; i < moves.length - 1; i++) {
      current = replay({ ...board, tiles: current }, [moves[i]]);
      if (signal(current).solved) throw Error();
    }
    return {
      moves: moves.length,
      points: points(board.minimum, moves.length),
      proof: digest(JSON.stringify(moves)),
    };
  } catch {
    throw new HttpError(
      400,
      "Those moves do not form a valid completed attempt.",
      "invalid_score",
    );
  }
}
export function guestToken(req: Request): string | null {
  const value = (req.headers.get("cookie") || "")
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(GUEST_COOKIE + "="))
    ?.slice(GUEST_COOKIE.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}
// A first-publication retry without its Set-Cookie response resolves to the same
// guest. Attempt tickets are private bearer credentials and never enter share URLs.
export function publicationToken(attempt: Attempt, secret: string) {
  return createHmac("sha256", secret)
    .update("signal-guest:" + attempt.nonce)
    .digest("hex");
}
export function guestCookie(token: string, req: Request, remove = false) {
  const secure =
    process.env.NODE_ENV === "production" ||
    new URL(req.url).protocol === "https:";
  // Keep the score identity out of aggregate telemetry and private chat requests.
  return `${GUEST_COOKIE}=${remove ? "" : token}; Path=/api/puzzle; HttpOnly; SameSite=Lax; Max-Age=${remove ? 0 : 31_536_000}${secure ? "; Secure" : ""}`;
}
export function checkOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const target = new URL(req.url);
  const allowed = [
    target.origin,
    // Next may normalize the internal URL to localhost. The browser's Host is
    // still the target it actually opened (e.g. 127.0.0.1 in local host testing).
    ...(req.headers.get("host")
      ? [target.protocol + "//" + req.headers.get("host")]
      : []),
    process.env.NEXT_PUBLIC_SITE_URL,
    "https://askgobi.net",
    "https://www.askgobi.net",
  ];
  if (
    !origin ||
    !allowed.includes(origin) ||
    req.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new HttpError(403, "Open this action from AskGobi.", "forbidden");
}
