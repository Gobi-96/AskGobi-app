import { getSessionToken } from "./supabaseAuth";
export async function accountHeaders(): Promise<Record<string, string>> {
  const token = await getSessionToken();
  return token ? { Authorization: "Bearer " + token } : {};
}
export async function syncRequest(path: string, body?: unknown) {
  const headers = await accountHeaders();
  if (!headers.Authorization)
    throw new Error("Sign in to save across devices.");
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      data.error || "Sync is unavailable. Your local progress is safe.",
    );
  return data;
}
