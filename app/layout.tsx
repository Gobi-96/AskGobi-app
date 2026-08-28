import "./globals.css";
import { ClientThemeProvider } from "@/components/ClientThemeProvider";

export const metadata = {
  metadataBase: new URL("https://askgobi.net"),
  title: "AskGobi · Curious? Apparently you are.",
  description:
    "Ask a tiny local AI, play Connect the Signal, and meet Gobi—the builder behind both. No account needed to explore.",
  openGraph: {
    title: "AskGobi · Curious? Apparently you are.",
    description: "Ask my tiny AI. Or take a little brain break. Built by Gobi.",
    url: "https://askgobi.net",
    siteName: "AskGobi",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1729,
        height: 910,
        alt: "AskGobi — Curious? Apparently you are.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AskGobi · Curious? Apparently you are.",
    description: "Ask my tiny AI. Or take a little brain break. Built by Gobi.",
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
