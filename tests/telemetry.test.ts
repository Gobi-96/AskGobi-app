import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { eventNames, track } from "../lib/curiosity/telemetry";

test("telemetry sends only an aggregate name and never interrupts play on failure", async () => {
  const original = globalThis.fetch;
  const calls: { url: string; init?: RequestInit }[] = [];
  try {
    globalThis.fetch = (async (url, init) => {
      calls.push({ url: String(url), init });
      throw new TypeError("offline");
    }) as typeof fetch;
    for (const event of eventNames) assert.doesNotThrow(() => track(event));
    await Promise.resolve();
    assert.equal(calls.length, eventNames.length);
    calls.forEach(({ url, init }, index) => {
      assert.equal(url, "/api/events");
      assert.equal(init?.method, "POST");
      assert.equal(init?.keepalive, true);
      assert.deepEqual(JSON.parse(String(init?.body)), {
        event: eventNames[index],
      });
    });
    globalThis.fetch = () => {
      throw new Error("unavailable");
    };
    assert.doesNotThrow(() => track("contact_intent"));
    globalThis.fetch = async () => new Response(null, { status: 503 });
    assert.doesNotThrow(() => track("build_details_open"));
    await Promise.resolve();
  } finally {
    globalThis.fetch = original;
  }
});

test("additive SQL migration keeps both database allowlists aligned with the endpoint", () => {
  const sql = readFileSync("supabase/curiosity_signal_events.sql", "utf8");
  for (const event of eventNames) {
    assert.equal(sql.split("'" + event + "'").length - 1, 2, event);
  }
  assert.match(sql, /begin;/);
  assert.match(sql, /commit;/);
  assert.match(sql, /event_name is null/);
  assert.match(sql, /from public,\s*anon,\s*authenticated/);
  assert.match(sql, /to service_role/);
  assert.doesNotMatch(sql, /drop table|disable row level security|truncate/i);
});
