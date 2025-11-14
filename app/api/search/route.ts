import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import * as cheerio from "cheerio";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q");
  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(
      query
    )}`;
    const { data: html } = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/123.0 Safari/537.36",
      },
    });

    const $ = cheerio.load(html);
    const results: any[] = [];

    $(".result").each((i, el) => {
      const rawTitle =
        $(el).find(".result__title").text().trim() ||
        $(el).find("a.result__a").text().trim();

      // 🧹 Skip ads
      if (!rawTitle || rawTitle.toLowerCase().includes("ad")) return;

      const rawLink =
        $(el).find(".result__url").attr("href") ||
        $(el).find("a.result__a").attr("href");
      if (!rawLink) return;

      // ✅ Normalize link
      let fullLink = rawLink.startsWith("http")
        ? rawLink
        : `https:${rawLink}`;

      // ✅ If it's a DuckDuckGo redirect, extract real URL from ?uddg=
      try {
        const urlObj = new URL(fullLink);
        const uddg = urlObj.searchParams.get("uddg");
        if (uddg) {
          fullLink = decodeURIComponent(uddg);
        }
      } catch {
        // if URL parsing fails, just keep fullLink as-is
      }

      const snippet =
        $(el).find(".result__snippet").text().trim() ||
        $(el).find(".snippet").text().trim() ||
        "";

      results.push({
        title: rawTitle,
        link: fullLink,
        snippet,
      });
    });

    return NextResponse.json({
      query,
      results: results.slice(0, 5),
    });
  } catch (e) {
    console.error("Search error:", e);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
