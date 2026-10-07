import test from "node:test";
import assert from "node:assert/strict";
import { getSessionToken, authReturnPath } from "../lib/supabaseAuth";
test("session renews once, removes invalid credentials, and rejects unsafe return paths", async () => {
  const local = new Map<string, string>();
  const session = new Map<string, string>();
  const storage = (data: Map<string, string>) => ({
    getItem: (k: string) => data.get(k) || null,
    setItem: (k: string, v: string) => data.set(k, v),
    removeItem: (k: string) => data.delete(k),
  });
  const originals = {
    localStorage: globalThis.localStorage,
    sessionStorage: globalThis.sessionStorage,
    window: globalThis.window,
    fetch: globalThis.fetch,
  };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage(local),
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: storage(session),
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: new EventTarget(),
  });
  try {
    local.set("askgobi_supabase_access_token", "old");
    local.set("askgobi_supabase_refresh_token", "refresh");
    local.set("askgobi_supabase_expires_at", "1");
    let requests = 0;
    globalThis.fetch = async () => {
      requests++;
      return Response.json({
        access_token: "new",
        refresh_token: "new-refresh",
        expires_in: 3600,
      });
    };
    assert.deepEqual(
      await Promise.all([getSessionToken(), getSessionToken()]),
      ["new", "new"],
    );
    assert.equal(requests, 1);
    local.set("askgobi_supabase_expires_at", "1");
    globalThis.fetch = async () => Response.json({}, { status: 400 });
    assert.equal(await getSessionToken(), null);
    assert.equal(local.has("askgobi_supabase_access_token"), false);
    session.set("askgobi_auth_return", "//evil.example");
    assert.equal(authReturnPath(), "/");
    session.set("askgobi_auth_return", "/\\evil.example");
    assert.equal(authReturnPath(), "/");
    session.set("askgobi_auth_return", "/?card=quiz-race");
    assert.equal(authReturnPath(), "/?card=quiz-race");
  } finally {
    globalThis.fetch = originals.fetch;
    for (const key of ["localStorage", "sessionStorage", "window"] as const)
      Object.defineProperty(globalThis, key, {
        configurable: true,
        value: originals[key],
      });
  }
});


test("discovery storage updates do not clear an active AI conversation", async () => {
  const { isAuthStorageEvent } = await import("../lib/supabaseAuth");
  assert.equal(isAuthStorageEvent({ key: "askgobi_quiz_history" } as StorageEvent), false);
  assert.equal(isAuthStorageEvent({ key: "askgobi_supabase_access_token" } as StorageEvent), true);
  assert.equal(isAuthStorageEvent({ key: null } as StorageEvent), true);
});
