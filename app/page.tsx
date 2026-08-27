import Playground from "@/components/playground/Playground";
import { getCard } from "@/lib/curiosity/cards";
import type { Metadata } from "next";

export function generateMetadata({
  searchParams,
}: {
  searchParams: { card?: string };
}): Metadata {
  const card = getCard(searchParams.card);
  if (!card) return {};
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

export default function Home() {
  return <Playground />;
}
