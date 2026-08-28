"use client";

import Link from "next/link";
import { ArrowUpRight, Sparkles, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState } from "react";
import Activity from "./Activity";
import LazyChallenge from "./LazyChallenge";
import SignalGame, { type SignalFlags } from "./SignalGame";
import {
  cards,
  getCard,
  nextCard,
  cardUrl,
  type CuriosityCard,
} from "@/lib/curiosity/cards";
import {
  completeCard,
  DECK_KEY,
  emptyProgress,
  milestones,
  readProgress,
  writeProgress,
  type Progress,
} from "@/lib/curiosity/progress";
import { activityVisit } from "@/lib/curiosity/visit";
import { readQuizHistory, writeQuizHistory } from "@/lib/curiosity/opening";
import { track } from "@/lib/curiosity/telemetry";
import { shareLink } from "@/lib/curiosity/share";
import "./playground.css";

type Entry = {
  card: CuriosityCard | null;
  challenge: boolean;
  introductory: boolean;
};

export default function Playground({
  entry,
  puzzleId,
  signalFlags,
}: {
  entry: Entry;
  puzzleId?: string;
  signalFlags: SignalFlags;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [active, setActive] = useState(entry.card);
  const [challenge, setChallenge] = useState(entry.challenge);
  const [showPuzzle, setShowPuzzle] = useState(!entry.card && !entry.challenge);
  const [introductory, setIntroductory] = useState(entry.introductory);
  const [progress, setProgress] = useState<Progress>(emptyProgress);
  const [view, setView] = useState(0);
  const [notice, setNotice] = useState("");
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const seen = useRef<string[]>([]);
  const quizzesSeen = useRef<string[]>([]);
  const initialized = useRef(false);
  const visit = useRef(activityVisit(track));
  const buildOpened = useRef(false);
  const play = useRef<HTMLElement>(null);

  function rememberCard(card: CuriosityCard) {
    // Keep the visible card last, even when it was visited earlier in the deck.
    seen.current = [...seen.current.filter((id) => id !== card.id), card.id];
    try {
      sessionStorage.setItem(DECK_KEY, JSON.stringify(seen.current));
    } catch {}
    if (card.kind === "quiz") {
      quizzesSeen.current = [
        ...quizzesSeen.current.filter((id) => id !== card.id),
        card.id,
      ];
      try {
        writeQuizHistory(localStorage, quizzesSeen.current);
      } catch {}
    }
  }
  function surprise() {
    setShowPuzzle(false);
    const next = nextCard(seen.current);
    seen.current = next.seen;
    rememberCard(next.card);
    visit.current = activityVisit(track);
    visit.current.start();
    setActive(next.card);
    setIntroductory(false);
    setChallenge(false);
    setNotice("");
    setView((v) => v + 1);
  }
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (hash.has("access_token") || hash.has("error_description")) {
      window.location.replace(`/chat${window.location.hash}`);
      return;
    }
    if (initialized.current) return;
    initialized.current = true;
    try {
      setProgress(readProgress(localStorage));
    } catch {
      setStorageAvailable(false);
    }
    try {
      const deck = JSON.parse(sessionStorage.getItem(DECK_KEY) || "[]");
      if (Array.isArray(deck)) {
        seen.current = [
          ...new Set(
            deck.filter(
              (id): id is string => typeof id === "string" && !!getCard(id),
            ),
          ),
        ];
      }
    } catch {}
    try {
      quizzesSeen.current = readQuizHistory(localStorage);
    } catch {}
    // Seed from this tab's existing deck when upgrading from daily openings.
    if (!quizzesSeen.current.length) {
      quizzesSeen.current = seen.current.filter(
        (id) => getCard(id)?.kind === "quiz",
      );
    }
    if (!entry.challenge && entry.card) rememberCard(entry.card);
    setLoaded(true);
  }, [entry]);
  useEffect(() => {
    if (!loaded) return;
    try {
      setStorageAvailable(writeProgress(localStorage, progress));
    } catch {
      setStorageAvailable(false);
    }
  }, [progress, loaded]);
  useEffect(() => {
    if (view > 0) {
      play.current?.focus({ preventScroll: true });
      play.current?.scrollIntoView({ behavior: "auto", block: "start" });
    }
  }, [view]);
  const challengeComplete = useCallback(() => {
    setProgress((previous) => ({ ...previous, challengeCompleted: true }));
  }, []);
  const puzzleComplete = useCallback(() => {
    setProgress((previous) => ({ ...previous, puzzleCompleted: true }));
  }, []);
  function startChallenge(event: React.MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    setChallenge(true);
    setShowPuzzle(false);
    setNotice("");
    setView((v) => v + 1);
  }
  async function shareCard() {
    if (!active) return;
    track("share_intent");
    setNotice(
      await shareLink(
        "AskGobi · " + active.title,
        "A little detour for your brain.",
        cardUrl(window.location.origin, active.id),
      ),
    );
  }
  const badges = milestones(progress);
  const hasDiscoveries = badges.some((badge) => badge.earned);

  return (
    <div className="playground">
      <a className="pg-skip" href="#play">
        Skip to the activity
      </a>
      <header className="pg-header pg-container">
        <Link href="/" className="pg-logo" aria-label="AskGobi home">
          ask<span>gobi</span>
          <i />
        </Link>
        <nav aria-label="Main navigation">
          <Link href="/chat" prefetch={false} className="pg-chat-link">
            <Sparkles size={17} aria-hidden="true" /> Ask anything
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
          <button
            className="pg-icon"
            aria-label="Toggle color theme"
            onClick={() =>
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
          >
            <Sun size={18} className="pg-sun" />
            <Moon size={18} className="pg-moon" />
          </button>
        </nav>
      </header>
      <main className="pg-container pg-layout">
        <section className="pg-opening" aria-labelledby="welcome-heading">
          <div className="pg-hero">
            <h1 id="welcome-heading">
              Curious?<span>Apparently you are.</span>
            </h1>
            <p>Ask my tiny AI. Or take a little brain break.</p>
          </div>
          <section
            ref={play}
            id="play"
            tabIndex={-1}
            className="pg-play"
            aria-label={challenge ? "Tiny AI challenge" : "Curiosity activity"}
          >
            {challenge ? (
              <LazyChallenge
                key={view}
                onComplete={challengeComplete}
                onSurprise={surprise}
              />
            ) : showPuzzle ? (
              <SignalGame
                initialId={puzzleId}
                flags={signalFlags}
                onSurprises={surprise}
                onComplete={puzzleComplete}
              />
            ) : active ? (
              <Activity
                key={view}
                card={active}
                introductory={introductory}
                onComplete={() => {
                  if (visit.current.complete())
                    setProgress((previous) =>
                      completeCard(previous, active.id),
                    );
                }}
                onNext={surprise}
                onShare={() => void shareCard()}
                onAsk={() => {
                  window.location.href =
                    "/chat?card=" + encodeURIComponent(active.id);
                }}
              />
            ) : (
              <div className="pg-opening-loading" role="status">
                Picking a little surprise…
                <noscript>Enable JavaScript to play the quiz.</noscript>
              </div>
            )}
          </section>
          {!showPuzzle && (
            <button
              className="pg-small-link"
              onClick={() => {
                setChallenge(false);
                setShowPuzzle(true);
                setView((v) => v + 1);
              }}
            >
              Back to Connect the Signal
            </button>
          )}
          <p className="pg-safety">
            Found this on the road? Explore when safely parked.
          </p>
          {hasDiscoveries && (
            <details className="pg-disclosure pg-discoveries">
              <summary>Your discoveries</summary>
              <div className="pg-disclosure-content">
                <p>
                  {progress.completedCards.length} of {cards.length} cards
                  explored. Just for you, on this device.
                </p>
                <ul className="pg-milestone-rules">
                  {badges.map((badge) => (
                    <li key={badge.name}>
                      <strong className={badge.earned ? "earned" : ""}>
                        {badge.earned ? "✓ " : ""}
                        {badge.name}
                      </strong>{" "}
                      — {badge.description}
                    </li>
                  ))}
                </ul>
                {!storageAvailable && (
                  <p className="pg-status">
                    Storage is unavailable. Your progress lasts until this page
                    closes.
                  </p>
                )}
                <button
                  className="pg-small-link"
                  onClick={async () => {
                    track("share_intent");
                    setNotice(
                      await shareLink(
                        "AskGobi · Stay curious",
                        "I earned " +
                          badges
                            .filter((b) => b.earned)
                            .map((b) => b.name)
                            .join(", ") +
                          " on AskGobi.",
                        window.location.origin,
                      ),
                    );
                  }}
                >
                  Share my milestones <ArrowUpRight size={16} />
                </button>
              </div>
            </details>
          )}
          {notice && (
            <p className="pg-status" role="status">
              {notice}
            </p>
          )}
        </section>

        <div className="pg-builder-column">
          <section className="pg-builder" aria-labelledby="meet-gobi">
            <span className="pg-eyebrow">THE PERSON BEHIND THE PLAY</span>
            <h2 id="meet-gobi" tabIndex={-1}>
              Hi, I’m Gobi. I built this.
            </h2>
            <p>
              I build web apps and AI tools. For AskGobi, I focused on a puzzle
              you can play instantly, checked results, and useful failure
              states.
            </p>
            <p>
              I put “Curious? AskGobi.net” on my car to give strangers a reason
              to explore something I built.
            </p>
            <details
              className="pg-disclosure"
              onToggle={(event) => {
                if (event.currentTarget.open && !buildOpened.current) {
                  buildOpened.current = true;
                  track("build_details_open");
                }
              }}
            >
              <summary>Behind the build</summary>
              <div className="pg-disclosure-content">
                <p>
                  <strong>Small game, exact rules.</strong> A stranger following
                  a URL shouldn’t wait for a model. Seeded boards and an exact
                  path solver make Connect the Signal immediately playable, with
                  checked difficulty and reproducible shared puzzles. The
                  trade-off is a deliberately small board, not endless
                  complexity.{" "}
                  <a
                    href="https://github.com/Gobi-96/AskGobi-app/blob/main/lib/puzzle/engine.ts"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Read the engine
                  </a>{" "}
                  and{" "}
                  <a
                    href="https://github.com/Gobi-96/AskGobi-app/blob/main/tests/puzzle.test.ts"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    solver tests.
                  </a>
                </p>
                <p>
                  <strong>Scores with boundaries.</strong> When public ranking
                  is enabled, the server replays moves, validates expiring
                  tickets, and atomically keeps a guest’s best daily result.
                  Private cookie identities stay separate from saved chats.
                  Valid replay prevents fabricated scores—not outside help or
                  multiple guest identities.{" "}
                  <a
                    href="https://github.com/Gobi-96/AskGobi-app/blob/main/lib/server/signalSecurity.ts"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Read score validation
                  </a>{" "}
                  and{" "}
                  <a
                    href="https://github.com/Gobi-96/AskGobi-app/blob/main/scripts/test-signal-db.mjs"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    database checks.
                  </a>
                </p>
                <p>
                  <strong>AI helps, but doesn’t judge.</strong> Practice hints
                  come from the solver. Optional Ollama explanations use those
                  verified moves, share chat’s bounded generation queue, and
                  stop after 20 seconds including waiting. The hint survives
                  model failure. This is an AI-assisted puzzle coach, not an
                  autonomous agent; explanations can still be wrong.{" "}
                  <a
                    href="https://github.com/Gobi-96/AskGobi-app/blob/main/lib/server/signalCoach.ts"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Read the coach
                  </a>{" "}
                  and{" "}
                  <a
                    href="https://github.com/Gobi-96/AskGobi-app/blob/main/tests/signal-server.test.ts"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    fallback tests.
                  </a>
                </p>
                <p>
                  Next.js ties the experience together; Cloudflare connects the
                  home server, and Supabase handles private saved conversations
                  separately from public play. Website availability still
                  depends on the home server.
                </p>
                <a
                  className="pg-small-link"
                  href="https://github.com/Gobi-96/AskGobi-app"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Explore the project <ArrowUpRight size={16} />
                </a>
                <br />
                <a
                  className="pg-small-link"
                  href="https://github.com/Gobi-96"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Find me on GitHub <ArrowUpRight size={16} />
                </a>
              </div>
            </details>
            <div className="pg-exploration">
              <Link className="pg-small-link" href="/chat">
                Chat with the AI <ArrowUpRight size={16} />
              </Link>
              <a
                className="pg-small-link"
                href="/?challenge=1"
                onClick={startChallenge}
              >
                Challenge the AI <ArrowUpRight size={16} />
              </a>
            </div>
          </section>

          <section className="pg-contact" aria-labelledby="contact-heading">
            <span className="pg-eyebrow">LET’S MAKE SOMETHING USEFUL</span>
            <h2 id="contact-heading">Building a team—or something useful?</h2>
            <p>
              Interested in how I approach web apps and AI tools? Let’s talk
              about a role, a collaboration, or an idea.
            </p>
            <a
              className="pg-button pg-primary"
              href="https://www.linkedin.com/in/gobishankar-rathinam"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track("contact_intent")}
            >
              Talk to Gobi on LinkedIn <ArrowUpRight size={17} />
            </a>
          </section>
        </div>
      </main>
      <footer className="pg-container pg-footer">
        <details className="pg-disclosure pg-privacy">
          <summary>A little about privacy</summary>
          <div className="pg-disclosure-content">
            <p>
              Your discoveries, practice progress and personal bests stay in
              this browser. We count activity events, coach use, leaderboard
              posts, build-detail opens, and contact clicks in aggregate,
              without questions, transcripts, locations, or visitor IDs. A share
              or contact click records intent—not a completed share or a
              conversation.
            </p>
            <p>
              Publishing a daily score is optional. It creates a private,
              HttpOnly browser cookie; the server stores only its hash. Public
              entries show initials with a discriminator and scores, never that
              identifier. No email or chat history is attached. While the cookie
              remains, use “Remove my leaderboard data” in the leaderboard.
              Clearing browser data loses access; identity does not sync across
              devices. Used submission receipts remain briefly after deletion
              without your alias or identity to prevent replay.
            </p>
            <p>
              Challenge answers aren’t saved as chats. Saved conversations in
              Chat with the AI still use your existing account. Sharing a card
              or milestone never publishes your questions or chat history.
              LinkedIn and GitHub are external sites with their own privacy
              policies.
            </p>
          </div>
        </details>
        <span>© 2025 AskGobi · Stay curious.</span>
      </footer>
    </div>
  );
}
