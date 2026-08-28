// Isolated PostgreSQL regression suite. Never connects to Supabase or a host DB.
// npm test first; supply PGLITE_MODULE when installed outside this repository.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
const { PGlite } = await import(
  process.env.PGLITE_MODULE || "@electric-sql/pglite"
);
const require = createRequire(import.meta.url);
const { generate } = require("../.test-build/lib/puzzle/engine.js");
const db = new PGlite();
let checks = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  checks++;
};
try {
  await db.exec(
    "create role anon; create role authenticated; create role service_role;",
  );
  const sql = await readFile(
    new URL("../supabase/signal.sql", import.meta.url),
    "utf8",
  );
  await db.exec(sql);
  await db.exec(sql); // additive migration is safe to reapply
  const {
    rows: [dates],
  } = await db.query(
    "select (now() at time zone 'UTC')::date::text as today, ((now() at time zone 'UTC')::date-1)::text as yesterday, ((now() at time zone 'UTC')::date-7)::text as last_week",
  );
  const freeze = async (day) => {
    const board = generate("d1-" + day);
    return (
      await db.query("select public.signal_freeze_board($1,$2) as value", [
        day,
        JSON.stringify(board),
      ])
    ).rows[0].value;
  };
  const today = await freeze(dates.today),
    yesterday = await freeze(dates.yesterday),
    lastWeek = await freeze(dates.last_week);
  const frozen = (
    await db.query("select public.signal_freeze_board($1,$2) as value", [
      dates.today,
      JSON.stringify({ ...today, minimum: 10 }),
    ])
  ).rows[0].value;
  assert.deepEqual(frozen, today);
  checks++;
  let nonce = 1;
  const guestA = "a".repeat(64),
    guestB = "b".repeat(64);
  async function publish(
    hash,
    board,
    moves = board.minimum,
    receipt = (nonce++).toString(16).padStart(48, "0"),
    points = Math.floor((100 * board.minimum) / moves),
  ) {
    const args = [
      receipt,
      hash,
      "GS",
      board.day,
      moves,
      points,
      "c".repeat(64),
      new Date(Date.now() + 7_000_000).toISOString(),
    ];
    return (
      await db.query(
        "select public.signal_publish($1,$2,$3,$4,$5,$6,$7,$8) as value",
        args,
      )
    ).rows[0].value;
  }
  const firstReceipt = (nonce++).toString(16).padStart(48, "0");
  const first = await publish(guestA, today, today.minimum + 2, firstReceipt);
  assert.deepEqual(
    await publish(guestA, today, today.minimum + 2, firstReceipt),
    first,
  );
  checks++;
  await assert.rejects(
    publish(guestB, today, today.minimum + 2, firstReceipt),
    /attempt_already_claimed/,
  );
  checks++;
  await assert.rejects(
    publish(guestB, today, today.minimum, undefined, 999),
    /invalid_points/,
  );
  checks++;
  await assert.rejects(publish(guestB, today, 1), /invalid_score/);
  checks++;
  await db.query("begin");
  await db.query("set local role anon");
  await assert.rejects(
    db.query("select * from public.signal_guests"),
    /permission denied/,
  );
  checks++;
  await db.query("rollback");
  await db.query("begin");
  await db.query("set local role authenticated");
  await assert.rejects(
    db.query("select public.signal_rankings('day',$1,null)", [dates.today]),
    /permission denied/,
  );
  checks++;
  await db.query("rollback");
  // PGlite serializes commands. Exercise interleaved best updates here; real
  // multi-connection races remain a mandatory staging check before publishing.
  await Promise.all([
    publish(guestA, today),
    publish(guestA, today, today.minimum + 5),
  ]);
  const best = (
    await db.query(
      "select moves,points from public.signal_scores where guest_hash=$1 and day=$2",
      [guestA, dates.today],
    )
  ).rows[0];
  check(
    best.moves === today.minimum && best.points === 100,
    "worse retry cannot overwrite best",
  );
  await publish(guestB, today);
  await publish(guestA, lastWeek);
  await publish(guestA, yesterday);
  const rankings = async (period) =>
    (
      await db.query("select public.signal_rankings($1,$2,$3) as value", [
        period,
        dates.today,
        guestA,
      ])
    ).rows[0].value;
  const daily = await rankings("day");
  check(
    daily.entries.length === 2 && daily.entries.every((e) => e.rank === 1),
    "ties share rank",
  );
  check(
    daily.entries[0].alias !== daily.entries[1].alias,
    "matching initials have distinct discriminators",
  );
  check(
    !JSON.stringify(daily).includes(guestA),
    "public rankings contain no guest hash",
  );
  const weekly = await rankings("week"),
    all = await rankings("all");
  const monday = new Date(dates.today + "T00:00:00Z").getUTCDay() === 1;
  check(
    weekly.entries[0].points === (monday ? 100 : 200),
    "week begins Monday UTC and excludes last week",
  );
  check(all.entries[0].points === 300, "all-time sums daily best points");
  for (let i = 10; i < 40; i++)
    await publish(i.toString(16).padStart(64, "0"), today);
  const capped = await rankings("day");
  check(
    capped.entries.length === 25 && capped.count === 32,
    "top 25 is a cap, not a fabricated population",
  );
  await db.query("select public.signal_remove_guest($1)", [guestA]);
  check(
    (
      await db.query("select * from public.signal_scores where guest_hash=$1", [
        guestA,
      ])
    ).rows.length === 0,
    "deletion cascades scores",
  );
  check(
    (
      await db.query("select * from public.signal_guests where guest_hash=$1", [
        guestA,
      ])
    ).rows.length === 0,
    "deletion removes identity",
  );
  const tombstone = (
    await db.query(
      "select guest_hash,result from public.signal_receipts where nonce=$1",
      [firstReceipt],
    )
  ).rows[0];
  check(
    tombstone.guest_hash === null && Object.keys(tombstone.result).length === 0,
    "receipt no longer contains identity/alias",
  );
  await assert.rejects(
    publish(guestA, today, today.minimum + 2, firstReceipt),
    /attempt_already_claimed/,
  );
  checks++;
  await db.exec(
    await readFile(
      new URL("../supabase/curiosity_events.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL("../supabase/curiosity_builder_events.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL("../supabase/curiosity_signal_events.sql", import.meta.url),
      "utf8",
    ),
  );
  check(true, "aggregate-event migrations apply in order");
  console.log(
    `PASS: ${checks} isolated PostgreSQL assertions. No external database was used.`,
  );
} finally {
  await db.close();
}
