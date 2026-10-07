"use client";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  RotateCcw,
  Share2,
} from "lucide-react";
import type { CuriosityCard } from "@/lib/curiosity/cards";

export default function Activity({
  card,
  onComplete,
  onNext,
  onShare,
  onAsk,
  introductory = false,
}: {
  card: CuriosityCard;
  onComplete: () => void;
  onNext: () => void;
  onShare: () => void;
  onAsk: () => void;
  introductory?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  function reveal(index?: number) {
    if (revealed) return;
    if (index !== undefined) setSelected(index);
    setRevealed(true);
    onComplete();
  }
  return (
    <article className="pg-activity">
      {!introductory && (
        <div className="pg-eyebrow">
          {card.kind === "fact"
            ? "A CURIOUS FACT"
            : card.kind === "quiz"
              ? "A QUICK BRAIN TEASER"
              : "A LITTLE RIDDLE"}
        </div>
      )}
      <h2 className="pg-question">{card.prompt}</h2>
      {card.kind === "quiz" && (
        <div className="pg-options" role="group" aria-label="Answer choices">
          {card.options.map((option, i) => (
            <button
              key={option}
              aria-disabled={revealed}
              className={
                revealed && i === card.answerIndex
                  ? "correct"
                  : revealed && i === selected
                    ? "incorrect"
                    : ""
              }
              onClick={() => reveal(i)}
            >
              {option}
              {revealed && i === card.answerIndex && (
                <Check size={18} aria-label="Correct answer" />
              )}
            </button>
          ))}
        </div>
      )}
      {card.kind === "riddle" && !revealed && (
        <button className="pg-button pg-primary" onClick={() => reveal()}>
          Reveal the answer <ArrowRight size={17} />
        </button>
      )}
      {(revealed || card.kind === "fact") && (
        <div className="pg-reveal" role="status">
          {card.kind === "riddle" && <strong>{card.answer}</strong>}
          {card.kind === "quiz" && (
            <strong>
              {selected === card.answerIndex ? "You got it." : "A sneaky one."}{" "}
              The answer: {card.options[card.answerIndex]}.
            </strong>
          )}
          <p>{card.explanation}</p>
          {card.kind === "fact" && (
            <a href={card.source.url} target="_blank" rel="noopener noreferrer">
              {card.source.label} <ArrowUpRight size={14} />
            </a>
          )}
        </div>
      )}
      {card.kind === "fact" && !revealed && (
        <button className="pg-button pg-primary" onClick={() => reveal()}>
          Got it. That’s a good one. <Check size={17} />
        </button>
      )}
      {!revealed && (
        <div className="pg-skip-activity">
          <button className="pg-small-link" onClick={onNext}>
            Skip this one <ArrowRight size={15} />
          </button>
        </div>
      )}
      {revealed && (
        <div className="pg-activity-actions">
          <button className="pg-button pg-primary" onClick={onNext}>
            <RotateCcw size={16} /> Surprise me
          </button>
          <button className="pg-small-link" onClick={onAsk}>
            Ask the AI why <ArrowUpRight size={15} />
          </button>
          <button className="pg-small-link" onClick={onShare}>
            <Share2 size={15} /> Share
          </button>
        </div>
      )}
    </article>
  );
}
