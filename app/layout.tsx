import "./globals.css";
import { ClientThemeProvider } from "@/components/ClientThemeProvider";

export const metadata = {
  metadataBase: new URL("https://askgobi.net"),
  title: "AskGobi · Curious? Apparently you are.",
  description:
    "A little detour for your brain. Discover a surprise, solve a riddle, or challenge a tiny local AI. No account needed.",
  openGraph: {
    title: "AskGobi · Curious? Apparently you are.",
    description: "You found AskGobi. Stay for a little surprise.",
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
    description: "You found AskGobi. Stay for a little surprise.",
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
