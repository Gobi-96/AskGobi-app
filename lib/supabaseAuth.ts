const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "";
const TOKEN_KEY = "askgobi_supabase_access_token";
export const AUTH_CHANGED_EVENT = "askgobi-auth-changed";
export const AUTH_OPEN_EVENT = "askgobi-auth-open";
export const AUTH_SIGNOUT_EVENT = "askgobi-auth-signout";

export interface SupabaseUser {
  id: string;
  email?: string;
}

export function hasSupabaseConfig(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

function normalizeRedirectUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const withProtocol =
    trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;
  return withProtocol.replace(/\/+$/, "");
}

function isLocalOrigin(value: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(value);
}

export function getAuthRedirectUrl(redirectTo?: string): string {
  if (redirectTo) return normalizeRedirectUrl(redirectTo);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  if (origin && !isLocalOrigin(origin)) {
    return normalizeRedirectUrl(origin);
  }

  if (PUBLIC_SITE_URL) {
    return normalizeRedirectUrl(PUBLIC_SITE_URL);
  }

  return normalizeRedirectUrl(origin || "http://localhost:3000");
}

export function startGoogleSignIn(redirectTo?: string) {
  if (!hasSupabaseConfig()) {
    throw new Error("Missing Supabase env config");
  }
  const redirect = getAuthRedirectUrl(redirectTo);
  const params = new URLSearchParams({
    provider: "google",
    redirect_to: redirect,
    prompt: "select_account",
  });
  const url = `${SUPABASE_URL}/auth/v1/authorize?${params.toString()}`;
  window.location.href = url;
}

export async function sendMagicLink(email: string, redirectTo?: string): Promise<void> {
  if (!hasSupabaseConfig()) {
    throw new Error("Missing Supabase env config");
  }
  const redirect = getAuthRedirectUrl(redirectTo);
  const res = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      email,
      create_user: true,
      email_redirect_to: redirect,
    }),
  });
  if (!res.ok) {
    let msg = "Failed to send login email.";
    try {
      const data = await res.json();
      if (data?.msg) msg = String(data.msg);
      if (data?.error_description) msg = String(data.error_description);
    } catch {}
    throw new Error(msg);
  }
}

export function consumeTokenFromUrlHash(): string | null {
  const hash = window.location.hash?.replace(/^#/, "");
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const token = params.get("access_token");
  if (!token) return null;

  localStorage.setItem(TOKEN_KEY, token);
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
  return token;
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export async function fetchSupabaseUser(token: string): Promise<SupabaseUser | null> {
  if (!hasSupabaseConfig()) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) return null;
  const user = await res.json();
  return user?.id ? { id: user.id, email: user.email } : null;
}

export async function signOutSupabase(token: string) {
  if (!hasSupabaseConfig()) return;
  await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function getSupabaseRestConfig() {
  return {
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
  };
}

export function requestAuthModal(mode: "login" | "signup" = "login") {
  window.dispatchEvent(new CustomEvent(AUTH_OPEN_EVENT, { detail: { mode } }));
}

export function requestAuthSignOut() {
  window.dispatchEvent(new Event(AUTH_SIGNOUT_EVENT));
}
