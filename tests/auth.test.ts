import test from "node:test";
import assert from "node:assert/strict";
import {
  consumeTokenFromUrlHash,
  getAuthRedirectUrl,
} from "../lib/supabaseAuth";
test("legacy root auth fragments still get consumed and removed on /chat", () => {
  const values = new Map<string, string>();
  const events: string[] = [];
  let replaced = "";
  const windowStub = {
    location: {
      origin: "https://askgobi.net",
      pathname: "/chat",
      search: "",
      hash: "#access_token=synthetic-test-token&type=magiclink",
    },
    dispatchEvent(event: Event) {
      events.push(event.type);
    },
    history: {
      replaceState(_data: unknown, _title: string, path: string) {
        replaced = path;
      },
    },
  };
  Object.defineProperty(globalThis, "window", {
    value: windowStub,
    configurable: true,
  });
  Object.defineProperty(globalThis, "document", {
    value: { title: "AskGobi" },
    configurable: true,
  });
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      setItem(key: string, value: string) {
        values.set(key, value);
      },
    },
    configurable: true,
  });
  try {
    assert.equal(getAuthRedirectUrl(), "https://askgobi.net");
    assert.equal(consumeTokenFromUrlHash(), "synthetic-test-token");
    assert.equal(
      values.get("askgobi_supabase_access_token"),
      "synthetic-test-token",
    );
    assert.deepEqual(events, ["askgobi-auth-changed"]);
    assert.equal(replaced, "/chat");
  } finally {
    Reflect.deleteProperty(globalThis, "window");
    Reflect.deleteProperty(globalThis, "document");
    Reflect.deleteProperty(globalThis, "localStorage");
  }
});
