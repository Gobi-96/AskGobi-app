const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "";
const REFRESH_KEY = "askgobi_supabase_refresh_token";
const EXPIRY_KEY = "askgobi_supabase_expires_at";
const RETURN_KEY = "askgobi_auth_return";
let returnOverride: string | null = null;
let renewal: Promise<string | null> | null = null;
const TOKEN_KEY = "askgobi_supabase_access_token";
export function isAuthStorageEvent(event: StorageEvent): boolean {
  return event.key === null || event.key === TOKEN_KEY;
}
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
  const redirect = loginRedirect(redirectTo);
  const params = new URLSearchParams({
    provider: "google",
    redirect_to: redirect,
    prompt: "select_account",
  });
  const url = `${SUPABASE_URL}/auth/v1/authorize?${params.toString()}`;
  window.location.href = url;
}

export async function sendMagicLink(
  email: string,
  redirectTo?: string,
): Promise<void> {
  if (!hasSupabaseConfig()) {
    throw new Error("Missing Supabase env config");
  }
  const redirect = loginRedirect(redirectTo);
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
  if (params.get("refresh_token"))
    localStorage.setItem(REFRESH_KEY, params.get("refresh_token")!);
  const expiry =
    Number(params.get("expires_at")) ||
    Math.floor(Date.now() / 1000) + Number(params.get("expires_in") || 3600);
  localStorage.setItem(EXPIRY_KEY, String(expiry));
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  window.history.replaceState(
    {},
    document.title,
    window.location.pathname + window.location.search,
  );
  return token;
}

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function fetchSupabaseUser(
  token: string,
): Promise<SupabaseUser | null> {
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
  try {
    if (hasSupabaseConfig())
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(5000),
      });
  } finally {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(EXPIRY_KEY);
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  }
}

export function getSupabaseRestConfig() {
  return {
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
  };
}

export function requestAuthModal(
  mode: "login" | "signup" = "login",
  returnTo?: string,
) {
  returnOverride = returnTo || null;
  window.dispatchEvent(new CustomEvent(AUTH_OPEN_EVENT, { detail: { mode } }));
}

export function requestAuthSignOut() {
  window.dispatchEvent(new Event(AUTH_SIGNOUT_EVENT));
}

function loginRedirect(explicit?: string) {
  const path =
    returnOverride || window.location.pathname + window.location.search;
  try {
    sessionStorage.setItem(RETURN_KEY, path);
  } catch {}
  // Keep the already-allowlisted root OAuth callback. Returning in this browser
  // restores its original activity; a magic link in another browser lands home.
  return getAuthRedirectUrl(explicit);
}
export function authReturnPath() {
  try {
    const path = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    return path &&
      path.startsWith("/") &&
      !path.startsWith("//") &&
      !path.includes("\\")
      ? path
      : "/";
  } catch {
    return "/";
  }
}
export async function getSessionToken(): Promise<string | null> {
  const token = getStoredToken();
  if (!token) return null;
  let refresh: string | null, expiry: number;
  try {
    refresh = localStorage.getItem(REFRESH_KEY);
    expiry = Number(localStorage.getItem(EXPIRY_KEY));
  } catch {
    return token;
  }
  if (!refresh || (expiry && expiry > Date.now() / 1000 + 60)) return token;
  if (renewal) return renewal;
  renewal = (async () => {
    try {
      const r = await fetch(
        SUPABASE_URL + "/auth/v1/token?grant_type=refresh_token",
        {
          method: "POST",
          headers: {
            apikey: SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refresh_token: refresh }),
          signal: AbortSignal.timeout(8000),
        },
      );
      if (!r.ok) {
        if (r.status === 400 || r.status === 401) {
          if (getStoredToken() === token) {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(REFRESH_KEY);
            localStorage.removeItem(EXPIRY_KEY);
            window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
          }
          return null;
        }
        return token;
      }
      const value = await r.json();
      if (getStoredToken() !== token) return null;
      if (
        typeof value.access_token !== "string" ||
        typeof value.refresh_token !== "string"
      )
        return token;
      localStorage.setItem(TOKEN_KEY, value.access_token);
      localStorage.setItem(REFRESH_KEY, value.refresh_token);
      localStorage.setItem(
        EXPIRY_KEY,
        String(value.expires_at || Date.now() / 1000 + value.expires_in),
      );
      return value.access_token as string;
    } catch {
      return token;
    }
  })();
  try {
    return await renewal;
  } finally {
    renewal = null;
  }
}
