"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, MessageCircle, RotateCw, Share2 } from "lucide-react";
import {
  directions,
  generate,
  hint,
  MAX_MOVES,
  ports,
  readPuzzle,
  replay,
  signal,
  utcDay,
  type CoachHint,
  type PuzzleDefinition,
  type PuzzleRun,
} from "@/lib/puzzle/engine";
import {
  emptyPuzzleProgress,
  freshPuzzle,
  readPuzzleProgress,
  recordRun,
  savePuzzleProgress,
  type PuzzleProgress,
} from "@/lib/puzzle/progress";
import { shareLink } from "@/lib/curiosity/share";
import { track } from "@/lib/curiosity/telemetry";
import SignalLeaderboard from "./SignalLeaderboard";
import "./signal.css";

export type SignalFlags = { leaderboard: boolean; coach: boolean };
async function jsonRequest(path: string, body?: unknown, abort?: AbortSignal) {
  const response = await fetch(path, {
    ...(body !== undefined
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
    signal: abort,
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      data.error || "This service is unavailable. Practice still works.",
    );
  return data;
}
export default function SignalGame({
  initialId,
  flags,
  onSurprises,
  onComplete,
}: {
  initialId?: string;
  flags: SignalFlags;
  onSurprises: () => void;
  onComplete: () => void;
}) {
  const [puzzle, setPuzzle] = useState<PuzzleDefinition | null>(null);
  const [moves, setMoves] = useState<number[]>([]);
  const [progress, setProgress] = useState<PuzzleProgress>(emptyPuzzleProgress);
  const [resume, setResume] = useState<PuzzleRun | undefined>();
  const [stored, setStored] = useState(true);
  const [ticket, setTicket] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [suggestion, setSuggestion] = useState<CoachHint | null>(null);
  const [explanation, setExplanation] = useState("");
  const [explanationGenerated, setExplanationGenerated] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [notice, setNotice] = useState("");
  const [initials, setInitials] = useState("");
  const [posting, setPosting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [posted, setPosted] = useState(false);
  const [revision, setRevision] = useState(0);
  const initialized = useRef(false),
    alive = useRef(true);
  const latest = useRef(emptyPuzzleProgress());
  const controller = useRef<AbortController | null>(null);
  const dailyController = useRef<AbortController | null>(null);
  const focusBoard = useRef<HTMLHeadingElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const persist = useCallback((value: PuzzleProgress) => {
    latest.current = value;
    setProgress(value);
    try {
      setStored(savePuzzleProgress(localStorage, value));
    } catch {
      setStored(false);
    }
  }, []);
  const begin = useCallback(
    (
      board: PuzzleDefinition,
      savedMoves: number[] = [],
      rankedTicket: string | null = null,
    ) => {
      controller.current?.abort();
      setExplaining(false);
      setPuzzle(board);
      setMoves(savedMoves);
      setTicket(rankedTicket);
      setSuggestion(null);
      setExplanation("");
      setNotice("");
      setPosted(false);
      setInitials("");
      persist(recordRun(latest.current, { puzzle: board, moves: savedMoves }));
    },
    [persist],
  );
  useEffect(() => {
    alive.current = true;
    if (!initialized.current) {
      initialized.current = true;
      let saved = emptyPuzzleProgress();
      try {
        saved = readPuzzleProgress(localStorage);
      } catch {}
      latest.current = saved;
      if (
        saved.run &&
        !signal(replay(saved.run.puzzle, saved.run.moves)).solved &&
        saved.run.moves.length
      )
        setResume(saved.run);
      let board: PuzzleDefinition;
      try {
        board = initialId ? generate(initialId) : freshPuzzle(saved.seen);
      } catch {
        board = freshPuzzle(saved.seen);
      }
      begin(board);
    }
    return () => {
      alive.current = false;
      controller.current?.abort();
      dailyController.current?.abort();
    };
  }, [begin, initialId]);
  const tiles = puzzle ? replay(puzzle, moves) : [];
  const state = tiles.length ? signal(tiles) : { solved: false, lit: [] };
  function turn(index: number) {
    if (!puzzle || state.solved || pending || moves.length >= MAX_MOVES) return;
    if (!moves.length) track("puzzle_start");
    controller.current?.abort();
    setExplaining(false);
    setSuggestion(null);
    setExplanation("");
    const next = [...moves, index];
    setMoves(next);
    const value = recordRun(latest.current, { puzzle, moves: next });
    persist(value);
    if (signal(replay(puzzle, next)).solved) {
      track("puzzle_complete");
      onComplete();
    }
  }
  function another() {
    track("puzzle_replay");
    setResume(undefined);
    begin(freshPuzzle(latest.current.seen));
    focusBoard.current?.focus({ preventScroll: true });
    focusBoard.current?.scrollIntoView({ block: "start", behavior: "auto" });
  }
  async function daily() {
    if (pending) return;
    const abort = new AbortController();
    dailyController.current = abort;
    setPending(true);
    setNotice("");
    try {
      const data = await jsonRequest(
        "/api/puzzle/daily",
        undefined,
        abort.signal,
      );
      // Use the server's frozen board, verifying its shape and minimum locally.
      const local = readPuzzle(data.board);
      if (flags.leaderboard && data.rankingEnabled) {
        const attempt = await jsonRequest(
          "/api/puzzle/attempt",
          { day: local.day },
          abort.signal,
        );
        if (alive.current) begin(readPuzzle(attempt.board), [], attempt.ticket);
      } else if (alive.current) {
        begin(local);
        setNotice(
          "Today’s board is available as practice. Public scores are not enabled yet.",
        );
      }
    } catch {
      if (!abort.signal.aborted && alive.current) {
        begin(generate("d1-" + utcDay()));
        setNotice(
          "Leaderboard unavailable—your practice result is saved on this device when storage is available.",
        );
      }
    } finally {
      if (alive.current) {
        setPending(false);
        focusBoard.current?.focus({ preventScroll: true });
        focusBoard.current?.scrollIntoView({
          block: "start",
          behavior: "auto",
        });
      }
      dailyController.current = null;
    }
  }
  async function explain() {
    if (!puzzle || !suggestion || explaining) return;
    const abort = new AbortController();
    controller.current = abort;
    setExplaining(true);
    setExplanation("");
    track("coach_use");
    try {
      const data = await jsonRequest(
        "/api/puzzle/coach",
        { tiles },
        abort.signal,
      );
      if (!abort.signal.aborted && alive.current) {
        setExplanationGenerated(true);
        setExplanation(data.explanation);
      }
    } catch {
      if (!abort.signal.aborted && alive.current) {
        setExplanationGenerated(false);
        setExplanation(
          "The local AI couldn’t explain this move. The solver-verified hint above still works.",
        );
      }
    } finally {
      if (controller.current === abort) {
        controller.current = null;
        if (alive.current) setExplaining(false);
      }
    }
  }
  async function publish(event: React.FormEvent) {
    event.preventDefault();
    if (!ticket || !puzzle || posting || posted || removing) return;
    setPosting(true);
    setNotice("");
    try {
      const result = await jsonRequest("/api/puzzle/score", {
        ticket,
        moves,
        initials,
      });
      if (!alive.current) return;
      setPosted(true);
      setRevision((n) => n + 1);
      track("leaderboard_post");
      setNotice(
        result.rank
          ? result.count === 1
            ? `First entry for ${result.day}! Saved as ${result.alias}.`
            : `Saved as ${result.alias}. Rank ${result.rank} for ${result.day} at submission time.`
          : `Saved as ${result.alias}. Your rank is temporarily unavailable.`,
      );
    } catch (error) {
      if (alive.current)
        setNotice(
          error instanceof Error
            ? error.message
            : "Could not publish. Your result remains on this device.",
        );
    } finally {
      if (alive.current) setPosting(false);
    }
  }
  if (!puzzle)
    return (
      <p className="pg-opening-loading sg-loading" role="status">
        Connecting a little surprise…
      </p>
    );
  return (
    <article className="sg-game">
      <div className="sg-game-heading">
        <span className="pg-eyebrow">
          {ticket
            ? `DAILY CHALLENGE · ${puzzle.day} UTC`
            : puzzle.day
              ? `${puzzle.day} · PRACTICE`
              : "A LITTLE CONNECTION"}
        </span>
        <span className="sg-moves">
          Moves <strong>{moves.length}</strong>
        </span>
      </div>
      <h2 ref={focusBoard} tabIndex={-1}>
        Connect the Signal
      </h2>
      <p className="sg-instructions">
        Tap the tiles. Connect the blue signal to <strong>G</strong>.
      </p>
      <div className="sg-board-shell">
        <span
          className="sg-terminal sg-source"
          aria-label="Signal enters from the left"
        >
          →
        </span>
        <div
          className="sg-board"
          role="group"
          aria-label="Nine rotating connection tiles"
        >
          {tiles.map((tile, index) => (
            <button
              key={index}
              className={`sg-tile ${state.lit.includes(index) ? "sg-powered" : ""} ${suggestion?.tile === index ? "sg-hinted" : ""}`}
              aria-disabled={
                state.solved || pending || moves.length >= MAX_MOVES
              }
              aria-label={`Row ${Math.floor(index / 3) + 1}, column ${(index % 3) + 1}: opens ${ports(
                tile,
              )
                .map((d) => directions[d])
                .join(
                  " and ",
                )}${state.lit.includes(index) ? "; signal connected" : ""}. Rotate clockwise.`}
              onClick={() => turn(index)}
            >
              <span className="sg-pipe" aria-hidden="true">
                {ports(tile).map((d) => (
                  <i key={d} className={`sg-arm sg-direction-${d}`} />
                ))}
                <i className="sg-joint" />
              </span>
              {suggestion?.tile === index && (
                <span className="sg-hint-marker" aria-hidden="true">
                  ↻
                </span>
              )}
            </button>
          ))}
        </div>
        <span
          className={`sg-terminal sg-goal ${state.solved ? "sg-connected" : ""}`}
          aria-label={state.solved ? "Gobi connected" : "Goal: Gobi"}
        >
          G
        </span>
      </div>
      <p className="sg-rule">
        Each tap turns one tile clockwise. Match the openings.
      </p>
      <span className="sr-only" role="status">
        {moves.length} {moves.length === 1 ? "move" : "moves"}.{" "}
        {state.lit.length} {state.lit.length === 1 ? "tile" : "tiles"} connected
        to the entrance.
      </span>
      {state.solved ? (
        <div className="pg-reveal" role="status">
          <strong>Connected in {moves.length} moves.</strong>
          <p>
            Shortest route: {puzzle.minimum}. Your best on this board:{" "}
            {progress.best[puzzle.id] ?? moves.length}.
          </p>
        </div>
      ) : (
        <>
          {!ticket && (
            <button
              className="pg-small-link"
              onClick={() => {
                setSuggestion(hint(tiles));
                setExplanation("");
              }}
            >
              Show a hint
            </button>
          )}
          {ticket && (
            <p className="sg-rule">
              Ranked attempt · no in-game coaching. Best result counts; retries
              are welcome.
            </p>
          )}
          {moves.length >= MAX_MOVES && (
            <p role="status">
              This attempt reached 256 moves. Try another signal or restart
              today’s challenge.
            </p>
          )}
        </>
      )}
      {suggestion && !state.solved && (
        <div className="sg-coach">
          <strong>Solver-verified hint</strong>
          <p role="status">{suggestion.explanation}</p>
          {flags.coach && (
            <button
              className="pg-small-link"
              onClick={
                explaining
                  ? () => {
                      controller.current?.abort();
                      setExplaining(false);
                    }
                  : () => void explain()
              }
            >
              {explaining ? "Stop explanation" : "Explain this move"}
            </button>
          )}
          {explaining && (
            <p role="status">
              The local AI is explaining… The verified hint is already ready.
            </p>
          )}
          {explanation && (
            <div role="status">
              <strong>
                {explanationGenerated
                  ? "AI-generated explanation · may be wrong"
                  : "Verified hint still available"}
              </strong>
              <p>{explanation}</p>
            </div>
          )}
        </div>
      )}
      {state.solved && ticket && !posted && (
        <form className="sg-publish" onSubmit={publish}>
          <label htmlFor="signal-initials">
            Add your initials to the leaderboard
          </label>
          <p>
            Optional. Your initials and score become public. A private browser
            cookie remembers you on this device, not across devices. Clearing
            browser data loses access to this identity. Remove your scores from
            the leaderboard below while the cookie remains.
          </p>
          <div>
            <input
              ref={input}
              id="signal-initials"
              value={initials}
              onChange={(e) =>
                setInitials(
                  e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z]/g, "")
                    .slice(0, 3),
                )
              }
              minLength={2}
              maxLength={3}
              pattern="[A-Z]{2,3}"
              autoComplete="off"
              placeholder="GS"
              required
              aria-label="Your initials, two or three letters"
            />
            <button
              className="pg-button pg-primary"
              disabled={posting || removing}
            >
              {posting ? "Saving…" : "Publish my result"}
            </button>
          </div>
        </form>
      )}
      {notice && (
        <p className="pg-status" role="status">
          {notice}
        </p>
      )}
      {!stored && (
        <p className="sg-rule" role="status">
          Browser storage is unavailable. Progress lasts while this page stays
          open.
        </p>
      )}
      <div
        className={`sg-actions${state.solved ? " sg-actions-solved" : ""}`}
        role="group"
        aria-label="Keep exploring"
      >
        <button
          className={state.solved ? "pg-button pg-primary" : "pg-small-link"}
          disabled={pending || posting || removing}
          onClick={another}
        >
          <RotateCw size={16} /> Another signal
        </button>
        {state.solved && (
          <Link
            href="/chat"
            prefetch={false}
            className="pg-button pg-secondary sg-chat-link"
          >
            <MessageCircle size={17} aria-hidden="true" /> Chat with my AI
          </Link>
        )}
      </div>
      <details className="sg-more">
        <summary>Daily challenge, sharing &amp; more</summary>
        <div className="sg-more-actions">
          <button
            className="pg-small-link"
            disabled={pending || posting || removing}
            onClick={() => void daily()}
          >
            {pending ? "Opening today’s board…" : "Today’s challenge"}
          </button>
          <button
            className="pg-small-link"
            onClick={async () => {
              track("share_intent");
              setNotice(
                await shareLink(
                  "AskGobi · Connect the Signal",
                  state.solved
                    ? `I connected this signal in ${moves.length} moves. Your turn?`
                    : "Can you connect the signal?",
                  window.location.origin +
                    (puzzle.day
                      ? "/?daily=" + puzzle.day
                      : "/?puzzle=" + puzzle.id),
                ),
              );
            }}
          >
            <Share2 size={15} /> Share this puzzle
          </button>
          <button className="pg-small-link" onClick={onSurprises}>
            More surprises <ArrowRight size={15} />
          </button>
        </div>
      </details>
      {resume && !moves.length && !ticket && (
        <button
          className="pg-small-link"
          onClick={() => {
            begin(resume.puzzle, resume.moves);
            setResume(undefined);
            focusBoard.current?.focus({ preventScroll: true });
            focusBoard.current?.scrollIntoView({
              block: "start",
              behavior: "auto",
            });
          }}
        >
          Resume previous practice puzzle
        </button>
      )}
      <SignalLeaderboard
        enabled={flags.leaderboard}
        revision={revision}
        busy={posting || pending}
        onRemoving={setRemoving}
        onRemoved={() => {
          setTicket(null);
          setPosted(false);
          setNotice(
            "Your leaderboard data was removed. Your local practice result remains.",
          );
        }}
      />
    </article>
  );
}
