import test from "node:test";
import assert from "node:assert/strict";
import { readNdjson, consumeAnswer } from "../lib/ndjson";
function stream(text: string, size = 1) {
  const data = new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({
    start(c) {
      for (let i = 0; i < data.length; i += size)
        c.enqueue(data.slice(i, i + size));
      c.close();
    },
  });
}
test("NDJSON retains fragmented lines, UTF-8, CRLF, and final unterminated record", async () => {
  const actual = [];
  for await (const row of readNdjson(
    stream('{"response":"🧠 café"}\r\n\n{"done":true}'),
  ))
    actual.push(row);
  assert.deepEqual(actual, [{ response: "🧠 café" }, { done: true }]);
});
test("client accepts complete stream and rejects truncated, malformed, empty, and error streams", async () => {
  const chunks: string[] = [];
  const ok = await consumeAnswer(
    new Response(
      stream('{"type":"delta","response":"Hi."}\n{"type":"complete"}\n'),
    ),
    (s) => chunks.push(s),
  );
  assert.equal(ok, "Hi.");
  assert.deepEqual(chunks, ["Hi."]);
  for (const body of [
    '{"response":"partial"}\n',
    '{"type":"complete"}\n',
    "broken\n",
    '{"type":"error","code":"offline","error":"offline"}\n',
  ]) {
    await assert.rejects(consumeAnswer(new Response(stream(body)), () => {}));
  }
});
test("client surfaces controlled HTTP failure", async () => {
  await assert.rejects(
    consumeAnswer(Response.json({ error: "Busy" }, { status: 429 }), () => {}),
    /Busy/,
  );
});
