import { NextRequest, NextResponse } from "next/server";
import { clientBucket, RateLimiter } from "@/lib/server/limits";
const limiter = new RateLimiter(6);

export const dynamic = "force-dynamic";

// Cloudflare Worker URL
const WORKER_URL =
  "https://askgobi-search.gobishankar-rathinam.workers.dev";

// 🔥 Boost version searches for technical accuracy
function boostQuery(original: string) {
  const q = original.toLowerCase();

  if (q.includes("java"))
    return `${original} latest version site:oracle.com OR site:openjdk.org`;

  if (q.includes("python"))
    return `${original} latest version site:python.org`;

  if (q.includes("node"))
    return `${original} latest version site:nodejs.org`;

  if (q.includes("windows"))
    return `${original} latest version site:microsoft.com`;

  if (q.includes("ios") || q.includes("iphone"))
    return `${original} latest version site:apple.com`;

  if (q.includes("android") || q.includes("pixel"))
    return `${original} latest version site:android.com`;

  // Default: return original query
  return original;
}

export async function GET(req: NextRequest) {
  if (!limiter.allow(clientBucket(req))) return NextResponse.json({ error: "Try again in a minute." }, { status: 429, headers: { "Retry-After": "60" } });
  const query = req.nextUrl.searchParams.get("q");

  if (!query?.trim() || query.length > 500) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  try {
    // 🚀 Boost query before sending to Worker
    const enhanced = boostQuery(query);

    const url = `${WORKER_URL}/?q=${encodeURIComponent(enhanced)}`;

    const res = await fetch(url, { signal: AbortSignal.any([req.signal, AbortSignal.timeout(8000)]) });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Worker failed" },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.warn("Search temporarily unavailable.");
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
