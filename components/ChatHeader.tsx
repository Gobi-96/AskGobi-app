"use client";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export default function ChatHeader() {
  const { theme, setTheme } = useTheme();

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 backdrop-blur-md
        ${theme === "light"
          ? "bg-white/80 border-b border-gray-200"
          : "bg-[#0d0d0d]/80 border-b border-gray-800 text-white"}`}
    >
      <h1 className="text-3xl font-bold">
        <span className={theme === "light" ? "text-gray-900" : "text-white"}>Ask</span>
        <span className="text-blue-500">Gobi</span>
      </h1>

      <button
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className={`p-2 rounded-full border transition
          ${theme === "light"
            ? "bg-gray-200 hover:bg-gray-300 border-gray-300 text-gray-800"
            : "bg-gray-700 hover:bg-gray-600 border-gray-600 text-yellow-300"}`}
      >
        {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
      </button>
    </header>
  );
}
