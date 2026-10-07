import { HttpError } from "./limits";
export const syncEnabled = () => process.env.ACCOUNT_SYNC_ENABLED === "true";
export async function accountUser(
  req: Request,
  fetcher: typeof fetch = fetch,
): Promise<string | null> {
  const authorization = req.headers.get("authorization");
  if (!authorization) return null;
  if (!/^Bearer \S+$/.test(authorization))
    throw new HttpError(401, "Please sign in again.", "unauthorized");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const dbUrl = process.env.SUPABASE_URL || url;
  if (!url || url.replace(/\/$/, "") !== dbUrl?.replace(/\/$/, ""))
    throw new HttpError(
      503,
      "Account sync is not configured for this environment.",
    );
  const response = await fetcher(url + "/auth/v1/user", {
    headers: {
      Authorization: authorization,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    },
    signal: AbortSignal.timeout(5000),
    cache: "no-store",
  });
  if (!response.ok)
    throw new HttpError(
      401,
      "Your session expired. Please sign in again.",
      "unauthorized",
    );
  const user = await response.json();
  if (typeof user.id !== "string" || !/^[\da-f-]{36}$/i.test(user.id))
    throw new HttpError(401, "Please sign in again.", "unauthorized");
  return user.id;
}
export async function accountRpc(name: string, args: Record<string, unknown>) {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new HttpError(
      503,
      "Sync is unavailable. Your local progress is safe.",
    );
  const r = await fetch(url + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: "Bearer " + key,
    },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(5000),
    cache: "no-store",
  });
  if (!r.ok) {
    const error = await r.json().catch(() => ({}));
    if (error.message === "guest_already_claimed")
      throw new HttpError(
        409,
        "This guest result belongs to another account.",
        "claimed",
      );
    throw new HttpError(
      503,
      "Sync is unavailable. Your local progress is safe.",
    );
  }
  return r.json();
}
export async function accountPlayer(
  user: string,
  create = false,
): Promise<string | null> {
  return accountRpc("curiosity_player", { p_user: user, p_create: create });
}
