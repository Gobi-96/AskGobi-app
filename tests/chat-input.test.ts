import test from "node:test";
import assert from "node:assert/strict";
import { needsWebSearch } from "../lib/chatInput";
import { needsWebSearch as serverNeedsWebSearch } from "../lib/server/ask";

test("composer and server use the same search routing", () => {
  assert.equal(needsWebSearch, serverNeedsWebSearch);
  for (const question of ["What is the weather today?", "Latest version?", "Current price?"])
    assert.equal(needsWebSearch(question), true);
  for (const question of ["Why do we get hiccups?", "How does GPS find me?", "Invent a ridiculous superhero.", "Who’s behind AskGobi?", "Explain a snowflake", "I knew it"])
    assert.equal(needsWebSearch(question), false);
});
