"use client";
import { useEffect, useState } from "react";
export type LeaderboardEntry = {
  alias: string;
  rank: number;
  moves: number | null;
  points: number;
};
export default function SignalLeaderboard({
  enabled,
  revision,
  busy,
  onRemoving,
  onRemoved,
}: {
  enabled: boolean;
  revision: number;
  busy: boolean;
  onRemoving: (value: boolean) => void;
  onRemoved: () => void;
}) {
  const [open, setOpen] = useState(false),
    [period, setPeriod] = useState("day"),
    [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [status, setStatus] = useState(""),
    [identity, setIdentity] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false),
    [deleting, setDeleting] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let alive = true;
    void fetch("/api/puzzle/player")
      .then((r) => r.json())
      .then((d) => {
        if (alive) setIdentity(d.hasIdentity === true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [revision, refresh]);
  useEffect(() => {
    if (!open || !enabled) return;
    const abort = new AbortController();
    setStatus("Loading real results…");
    setEntries([]);
    void fetch("/api/puzzle/leaderboard?period=" + period, {
      signal: abort.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((d) => {
        if (!abort.signal.aborted) {
          setEntries(d.entries);
          setStatus(
            d.entries.length
              ? ""
              : "No entries yet. Today’s challenge is ready for you.",
          );
        }
      })
      .catch(() => {
        if (!abort.signal.aborted)
          setStatus("Leaderboard unavailable. Practice still works.");
      });
    return () => abort.abort();
  }, [open, enabled, period, revision, refresh]);
  return (
    <details
      className="pg-disclosure sg-leaderboard"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>Community leaderboard</summary>
      <div className="pg-disclosure-content">
        <p>
          Friendly competition. Solves are checked—not verified human-only play.
        </p>
        {enabled ? (
          <>
            <div
              className="sg-periods"
              role="group"
              aria-label="Leaderboard period"
            >
              {[
                ["day", "Today"],
                ["week", "This week"],
                ["all", "All time"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className="pg-small-link"
                  aria-pressed={period === value}
                  onClick={() => setPeriod(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <p>
              {period === "day"
                ? "Fewest moves on the same UTC-day puzzle. Equal results share a rank."
                : period === "week"
                  ? "Daily best points, Monday–Sunday UTC. Up to 700 per week."
                  : "Daily best points since launch. Rewards participation as well as efficiency."}
            </p>
            <p>
              Daily points = 100 × shortest route ÷ your moves, rounded down.
              Optimal solves earn 100.
            </p>
            {status && <p role="status">{status}</p>}
            {!!entries.length && (
              <table className="sg-rankings">
                <caption className="sr-only">{period} leaderboard</caption>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Initials</th>
                    <th>{period === "day" ? "Moves" : "Points"}</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.alias}>
                      <td>{entry.rank}</td>
                      <td>{entry.alias}</td>
                      <td>{period === "day" ? entry.moves : entry.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        ) : (
          <p>
            Public scores are not available yet. You can still play today’s
            board as practice.
          </p>
        )}
        {identity && (
          <div className="sg-delete">
            <button
              className="pg-small-link"
              disabled={busy || deleting}
              onClick={() => setConfirmDelete(true)}
            >
              Remove my leaderboard data
            </button>
            {confirmDelete && (
              <>
                <p>
                  This removes your public initials and all saved leaderboard
                  scores. Your local practice progress stays.
                </p>
                <button
                  className="pg-button pg-secondary"
                  disabled={deleting || busy}
                  onClick={async () => {
                    setDeleting(true);
                    onRemoving(true);
                    try {
                      const r = await fetch("/api/puzzle/player", {
                        method: "DELETE",
                      });
                      if (!r.ok) throw Error();
                      setIdentity(false);
                      setConfirmDelete(false);
                      setRefresh((v) => v + 1);
                      setStatus("Your leaderboard data was removed.");
                      onRemoved();
                    } catch {
                      setStatus(
                        "Could not remove your data. Please retry; it has not been confirmed deleted.",
                      );
                    } finally {
                      setDeleting(false);
                      onRemoving(false);
                    }
                  }}
                >
                  Confirm removal
                </button>
                <button
                  className="pg-small-link"
                  disabled={deleting}
                  onClick={() => setConfirmDelete(false)}
                >
                  Keep my scores
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </details>
  );
}
