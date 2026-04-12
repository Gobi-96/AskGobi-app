// 🚫 Only remove unsafe words — do NOT touch URLs
export const sanitize = (text: string) => {
  const bannedWholeWords = [
    "sex",
    "sexual",
    "murder",
    "rape",
    "porn",
    "nsfw",
    "explicit",
    "abuse",
    "nude",
    "fuck",
    "bitch",
    "cock",
    "pussy",
    "hentai"
  ];

  // ❗ DO NOT include "kill" here — it appears inside legit words (skill, skillet)
  
  const pattern = new RegExp(`\\b(${bannedWholeWords.join("|")})\\b`, "gi");

  return text.replace(pattern, "⚠️ [content removed]");
};

// ✂️ Safe truncate (never breaks links)
export const truncateWords = (text: string, max = 180) => {
  const words = text.split(/\s+/);
  if (words.length <= max) return text;

  const truncated = words.slice(0, max).join(" ");
  const lastPeriod = truncated.lastIndexOf(".");
  return lastPeriod > 0
    ? truncated.slice(0, lastPeriod + 1) + " …"
    : truncated + " …";
};

// ⚠️ DO NOT auto-bullet the answer — the model already formats correctly
export const formatToBullets = (text: string) => text;

// ✔ Fix ONLY weird “(www02:)” labels inside markdown
export function cleanMarkdownLinks(text: string) {
  return text.replace(/\(www[^)]*\)/gi, "");
}

// ⚠️ DO NOT remove or alter real URLs — you break markdown if you do
export function linkify(text: string) {
  return text; // handled in ChatMessages with custom <a> renderer
}
