"use client";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ArrowRight, Share2, Square, Zap } from "lucide-react";
import { consumeAnswer } from "@/lib/ndjson";
import { shareLink } from "@/lib/curiosity/share";
import { track } from "@/lib/curiosity/telemetry";

const starters = [
  "What weighs more: a kilogram of feathers or a kilogram of steel?",
  "I pass the runner in second place. What place am I in?",
  "Can you explain why 0.999… equals 1 in two sentences?",
];
type Status = "idle" | "pending" | "complete" | "error" | "stopped";
type Verdict = "held_up" | "stumped" | "unsure";
export default function Challenge({
  onComplete,
  onSurprise,
}: {
  onComplete: () => void;
  onSurprise: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [notice, setNotice] = useState("");
  const [slow, setSlow] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function run(query: string) {
    if (!query.trim() || controller.current) return;
    const abort = new AbortController();
    controller.current = abort;
    setQuestion(query);
    setAnswer("");
    setError("");
    setVerdict(null);
    setStatus("pending");
    setSlow(false);
    setNotice("");
    track("challenge_start");
    const slowTimer = setTimeout(() => setSlow(true), 8000);
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, mode: "challenge" }),
        signal: abort.signal,
      });
      await consumeAnswer(response, setAnswer);
      if (abort.signal.aborted) throw new DOMException("Stopped", "AbortError");
      setStatus("complete");
      track("challenge_complete");
      onComplete();
    } catch (err) {
      setStatus(abort.signal.aborted ? "stopped" : "error");
      setError(
        abort.signal.aborted
          ? "Stopped. No verdict recorded."
          : err instanceof TypeError
            ? "Couldn’t reach the tiny AI. Check your connection or try a surprise instead."
            : err instanceof Error
              ? err.message
              : "The tiny AI is unavailable. Try a surprise instead.",
      );
    } finally {
      clearTimeout(slowTimer);
      controller.current = null;
      setSlow(false);
    }
  }
  function vote(value: Verdict) {
    if (status !== "complete" || verdict) return;
    setVerdict(value);
    track(
      value === "held_up"
        ? "verdict_held_up"
        : value === "stumped"
          ? "verdict_stumped"
          : "verdict_unsure",
    );
  }
  return (
    <article className="pg-challenge">
      <div className="pg-eyebrow">
        <Zap size={15} /> HUMAN × TINY LOCAL AI
      </div>
      <h2>Can you stump it?</h2>
      <p className="pg-prompt">
        One question. No web search, no earlier chat, no backup brain.
      </p>
      {status === "idle" && (
        <div className="pg-starters">
          {starters.map((prompt) => (
            <button key={prompt} onClick={() => void run(prompt)}>
              {prompt}
              <ArrowRight size={16} />
            </button>
          ))}
        </div>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run(question);
        }}
      >
        <label htmlFor="challenge-question">Or bring your own question</label>
        <textarea
          ref={input}
          id="challenge-question"
          value={question}
          maxLength={500}
          disabled={status === "pending"}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Something clever, curious, or unexpectedly simple…"
          rows={3}
        />
        <div className="pg-form-footer">
          <span>{question.length}/500 · AI can make mistakes.</span>
          {status === "pending" ? (
            <button
              type="button"
              className="pg-button pg-secondary"
              onClick={() => controller.current?.abort()}
            >
              <Square size={14} /> Stop
            </button>
          ) : (
            <button
              className="pg-button pg-primary"
              disabled={!question.trim()}
            >
              Ask the tiny AI <ArrowRight size={16} />
            </button>
          )}
        </div>
      </form>
      {status === "pending" && (
        <p role="status" className="pg-status">
          {slow
            ? "The tiny brain is taking its time. You can stop or try a surprise."
            : answer
              ? "The tiny AI is answering…"
              : "Waking up a few neural circuits…"}
        </p>
      )}
      {answer && (
        <div className="pg-ai-answer">
          <span className="pg-eyebrow">
            TINY AI’S ANSWER {status !== "complete" && "· NOT YET COMPLETE"}
          </span>
          <ReactMarkdown skipHtml>{answer}</ReactMarkdown>
        </div>
      )}
      {error && (
        <p role="alert" className="pg-error">
          {error}
        </p>
      )}
      {status === "complete" && (
        <div className="pg-verdict">
          <h3>How did it do?</h3>
          <p>Your opinion, not a verified accuracy score.</p>
          <div>
            {(
              [
                ["held_up", "AI held up"],
                ["stumped", "I stumped it"],
                ["unsure", "Not sure"],
              ] as const
            ).map(([value, label]) => (
              <button
                className={verdict === value ? "selected" : ""}
                disabled={verdict !== null}
                key={value}
                onClick={() => vote(value)}
                aria-pressed={verdict === value}
              >
                {label}
              </button>
            ))}
          </div>
          {verdict && (
            <p role="status">Your verdict is in. Curiosity wins either way.</p>
          )}
        </div>
      )}
      <div className="pg-activity-actions">
        {status !== "idle" && status !== "pending" && (
          <button
            className="pg-button pg-secondary"
            onClick={() => {
              setStatus("idle");
              setAnswer("");
              setError("");
              setQuestion("");
              setVerdict(null);
              setNotice("");
              input.current?.focus();
            }}
          >
            Try another
          </button>
        )}
        {status === "complete" && (
          <button
            className="pg-small-link"
            onClick={async () => {
              track("share_intent");
              setNotice(
                await shareLink(
                  "AskGobi · Challenger",
                  "I earned the Challenger milestone on AskGobi. Your turn?",
                  window.location.origin + "/?challenge=1",
                ),
              );
            }}
          >
            <Share2 size={15} /> Share my result
          </button>
        )}
        <button className="pg-small-link" onClick={onSurprise}>
          Back to surprises <ArrowRight size={15} />
        </button>
      </div>
      {notice && (
        <p className="pg-status" role="status">
          {notice}
        </p>
      )}
    </article>
  );
}
