export const sanitize = (text: string) => {
    const banned =
      /(sex|sexual|kill|murder|rape|porn|nsfw|explicit|abuse|nude|fuck|bitch|cock|pussy|hentai)/gi;
    return text
      .replace(banned, "⚠️ [content removed]")
      .replace(/\b(openai|chatgpt|anthropic|google|microsoft)\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  };
  
  export const truncateWords = (text: string, max = 180) => {
    const words = text.split(/\s+/);
    if (words.length <= max) return text;
    const truncated = words.slice(0, max).join(" ");
    const lastPeriod = truncated.lastIndexOf(".");
    if (lastPeriod > 0) return truncated.slice(0, lastPeriod + 1).trim() + " …";
    return truncated.trim() + " …";
  };
  
  export const formatToBullets = (text: string) => {
    if (/^[\s\n]*([✅📜🌿🧠💡⚙️🌍\-•])/m.test(text)) return text;
    const sentences = text.split(/(?<=[.!?])\s+/).slice(0, 5);
    return sentences
      .filter((s) => s.trim().length > 3)
      .map((s) => `✅ ${s.trim()}`)
      .join("\n\n");
  };
  