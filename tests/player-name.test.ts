import test from "node:test";
import assert from "node:assert/strict";
import { playerName } from "../lib/puzzle/playerName";
test("public player labels omit the collision suffix for old and new names", () => {
  assert.equal(playerName("GS-B63AE095"), "GS");
  assert.equal(playerName("GOBIS-1234ABCD"), "GOBIS");
  assert.equal(playerName("A-1234ABCD"), "A");
  assert.equal(playerName("GOBI"), "GOBI");
});
