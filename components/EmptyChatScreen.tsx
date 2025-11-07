"use client";
import React from "react";

export default function EmptyChatScreen({
  askExample,
  theme,
}: {
  askExample: (text: string) => void;
  theme: string | undefined;
}) {
  const examples = [
    "Tell me something about Pondicherry.",
    "What’s the capital of Japan?",
    "Who created you?",
  ];

  return (
    <div className="flex flex-col items-center text-center space-y-6 mt-24">
      <p
        className={`text-lg sm:text-xl font-medium ${
          theme === "light" ? "text-gray-600" : "text-gray-400"
        }`}
      >
        Answering your questions short & crisp.
      </p>

      <div className="space-y-3 text-gray-400 mt-2">
        <p>Examples you can try:</p>
        <ul className="space-y-2">
          {examples.map((example, index) => (
            <li key={index}>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  askExample(example);
                }}
                className="text-blue-400 hover:text-blue-300 hover:underline transition-colors"
              >
                • {example}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
