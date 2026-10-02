import { test } from "node:test";
import assert from "node:assert/strict";
import { checkUsable, MIN_USABLE_CHARS } from "./extract.ts";

test("too little text is reported as unreadable, not analysed", () => {
  const r = checkUsable("   \n\n  a few words  ");
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "no-text");
});

test("enough text passes through unchanged", () => {
  const text = "x".repeat(MIN_USABLE_CHARS) + "\n";
  const r = checkUsable(text);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.text, text);
});
