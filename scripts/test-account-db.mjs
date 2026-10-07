// Isolated PostgreSQL checks; no hosted accounts or data are touched.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const { PGlite } = await import(
  process.env.PGLITE_MODULE || "@electric-sql/pglite"
);
const db = new PGlite();
const sql = async (name) =>
  db.exec(
    await readFile(new URL("../supabase/" + name, import.meta.url), "utf8"),
  );
const value = async (q, args = []) => (await db.query(q, args)).rows[0].v;
try {
  await db.exec(
    "create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key);",
  );
  await sql("signal.sql");
  await sql("curiosity_accounts.sql");
  await sql("curiosity_accounts.sql");
  const a = "11111111-1111-4111-8111-111111111111",
    b = "22222222-2222-4222-8222-222222222222";
  await db.query("insert into auth.users values($1),($2)", [a, b]);
  await db.query("select curiosity_save($1,'quiz-race')", [a]);
  await db.query("select curiosity_save($1,'quiz-race')", [a]);
  assert.equal(
    (await value("select curiosity_progress($1) v", [a])).discoveries.length,
    1,
  );
  assert.equal(
    (await value("select curiosity_progress($1) v", [b])).discoveries.length,
    0,
  );
  await db.query(
    "select curiosity_save($1,null,'d1-2026-10-07','2026-10-07',8,75)",
    [a],
  );
  await db.query(
    "select curiosity_save($1,null,'d1-2026-10-07','2026-10-07',6,100)",
    [a],
  );
  await db.query(
    "select curiosity_save($1,null,'d1-2026-10-07','2026-10-07',9,66)",
    [a],
  );
  assert.equal(
    (await value("select curiosity_progress($1) v", [a])).results[0].moves,
    6,
  );
  await db.exec(
    `insert into signal_boards values('2026-10-07','{"version":1,"minimum":6}');`,
  );
  let i = 1;
  const publish = async (hash, moves) =>
    value("select signal_publish($1,$2,$3,$4,$5,$6,$7,$8) v", [
      (i++).toString(16).padStart(48, "0"),
      hash,
      "QA",
      "2026-10-07",
      moves,
      Math.floor(600 / moves),
      "f".repeat(64),
      new Date(Date.now() + 3600000).toISOString(),
    ]);
  const guest = "a".repeat(64),
    guest2 = "b".repeat(64);
  await publish(guest, 8);
  await publish(guest2, 6);
  assert.equal(
    (await value("select curiosity_claim($1,$2) v", [a, guest])).claimed,
    true,
  );
  const player = await value("select curiosity_player($1) v", [a]);
  assert.notEqual(player, guest);
  await value("select curiosity_claim($1,$2) v", [a, guest]);
  await assert.rejects(
    value("select curiosity_claim($1,$2) v", [b, guest]),
    /guest_already_claimed/,
  );
  await value("select curiosity_claim($1,$2) v", [a, guest2]);
  const rank = await value("select signal_rankings('day','2026-10-07',$1) v", [
    player,
  ]);
  assert.equal(rank.count, 1);
  assert.equal(rank.entries[0].moves, 6);
  assert.equal(rank.mine.rank, 1);
  await db.query("select signal_remove_guest($1)", [player]);
  assert.equal(
    (await value("select signal_rankings('day','2026-10-07',null) v")).count,
    0,
  );
  assert.equal(
    (await value("select curiosity_progress($1) v", [a])).results[0].moves,
    6,
  );
  for (const table of [
    "curiosity_saved",
    "curiosity_results",
    "curiosity_players",
    "curiosity_claims",
  ]) {
    assert.equal(
      await value("select relrowsecurity v from pg_class where relname=$1", [
        table,
      ]),
      true,
    );
    assert.equal(
      await value("select has_table_privilege('anon',$1,'SELECT') v", [table]),
      false,
    );
  }
  assert.equal(
    await value(
      "select has_function_privilege('authenticated','curiosity_claim(uuid,text)','EXECUTE') v",
    ),
    false,
  );
  console.log(
    "PASS account DB: additive migration, private saves, idempotent saves/claims, best-score merge, account isolation, guest ownership, public removal preserves private history, RLS/grants",
  );
} finally {
  await db.close();
}
