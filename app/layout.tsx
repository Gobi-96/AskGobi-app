import "./globals.css";
import { ClientThemeProvider } from "@/components/ClientThemeProvider";

export const metadata = {
  title: "AskGobi",
  description: "Ask anything — powered by AI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ClientThemeProvider>{children}</ClientThemeProvider>
      </body>
    </html>
  );
}
