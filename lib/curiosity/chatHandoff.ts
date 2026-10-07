// A short-lived, tab-local bridge. Questions and answers never enter a URL.
export const CHAT_HANDOFF_KEY = "askgobi_chat_handoff_v1";
export type ChatHandoff = {
  version: 1;
  createdAt: number;
  ownerId: string | null;
  cardId?: string;
  exchanges: { question: string; answer: string }[];
};
export function readChatHandoff(
  raw: string | null,
  ownerId: string | null,
  now = Date.now(),
): ChatHandoff | null {
  if (!raw || raw.length > 16000) return null;
  try {
    const value = JSON.parse(raw) as ChatHandoff;
    if (
      value.version !== 1 ||
      value.ownerId !== ownerId ||
      !Number.isFinite(value.createdAt) ||
      value.createdAt > now ||
      now - value.createdAt > 15 * 60_000
    )
      return null;
    if (
      value.cardId !== undefined &&
      (typeof value.cardId !== "string" || value.cardId.length > 80)
    )
      return null;
    if (
      !Array.isArray(value.exchanges) ||
      value.exchanges.length < 1 ||
      value.exchanges.length > 3 ||
      value.exchanges.some(
        (e) =>
          !e ||
          typeof e.question !== "string" ||
          !e.question.trim() ||
          e.question.length > 500 ||
          typeof e.answer !== "string" ||
          !e.answer.trim() ||
          e.answer.length > 4000,
      )
    )
      return null;
    return value;
  } catch {
    return null;
  }
}
