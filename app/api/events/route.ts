import { eventNames } from "@/lib/curiosity/telemetry";
import {
  clientBucket,
  RateLimiter,
  readLimitedJson,
} from "@/lib/server/limits";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const limiter = new RateLimiter(40);

export async function POST(req: Request) {
  try {
    const origin = req.headers.get("origin");
    const allowed = new Set([
      new URL(req.url).origin,
      process.env.NEXT_PUBLIC_SITE_URL,
      "https://askgobi.net",
      "https://www.askgobi.net",
    ]);
    if (
      origin &&
      !allowed.has(origin) &&
      new URL(origin).host !== req.headers.get("host")
    )
      return new Response(null, { status: 403 });
    if (!limiter.allow(clientBucket(req)))
      return new Response(null, { status: 429 });
    const value = await readLimitedJson(req, 128);
    if (!value || typeof value !== "object" || Array.isArray(value))
      return new Response(null, { status: 400 });
    const record = value as Record<string, unknown>;
    if (
      Object.keys(record).length !== 1 ||
      !eventNames.includes(record.event as (typeof eventNames)[number])
    )
      return new Response(null, { status: 400 });
    const url =
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      const response = await fetch(
        url.replace(/\/$/, "") + "/rest/v1/rpc/increment_curiosity_event",
        {
          method: "POST",
          signal: AbortSignal.timeout(1500),
          headers: {
            "Content-Type": "application/json",
            apikey: key,
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({ event_name: record.event }),
        },
      );
      if (!response.ok) console.warn("Aggregate telemetry unavailable.");
    }
  } catch {
    /* Fail open for visitors, without recording request contents. */
  }
  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}
