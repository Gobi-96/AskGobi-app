const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const TOKEN_KEY = "askgobi_supabase_access_token";

export interface SupabaseUser {
  id: string;
  email?: string;
}

export function hasSupabaseConfig(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function startGoogleSignIn(redirectTo?: string) {
  if (!hasSupabaseConfig()) {
    throw new Error("Missing Supabase env config");
  }
  const redirect = redirectTo || window.location.origin;
  const url = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(
    redirect
  )}`;
  window.location.href = url;
}

export async function sendMagicLink(email: string, redirectTo?: string): Promise<void> {
  if (!hasSupabaseConfig()) {
    throw new Error("Missing Supabase env config");
  }
  const redirect = redirectTo || window.location.origin;
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
}
