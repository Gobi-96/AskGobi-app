"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  Check,
  Compass,
  MessageCircle,
  Radio,
  RefreshCw,
  Cloud,
  ArrowRight,
} from "lucide-react";
import ChatHeader from "@/components/ChatHeader";
import {
  AUTH_CHANGED_EVENT,
  isAuthStorageEvent,
  fetchSupabaseUser,
  getSessionToken,
  getStoredToken,
  requestAuthModal,
} from "@/lib/supabaseAuth";
import { syncRequest } from "@/lib/accountClient";
import { getCard } from "@/lib/curiosity/cards";
import { listConversations, type ConversationRow } from "@/lib/supabaseHistory";
import { readProgress } from "@/lib/curiosity/progress";
import { track } from "@/lib/curiosity/telemetry";
import "@/components/playground/playground.css";
import "@/app/chat/chat.css";
type Saved = { card_id: string; saved_at: string };
type Result = {
  puzzle_id: string;
  day: string | null;
  moves: number;
  points: number;
};
export default function CuriosityPage() {
  const [discoveries, setDiscoveries] = useState<Saved[]>([]),
    [results, setResults] = useState<Result[]>([]),
    [chats, setChats] = useState<ConversationRow[]>([]);
  const [signedIn, setSignedIn] = useState(false),
    [status, setStatus] = useState("Checking your session…"),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [syncOk, setSyncOk] = useState(false);
  const generation = useRef(0);
  async function load() {
    const id = ++generation.current;
    setLoading(true);
    setSyncOk(false);
    setStatus("Checking your collection…");
    setDiscoveries([]);
    setResults([]);
    setChats([]);
    setSignedIn(false);
    try {
      const token = await getSessionToken();
      if (!token) {
        if (id === generation.current)
          setStatus(
            "Your practice stays on this device. Sign in to save across devices.",
          );
        return;
      }
      const user = await fetchSupabaseUser(token);
      if (id !== generation.current) return;
      if (!user) {
        setStatus("Your session expired. Sign in again to see saved progress.");
        return;
      }
      setSignedIn(true);
      const history = await listConversations(token, 5);
      if (id !== generation.current || token !== getStoredToken()) return;
      setChats(history);
      const progress = await syncRequest("/api/me/progress");
      if (id !== generation.current || token !== getStoredToken()) return;
      setDiscoveries(progress.discoveries);
      setResults(progress.results);
      setSyncOk(true);
      setStatus("Up to date across your devices");
    } catch (e) {
      if (id === generation.current)
        setStatus(
          e instanceof Error
            ? e.message
            : "Sync unavailable. Local practice is safe.",
        );
    } finally {
      if (id === generation.current) setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    const update = () => void load();
    window.addEventListener(AUTH_CHANGED_EVENT, update);
    const onStorage = (event: StorageEvent) => {
      if (isAuthStorageEvent(event)) update();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      generation.current++;
      window.removeEventListener(AUTH_CHANGED_EVENT, update);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  async function importLocal() {
    setBusy(true);
    const token = getStoredToken();
    try {
      for (const cardId of readProgress(localStorage).completedCards) {
        if (token !== getStoredToken())
          throw new Error("Account changed. Please retry.");
        await syncRequest("/api/me/progress", { cardId });
      }
      if (token !== getStoredToken())
        throw new Error("Account changed. Please retry.");
      await syncRequest("/api/me/claim", {});
      track("progress_saved");
      await load();
    } catch (e) {
      setSyncOk(false);
      setStatus(
        e instanceof Error ? e.message : "Could not sync. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="playground">
      <ChatHeader playground />
      <main className="pg-container curiosity-page curiosity-collection">
        <Link href="/" className="collection-back">
          <ArrowLeft size={16} aria-hidden="true" /> Back to exploring
        </Link>
        <div className="collection-heading">
          <div>
            <span className="pg-eyebrow">YOUR LITTLE CORNER</span>
            <h1>
              My curiosity<span>.</span>
            </h1>
            <p>Good questions. Little discoveries. Yours to keep.</p>
          </div>
          {signedIn && !loading && (
            <div className="collection-sync-status">
              <span className={syncOk ? "is-synced" : ""} role="status">
                {syncOk ? (
                  <Check size={14} aria-hidden="true" />
                ) : (
                  <Cloud size={14} aria-hidden="true" />
                )}
                {syncOk ? "Up to date" : "Sync needs attention"}
              </span>
              <button
                type="button"
                disabled={busy || loading}
                onClick={() => void load()}
                aria-label="Refresh saved progress"
              >
                <RefreshCw size={16} />
              </button>
            </div>
          )}
        </div>
        {loading ? (
          <div className="collection-loading" role="status">
            <span className="collection-icon">
              <Compass size={24} aria-hidden="true" />
            </span>
            <p>Finding your saved curiosities…</p>
          </div>
        ) : !signedIn ? (
          <section
            className="collection-welcome"
            aria-labelledby="collection-welcome-title"
          >
            <div className="collection-welcome-intro">
              <span className="collection-icon">
                <Bookmark size={25} aria-hidden="true" />
              </span>
              <h2 id="collection-welcome-title">
                Keep what catches your curiosity.
              </h2>
              <p>
                A little collection of discoveries, puzzle results, and
                conversations—ready whenever you come back.
              </p>
            </div>
            <div className="collection-benefits">
              <div>
                <Bookmark size={19} aria-hidden="true" />
                <div>
                  <h3>Discoveries worth keeping</h3>
                  <p>Revisit that fact or brain teaser you liked.</p>
                </div>
              </div>
              <div>
                <Radio size={19} aria-hidden="true" />
                <div>
                  <h3>Your signal results</h3>
                  <p>Keep your completed boards and personal bests.</p>
                </div>
              </div>
              <div>
                <MessageCircle size={19} aria-hidden="true" />
                <div>
                  <h3>Questions to come back to</h3>
                  <p>Pick up a saved chat where you left off.</p>
                </div>
              </div>
            </div>
            <div className="collection-welcome-actions">
              <button
                type="button"
                className="pg-button pg-primary"
                onClick={() => requestAuthModal("signup")}
              >
                Sign in to save <ArrowRight size={16} aria-hidden="true" />
              </button>
              <Link href="/" className="pg-small-link">
                Keep exploring <ArrowUpRight size={14} aria-hidden="true" />
              </Link>
            </div>
            <p className="collection-private-note">
              Your collection is private. Signing in never publishes a score.
            </p>
            <p className="collection-session-note" role="status">
              {status}
            </p>
          </section>
        ) : (
          <>
            {!syncOk && (
              <p className="collection-alert" role="status">
                {status}
              </p>
            )}
            <div className="collection-grid">
              <section
                className="collection-card"
                aria-labelledby="saved-discoveries-title"
              >
                <div className="collection-card-heading">
                  <span className="collection-icon">
                    <Bookmark size={20} aria-hidden="true" />
                  </span>
                  <h2 id="saved-discoveries-title">Discoveries</h2>
                  <span
                    className="collection-count"
                    aria-label={`${discoveries.length} saved discoveries`}
                  >
                    {discoveries.length}
                  </span>
                </div>
                {discoveries.length ? (
                  <ul className="collection-list">
                    {discoveries.map((d) => {
                      const card = getCard(d.card_id);
                      return card ? (
                        <li key={d.card_id}>
                          <Link href={"/?card=" + encodeURIComponent(card.id)}>
                            <div>
                              <strong>{card.title}</strong>
                              <span>
                                {card.kind === "quiz"
                                  ? "Brain teaser"
                                  : card.kind === "fact"
                                    ? "Curious fact"
                                    : "Riddle"}
                              </span>
                            </div>
                            <ArrowUpRight size={16} aria-hidden="true" />
                          </Link>
                        </li>
                      ) : null;
                    })}
                  </ul>
                ) : (
                  <div className="collection-empty">
                    <p>A good discovery deserves a second look.</p>
                    <span>
                      Choose Save after a curiosity card to keep it here.
                    </span>
                    <Link href="/">
                      Find a little surprise{" "}
                      <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                  </div>
                )}
              </section>
              <section
                className="collection-card"
                aria-labelledby="saved-results-title"
              >
                <div className="collection-card-heading">
                  <span className="collection-icon">
                    <Radio size={20} aria-hidden="true" />
                  </span>
                  <h2 id="saved-results-title">Signal results</h2>
                  <span
                    className="collection-count"
                    aria-label={`${results.length} saved results`}
                  >
                    {results.length}
                  </span>
                </div>
                {results.length ? (
                  <>
                    <p className="collection-card-note">
                      Your best saved result for each board.
                    </p>
                    <ul className="collection-list">
                      {results.map((result) => (
                        <li key={result.puzzle_id}>
                          <Link
                            href={
                              result.day
                                ? "/?daily=" + result.day
                                : "/?puzzle=" +
                                  encodeURIComponent(result.puzzle_id)
                            }
                          >
                            <div>
                              <strong>
                                {result.day
                                  ? new Intl.DateTimeFormat("en", {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                      timeZone: "UTC",
                                    }).format(
                                      new Date(result.day + "T00:00:00Z"),
                                    )
                                  : "Practice puzzle"}
                              </strong>
                              <span>
                                {result.moves} moves · verified result
                              </span>
                            </div>
                            <span className="collection-points">
                              <b>{result.points}</b> points
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <div className="collection-empty">
                    <p>Your next connection starts here.</p>
                    <span>Finish a signal puzzle and save your result.</span>
                    <Link
                      href={"/?daily=" + new Date().toISOString().slice(0, 10)}
                    >
                      Try today’s signal{" "}
                      <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                  </div>
                )}
              </section>
              <section
                className="collection-card"
                aria-labelledby="saved-chats-title"
              >
                <div className="collection-card-heading">
                  <span className="collection-icon">
                    <MessageCircle size={20} aria-hidden="true" />
                  </span>
                  <h2 id="saved-chats-title">Recent chats</h2>
                  <span
                    className="collection-count"
                    aria-label={`${chats.length} recent chats`}
                  >
                    {chats.length}
                  </span>
                </div>
                {chats.length ? (
                  <ul className="collection-list">
                    {chats.map((chat) => (
                      <li key={chat.id}>
                        <Link
                          href={
                            "/chat?conversation=" + encodeURIComponent(chat.id)
                          }
                        >
                          <div>
                            <strong>{chat.title}</strong>
                            <span>Continue the conversation</span>
                          </div>
                          <ArrowUpRight size={16} aria-hidden="true" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="collection-empty">
                    <p>There’s always another good question.</p>
                    <span>Your signed-in conversations will appear here.</span>
                    <Link href="/chat">
                      Ask Gobi something{" "}
                      <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                  </div>
                )}
                {chats.length > 0 && (
                  <Link className="collection-card-footer" href="/chat">
                    All chats &amp; projects{" "}
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                )}
              </section>
            </div>
            <details className="collection-device">
              <summary>
                <Cloud size={17} aria-hidden="true" /> Progress &amp; this
                device
              </summary>
              <div>
                <p>
                  Saved discoveries and completed results sync across devices.
                  Unfinished puzzles and local practice stay on this device.
                  Verified results check the moves; they don’t prove unaided
                  play. Public scores are always optional.
                </p>
                <button
                  type="button"
                  className="pg-small-link"
                  disabled={busy || loading}
                  onClick={() => void importLocal()}
                >
                  {busy
                    ? "Bringing your progress over…"
                    : "Bring this device’s saved discoveries and published scores"}
                  <ArrowRight size={15} aria-hidden="true" />
                </button>
              </div>
            </details>
            <p className="collection-private-note">
              Private by default. Public leaderboard scores are your choice.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
