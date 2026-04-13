"use client";
import { useEffect, useState } from "react";
import { Moon, Sun, X } from "lucide-react";
import { useTheme } from "next-themes";
import {
  AUTH_OPEN_EVENT,
  AUTH_SIGNOUT_EVENT,
  consumeTokenFromUrlHash,
  fetchSupabaseUser,
  getStoredToken,
  hasSupabaseConfig,
  sendMagicLink,
  signOutSupabase,
  startGoogleSignIn,
  type SupabaseUser,
} from "@/lib/supabaseAuth";

export default function ChatHeader({
  onMenuClick,
  sidebarExpanded = true,
}: {
  onMenuClick?: () => void;
  sidebarExpanded?: boolean;
}) {
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authError, setAuthError] = useState("");
  const [showMobileAccountMenu, setShowMobileAccountMenu] = useState(false);

  useEffect(() => {
    let ignore = false;
    async function load() {
      const fromHash = consumeTokenFromUrlHash();
      const token = fromHash || getStoredToken();
      if (!token) return;
      const current = await fetchSupabaseUser(token);
      if (!ignore) setUser(current);
    }
    void load();
    const onOpenAuth = (event: Event) => {
      const custom = event as CustomEvent<{ mode?: "login" | "signup" }>;
      openAuth(custom.detail?.mode || "login");
    };
    const onSignoutRequest = () => {
      void onSignOut();
    };
    window.addEventListener(AUTH_OPEN_EVENT, onOpenAuth as EventListener);
    window.addEventListener(AUTH_SIGNOUT_EVENT, onSignoutRequest as EventListener);
    return () => {
      ignore = true;
      window.removeEventListener(AUTH_OPEN_EVENT, onOpenAuth as EventListener);
      window.removeEventListener(AUTH_SIGNOUT_EVENT, onSignoutRequest as EventListener);
    };
  }, []);

  async function onSignIn() {
    setLoadingAuth(true);
    try {
      startGoogleSignIn(window.location.origin);
    } finally {
      setLoadingAuth(false);
    }
  }

  async function onSignOut() {
    setLoadingAuth(true);
    try {
      const token = getStoredToken();
      if (token) await signOutSupabase(token);
      setUser(null);
    } finally {
      setLoadingAuth(false);
    }
  }

  async function onContinueEmail() {
    if (!email.trim()) {
      setAuthError("Enter your email address.");
      return;
    }
    setLoadingAuth(true);
    setAuthError("");
    setAuthMessage("");
    try {
      await sendMagicLink(email.trim(), window.location.origin);
      setAuthMessage("Magic link sent. Check your email to continue.");
    } catch (err: any) {
      setAuthError(err?.message || "Could not send magic link.");
    } finally {
      setLoadingAuth(false);
    }
  }

  function openAuth(mode: "login" | "signup") {
    setAuthMode(mode);
    setShowAuthModal(true);
    setAuthError("");
    setAuthMessage("");
    setEmail("");
  }

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-3 md:px-6 py-3 md:py-4 backdrop-blur-md
          ${sidebarExpanded ? "md:left-[300px]" : "md:left-[64px]"}
          ${theme === "light"
            ? "bg-white/80 border-b border-gray-200"
            : "bg-[#0d0d0d]/80 border-b border-gray-800 text-white"}`}
      >
        <div className="flex items-center gap-3">
          {onMenuClick && (
            <button
              type="button"
              onClick={onMenuClick}
              className={`md:hidden inline-flex items-center justify-center text-xl leading-none ${
                theme === "light" ? "text-gray-800" : "text-gray-200"
              }`}
              aria-label="Open chats menu"
            >
              ≡
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (user?.email) setShowMobileAccountMenu((v) => !v);
            }}
            className="text-2xl md:text-3xl font-bold"
          >
            <span className={theme === "light" ? "text-gray-900" : "text-white"}>Ask</span>
            <span className="text-blue-500">Gobi</span>
          </button>
          {showMobileAccountMenu && user?.email && (
            <div
              className={`md:hidden absolute left-3 top-14 z-[75] min-w-[170px] rounded-lg border shadow-lg ${
                theme === "light"
                  ? "bg-white border-gray-200 text-gray-900"
                  : "bg-[#17181d] border-gray-700 text-gray-100"
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setShowMobileAccountMenu(false);
                  openAuth("login");
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
              >
                Switch account
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMobileAccountMenu(false);
                  void onSignOut();
                }}
                className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-black/5 dark:hover:bg-white/5"
              >
                Sign out
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {hasSupabaseConfig() && (
            <>
              {user?.email ? (
                <>
                  <span className={`hidden md:inline text-sm ${theme === "light" ? "text-gray-700" : "text-gray-300"}`}>
                    {user.email}
                  </span>
                  <div
                    className={`md:hidden h-8 w-8 rounded-full inline-flex items-center justify-center text-sm font-semibold border ${
                      theme === "light"
                        ? "bg-white border-gray-300 text-gray-700"
                        : "bg-[#161616] border-gray-700 text-gray-200"
                    }`}
                    title={user.email}
                  >
                    {(user.email?.[0] || "U").toUpperCase()}
                  </div>
                  <button
                    onClick={() => void onSignOut()}
                    disabled={loadingAuth}
                    className={`hidden md:inline-flex px-3 py-1.5 text-sm rounded-full border transition ${
                      theme === "light"
                        ? "bg-white border-gray-300 text-gray-800"
                        : "bg-[#161616] border-gray-700 text-gray-200"
                    } disabled:opacity-50`}
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <div className="hidden md:flex items-center gap-2">
                  <button
                    onClick={() => openAuth("login")}
                    className={`px-4 py-1.5 text-sm rounded-full border transition ${
                      theme === "light"
                        ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                        : "bg-blue-600 text-white border-blue-600 hover:bg-blue-500"
                    }`}
                  >
                    Log in
                  </button>
                  <button
                    onClick={() => openAuth("signup")}
                    className={`px-4 py-1.5 text-sm rounded-full border transition ${
                      theme === "light"
                        ? "bg-white text-gray-900 border-gray-300"
                        : "bg-transparent text-white border-gray-500"
                    }`}
                  >
                    Sign up for free
                  </button>
                </div>
              )}
            </>
          )}

          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className={`p-2 rounded-full border transition
              ${theme === "light"
                ? "bg-gray-200 hover:bg-gray-300 border-gray-300 text-gray-800"
                : "bg-gray-700 hover:bg-gray-600 border-gray-600 text-yellow-300"}`}
          >
            {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      {showAuthModal && (
        <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md rounded-2xl border p-6 ${
              theme === "light"
                ? "bg-white border-gray-200 text-gray-900"
                : "bg-[#131417] border-gray-700 text-gray-100"
            }`}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-3xl font-semibold text-center">
                  {authMode === "login" ? "Log in or sign up for free" : "Sign up for free"}
                </h2>
                <p
                  className={`mt-2 text-sm text-center ${
                    theme === "light" ? "text-gray-600" : "text-gray-300"
                  }`}
                >
                  Save your history, get better responses, and continue from any device.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                className={`rounded-full p-1 border ${
                  theme === "light" ? "border-gray-300" : "border-gray-600"
                }`}
              >
                <X size={16} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => void onSignIn()}
              disabled={loadingAuth}
              className={`w-full rounded-full py-3 text-sm font-medium border transition inline-flex items-center justify-center gap-2 ${
                theme === "light"
                  ? "bg-gray-50 border-gray-300 hover:bg-gray-100"
                  : "bg-[#1c1d22] border-gray-600 hover:bg-[#25262b]"
              } disabled:opacity-50`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#EA4335"
                  d="M12 10.2v3.9h5.4c-.2 1.2-.9 2.2-1.9 2.9l3 2.3c1.8-1.6 2.8-4 2.8-6.8 0-.7-.1-1.3-.2-1.9H12z"
                />
                <path
                  fill="#34A853"
                  d="M12 22c2.6 0 4.8-.9 6.4-2.4l-3-2.3c-.8.6-2 .9-3.4.9-2.6 0-4.8-1.8-5.6-4.2H3.3v2.6A10 10 0 0012 22z"
                />
                <path
                  fill="#FBBC05"
                  d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.3A10 10 0 002 12c0 1.6.4 3 1.3 4.6L6.4 14z"
                />
                <path
                  fill="#4285F4"
                  d="M12 5.8c1.4 0 2.7.5 3.7 1.4l2.7-2.7A10 10 0 0012 2 10 10 0 003.3 7.4L6.4 10c.8-2.4 3-4.2 5.6-4.2z"
                />
              </svg>
              Continue with Google
            </button>

            <div className="my-4 text-center text-xs opacity-70">OR</div>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className={`w-full rounded-full px-4 py-3 border outline-none ${
                theme === "light"
                  ? "bg-white border-gray-300"
                  : "bg-[#1c1d22] border-gray-600 text-white"
              }`}
            />
            <button
              type="button"
              onClick={() => void onContinueEmail()}
              disabled={loadingAuth}
              className="mt-3 w-full rounded-full py-3 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
            >
              Continue
            </button>

            {authError && <p className="mt-3 text-sm text-red-500">{authError}</p>}
            {authMessage && <p className="mt-3 text-sm text-green-500">{authMessage}</p>}
          </div>
        </div>
      )}
    </>
  );
}
