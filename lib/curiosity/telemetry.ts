export const eventNames = [
  "activity_start",
  "activity_complete",
  "challenge_start",
  "challenge_complete",
  "verdict_held_up",
  "verdict_stumped",
  "verdict_unsure",
  "share_intent",
] as const;
export type EventName = (typeof eventNames)[number];
export function track(event: EventName) {
  // Only an allowlisted event name crosses the network. No content or visitor ID.
  try {
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* Telemetry must never interrupt play. */
  }
}
