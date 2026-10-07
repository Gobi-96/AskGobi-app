import Playground from "@/components/playground/Playground";
import { entryActivity, getCard } from "@/lib/curiosity/cards";
import type { Metadata } from "next";
import { generate, validDay } from "@/lib/puzzle/engine";

export function generateMetadata({
  searchParams,
}: {
  searchParams: { card?: string; puzzle?: string; daily?: string };
}): Metadata {
  const card = getCard(searchParams.card);
  if (!card) {
    const id = puzzleEntry(searchParams);
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

export default function Home({
  searchParams,
}: {
  searchParams: {
    card?: string;
    challenge?: string;
    puzzle?: string;
    daily?: string;
  };
}) {
  const entry = entryActivity(searchParams);
  const puzzleId = puzzleEntry(searchParams);
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
