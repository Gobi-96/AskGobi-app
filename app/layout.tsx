import "./globals.css";
import { ClientThemeProvider } from "@/components/ClientThemeProvider";

export const metadata = {
  metadataBase: new URL("https://askgobi.net"),
  title: "AskGobi · Curious? You’re in the right place.",
  description:
    "Ask a tiny local AI, play Connect the Signal, and meet Gobi—the builder behind both. No account needed to explore.",
  openGraph: {
    title: "AskGobi · Curious? You’re in the right place.",
    description: "A little surprise for your curiosity. Play, discover, and meet Gobi.",
    url: "https://askgobi.net",
    siteName: "AskGobi",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1729,
        height: 910,
        alt: "AskGobi — Curious? You’re in the right place.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AskGobi · Curious? You’re in the right place.",
    description: "A little surprise for your curiosity. Play, discover, and meet Gobi.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ClientThemeProvider>{children}</ClientThemeProvider>
      </body>
    </html>
  );
}
