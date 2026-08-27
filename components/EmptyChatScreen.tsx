"use client";
import type { ReactNode } from "react";
import { ArrowUpRight, Lightbulb, Compass, WandSparkles, UserRound } from "lucide-react";

const starters = [
  { title: "Everyday mysteries", prompt: "Why do we get hiccups?", icon: Lightbulb },
  { title: "Explain simply", prompt: "How does GPS find me?", icon: Compass },
  { title: "Imagine something", prompt: "Invent a ridiculous superhero.", icon: WandSparkles },
  { title: "Meet the maker", prompt: "Who’s behind AskGobi?", icon: UserRound },
];

export default function EmptyChatScreen({ askExample, children }: {
  askExample: (text: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="chat-welcome">
      <div className="chat-intro">
        <span className="chat-eyebrow">A LITTLE DETOUR FOR YOUR BRAIN</span>
        <h1>What got you <span>curious?</span></h1>
        <p>Small AI. Short answers. Room for big questions.</p>
      </div>
      {children}
      <div className="chat-starters" aria-label="Conversation starters">
        {starters.map(({ title, prompt, icon: Icon }) => (
          <button type="button" className="chat-starter" key={title} onClick={() => askExample(prompt)}>
            <span className="chat-starter-top"><Icon size={19} aria-hidden="true" /><ArrowUpRight size={16} aria-hidden="true" /></span>
            <strong>{title}</strong><span>{prompt}</span>
          </button>
        ))}
      </div>
      <p className="chat-welcome-note">No account needed. Just bring a question.</p>
    </div>
  );
}
