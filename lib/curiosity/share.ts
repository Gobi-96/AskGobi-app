export async function shareLink(
  title: string,
  text: string,
  url: string,
): Promise<string> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text, url });
      return "Share sheet closed.";
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError")
        return "Sharing cancelled.";
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "Link copied.";
  } catch {
    return "Copy this link manually: " + url;
  }
}
