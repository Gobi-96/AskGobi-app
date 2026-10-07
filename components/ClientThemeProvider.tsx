"use client";
import { ThemeProvider } from "next-themes";

export function ClientThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="askgobi-appearance" disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}
