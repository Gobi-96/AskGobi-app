"use client";
import { useState } from "react";
import Link from "next/link";
import { getStoredToken, requestAuthModal } from "@/lib/supabaseAuth";
import { syncRequest } from "@/lib/accountClient";
import { track } from "@/lib/curiosity/telemetry";
export default function SaveDiscovery({
  cardId,
  puzzleId,
  moves,
}: {
  cardId?: string;
  puzzleId?: string;
  moves?: number[];
}) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!getStoredToken()) {
      requestAuthModal(
        "signup",
        cardId
          ? "/?card=" + encodeURIComponent(cardId)
          : puzzleId
            ? "/?puzzle=" + encodeURIComponent(puzzleId)
            : "/curiosity",
      );
      return;
    }
    setBusy(true);
    try {
      await syncRequest(
        "/api/me/progress",
        cardId ? { cardId } : { puzzleId, moves },
      );
      setStatus("Saved to My curiosity.");
      track("progress_saved");
    } catch (e) {
      setStatus(
        e instanceof Error
          ? e.message
          : "Could not sync. Your local progress is safe.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="pg-save">
      <button
        className="pg-small-link"
        disabled={busy}
        onClick={() => void save()}
      >
        {busy ? "Saving…" : "Save your discoveries and scores"}
      </button>
      <p>Keep this across devices. Public scores are always your choice.</p>
      {status && <p role="status">{status}</p>}
      <Link className="pg-small-link" href="/curiosity">
        Open My curiosity
      </Link>
    </div>
  );
}
