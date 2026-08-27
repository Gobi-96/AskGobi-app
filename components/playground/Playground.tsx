"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  Sparkles,
  Zap,
  Moon,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState } from "react";
import Activity from "./Activity";
import Challenge from "./Challenge";
import {
  cards,
  dailyCard,
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
import { track } from "@/lib/curiosity/telemetry";
import { shareLink } from "@/lib/curiosity/share";
import "./playground.css";

export default function Playground() {
  const { resolvedTheme, setTheme } = useTheme();
  const [active, setActive] = useState<CuriosityCard | null>(null);
  const [challenge, setChallenge] = useState(false);
  const [progress, setProgress] = useState<Progress>(emptyProgress);
  const [today, setToday] = useState(dailyCard);
  const [view, setView] = useState(0);
  const [notice, setNotice] = useState("");
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const seen = useRef<string[]>([]);
  const initialized = useRef(false);
  const completedView = useRef(false);
  const play = useRef<HTMLElement>(null);
  const showCard = useCallback((card: CuriosityCard) => {
    if (!seen.current.includes(card.id)) seen.current.push(card.id);
    try {
      sessionStorage.setItem(DECK_KEY, JSON.stringify(seen.current));
    } catch {}
    completedView.current = false;
    setActive(card);
    setChallenge(false);
    setNotice("");
    setView((v) => v + 1);
    track("activity_start");
  }, []);
  const surprise = () => {
    const next = nextCard(seen.current);
    seen.current = next.seen;
    showCard(next.card);
  };
  function updateProgress(update: (previous: Progress) => Progress) {
    setProgress((previous) => update(previous));
  }
  useEffect(() => {
    if (!loaded) return;
    try {
      setStorageAvailable(writeProgress(localStorage, progress));
    } catch {
      setStorageAvailable(false);
    }
  }, [progress, loaded]);
  const challengeComplete = useCallback(() => {
    setProgress((previous) => ({ ...previous, challengeCompleted: true }));
  }, []);
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (hash.has("access_token") || hash.has("error_description")) {
      window.location.replace(`/chat${window.location.hash}`);
      return;
    }
    if (initialized.current) return;
    try {
      setProgress(readProgress(localStorage));
    } catch {
      setStorageAvailable(false);
    }
    try {
      const deck = JSON.parse(sessionStorage.getItem(DECK_KEY) || "[]");
      if (Array.isArray(deck))
        seen.current = deck.filter(
          (id) => typeof id === "string" && getCard(id),
        );
    } catch {}
    initialized.current = true;
    setLoaded(true);
    const params = new URLSearchParams(window.location.search);
    const requested = getCard(params.get("card"));
    if (requested) showCard(requested);
    else if (params.get("challenge") === "1") {
      setChallenge(true);
      setView((v) => v + 1);
    }
  }, [showCard]);
  useEffect(() => {
    const dailyTimer = setInterval(() => setToday(dailyCard()), 1000);
    return () => clearInterval(dailyTimer);
  }, []);
  useEffect(() => {
    if (view > 0) {
      play.current?.focus({ preventScroll: true });
      play.current?.scrollIntoView({ behavior: "auto", block: "start" });
    }
  }, [view]);
  function startChallenge() {
    setActive(null);
    setChallenge(true);
    setNotice("");
    setView((v) => v + 1);
  }
  async function shareCard(card: CuriosityCard) {
    track("share_intent");
    setNotice(
      await shareLink(
        "AskGobi · " + card.title,
        "A little detour for your brain.",
        cardUrl(window.location.origin, card.id),
      ),
    );
  }
  return (
    <div className="playground">
      <header className="pg-header pg-container">
        <Link href="/" className="pg-logo" aria-label="AskGobi home">
          ask<span>gobi</span>
          <i />
        </Link>
        <nav aria-label="Main navigation">
          <Link href="/chat">
            Ask anything <ArrowUpRight size={15} />
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
      <main className="pg-container">
        <section className="pg-hero">
          <div className="pg-eyebrow">
            <span className="pg-dot" /> A LITTLE DETOUR FOR YOUR BRAIN
          </div>
          <h1>
            Curious?
            <br />
            <span>Apparently you are.</span>
          </h1>
          <p>
            You found AskGobi.
            <br className="pg-mobile-break" /> Stay for a little surprise.
          </p>
          <div className="pg-hero-actions">
            <button className="pg-button pg-primary" onClick={surprise}>
              <Sparkles size={18} /> Surprise me <ArrowRight size={18} />
            </button>
            <button className="pg-text-link" onClick={startChallenge}>
              Challenge my tiny AI <ArrowUpRight size={17} />
            </button>
          </div>
          <div className="pg-hero-note">
            No account. No homework. Just a curious mind.
          </div>
          <div className="pg-plate" aria-hidden="true">
            <div>TAKE THE SCENIC ROUTE</div>
            <strong>CURIOUS?</strong>
            <span>ASKGOBI.NET</span>
            <i className="pg-screw left" />
            <i className="pg-screw right" />
          </div>
        </section>
        <Link href="/chat" className="pg-chat-entry">
          <div><strong>Something on your mind?</strong><span>Your curiosity. Your question.</span></div>
          <span>Ask anything <ArrowUpRight size={18} /></span>
        </Link>
        {(active || challenge) && (
          <section
            ref={play}
            tabIndex={-1}
            className="pg-play"
            aria-label={active ? "Curiosity activity" : "Tiny AI challenge"}
          >
            {active && (
              <Activity
                key={view}
                card={active}
                onComplete={() => {
                  if (completedView.current) return;
                  completedView.current = true;
                  updateProgress((previous) =>
                    completeCard(previous, active.id),
                  );
                  track("activity_complete");
                }}
                onNext={surprise}
                onShare={() => void shareCard(active)}
                onAsk={() => {
                  window.location.href =
                    "/chat?card=" + encodeURIComponent(active.id);
                }}
              />
            )}
            {challenge && (
              <Challenge onComplete={challengeComplete} onSurprise={surprise} />
            )}
            {notice && (
              <p className="pg-status" role="status">
                {notice}
              </p>
            )}
          </section>
        )}
        <button className="pg-daily" onClick={() => showCard(today)}>
          <span className="pg-daily-icon">↗</span>
          <span>
            <small>TODAY’S DETOUR · CHANGES AT MIDNIGHT UTC</small>
            <strong>{today.title}</strong>
          </span>
          <span className="pg-daily-open">
            Take a look <ArrowRight size={17} />
          </span>
        </button>
        <section className="pg-explore" aria-labelledby="explore-heading">
          <div className="pg-section-heading">
            <h2 id="explore-heading">Follow your curiosity</h2>
            <span>GOOD QUESTIONS. UNEXPECTED ANSWERS.</span>
          </div>
          <div className="pg-grid">
            <article className="pg-card pg-surprise" id="surprise">
              <div className="pg-card-top">
                <span className="pg-icon-tile">
                  <Sparkles size={23} />
                </span>
                <span className="pg-tag">INSTANT LITTLE DISCOVERY</span>
              </div>
              <h3>A little “wait, what?”</h3>
              <p>
                A brain teaser, a curious fact, or a riddle.
                <br />
                You won’t know until you tap.
              </p>
              <button onClick={surprise} className="pg-button pg-primary">
                Surprise me <ArrowRight size={18} />
              </button>
            </article>
            <article className="pg-card" id="challenge">
              <div className="pg-card-top">
                <span className="pg-icon-tile">
                  <Zap size={23} />
                </span>
                <span className="pg-tag">HUMAN × TINY AI</span>
              </div>
              <h3>
                Small model.
                <br />
                Big questions.
              </h3>
              <p>No web. No backup brain. Can you stump a tiny local AI?</p>
              <button
                onClick={startChallenge}
                className="pg-button pg-secondary"
              >
                Challenge accepted <ArrowUpRight size={18} />
              </button>
            </article>
          </div>
        </section>
        <section className="pg-bottom">
          <div>
            <span className="pg-eyebrow">
              A SIDE PROJECT WITH A CURIOUS STREAK
            </span>
            <h2>
              One person. One tiny AI.
              <br />A few good detours.
            </h2>
            <p>Built by Gobi, for whoever happens to find it.</p>
            <details className="pg-about">
              <summary>Who’s Gobi?</summary>
              <p>
                Gobishankar Rathinam built AskGobi as a small AI Q&amp;A
                project. Now it’s a place to follow your curiosity.
              </p>
              <a
                href="https://github.com/Gobi-96"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub <ArrowUpRight size={16} />
              </a>
              <a
                href="https://www.linkedin.com/in/gobishankar-rathinam"
                target="_blank"
                rel="noopener noreferrer"
              >
                LinkedIn <ArrowUpRight size={16} />
              </a>
            </details>
          </div>
          <div className="pg-progress">
            <Sparkles size={23} />
            <h3>Your curiosity goes places.</h3>
            <p>
              {progress.completedCards.length} of {cards.length} cards explored.
              Just for you, on this device.
            </p>
            <div className="pg-badges">
              {milestones(progress).map((badge) => (
                <span
                  key={badge.name}
                  className={badge.earned ? "earned" : ""}
                  title={badge.description}
                >
                  {badge.earned ? "✓ " : ""}
                  {badge.name}
                </span>
              ))}
            </div>
            <ul className="pg-milestone-rules">
              {milestones(progress).map((badge) => (
                <li key={badge.name}>
                  {badge.name}: {badge.description}
                </li>
              ))}
            </ul>
            {!storageAvailable && (
              <p className="pg-status">
                Storage is unavailable. Your progress lasts until this page
                closes.
              </p>
            )}
            {milestones(progress).some((b) => b.earned) && (
              <button
                className="pg-small-link"
                onClick={async () => {
                  track("share_intent");
                  setNotice(
                    await shareLink(
                      "AskGobi · Stay curious",
                      "I earned " +
                        milestones(progress)
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
            )}
          </div>
        </section>
        {notice && !active && !challenge && (
          <p className="pg-status" role="status">
            {notice}
          </p>
        )}
        <p className="pg-privacy">
          Your milestones stay in this browser. We count activity events in
          aggregate, without questions or visitor IDs. Challenge answers aren’t
          saved as chats. Saved chats in Ask anything still use your existing
          account.
        </p>
      </main>
      <footer className="pg-container pg-footer">
        <span>© 2025 AskGobi · Stay curious.</span>
        <span>Found this on the road? Explore when safely parked.</span>
      </footer>
    </div>
  );
}
