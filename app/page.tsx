import Playground from "@/components/playground/Playground";
import { entryActivity, getCard } from "@/lib/curiosity/cards";
import type { Metadata } from "next";
import { generate, validDay } from "@/lib/puzzle/engine";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ card?: string; puzzle?: string; daily?: string }>;
}): Promise<Metadata> {
  const params = await searchParams;
  const card = getCard(params.card);
  if (!card) {
    const id = puzzleEntry(params);
    if (!id) return {};
    const title = "Connect the Signal · AskGobi";
    const description =
      "Tap the tiles. Connect the blue signal to G. Try this shared puzzle.";
    return {
      title,
      description,
      openGraph: { title, description, url: undefined, images: [] },
      twitter: { card: "summary", title, description, images: [] },
    };
  }
  const title = card.title + " · AskGobi";
  return {
    title,
    description: card.prompt,
    openGraph: {
      title,
      description: card.prompt,
      // Next 14 strips query strings from root og:url values; omit instead of
      // incorrectly canonicalizing a shared activity to the generic homepage.
      url: undefined,
      images: [],
    },
    twitter: { card: "summary", title, description: card.prompt, images: [] },
  };
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    card?: string;
    challenge?: string;
    puzzle?: string;
    daily?: string;
  }>;
}) {
  const params = await searchParams;
  const entry = entryActivity(params);
  const puzzleId = puzzleEntry(params);
  return (
    <Playground
      key={`${entry.card?.id ?? puzzleId ?? "random"}-${entry.challenge}`}
      entry={entry}
      puzzleId={puzzleId}
      signalFlags={{
        leaderboard: process.env.SIGNAL_LEADERBOARD_ENABLED === "true",
        coach: process.env.SIGNAL_COACH_ENABLED === "true",
      }}
    />
  );
}

function puzzleEntry(params: { puzzle?: string; daily?: string }) {
  const id =
    params.daily && validDay(params.daily)
      ? "d1-" + params.daily
      : params.puzzle;
  try {
    return id && generate(id).id;
  } catch {
    return undefined;
  }
}
