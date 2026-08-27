import test from "node:test";
import assert from "node:assert/strict";
import { shareLink } from "../lib/curiosity/share";
test("sharing uses native API, respects cancel, and falls back to copy/manual link", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  let copied = "";
  let nativePayload: unknown;
  const replace = (value: unknown) =>
    Object.defineProperty(globalThis, "navigator", {
      value,
      configurable: true,
    });
  try {
    replace({
      share: async (data: unknown) => {
        nativePayload = data;
      },
    });
    assert.equal(
      await shareLink("Title", "Badge", "https://askgobi.net"),
      "Share sheet closed.",
    );
    assert.deepEqual(nativePayload, {
      title: "Title",
      text: "Badge",
      url: "https://askgobi.net",
    });
    replace({
      share: async () => {
        throw new DOMException("Cancelled", "AbortError");
      },
      clipboard: {
        writeText: async () => {
          throw new Error("Should not copy after cancel");
        },
      },
    });
    assert.equal(
      await shareLink("Title", "Badge", "https://askgobi.net"),
      "Sharing cancelled.",
    );
    replace({
      clipboard: {
        writeText: async (value: string) => {
          copied = value;
        },
      },
    });
    assert.equal(
      await shareLink("Title", "Badge", "https://askgobi.net"),
      "Link copied.",
    );
    assert.equal(copied, "https://askgobi.net");
    replace({});
    assert.equal(
      await shareLink("Title", "Badge", "https://askgobi.net"),
      "Copy this link manually: https://askgobi.net",
    );
  } finally {
    if (original) Object.defineProperty(globalThis, "navigator", original);
    else Reflect.deleteProperty(globalThis, "navigator");
  }
});
