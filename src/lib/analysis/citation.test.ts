import { test } from "node:test";
import assert from "node:assert/strict";
import { locate } from "./citation.ts";
import { normalize } from "./normalize.ts";

const DOC = `1. Term.\n\nThis Agreement shall automatically renew for successive one-year\nterms unless either party gives written notice   of non-renewal.\n\n2. Ownership. The Client shall own all “Work Product” upon creation.`;

test("normalize collapses whitespace and folds curly quotes", () => {
  const n = normalize(`  “Hello”\n\n  world  `);
  assert.equal(n.text, `"Hello" world`);
  assert.equal(n.map.length, n.text.length);
});

test("locates an exact quote", () => {
  const loc = locate(DOC, "This Agreement shall automatically renew");
  assert.ok(loc);
  assert.equal(DOC.slice(loc.start, loc.end), "This Agreement shall automatically renew");
});

test("locates across a line break and a whitespace run", () => {
  const quote =
    "successive one-year terms unless either party gives written notice of non-renewal.";
  const loc = locate(DOC, quote);
  assert.ok(loc);
  assert.equal(normalize(DOC.slice(loc.start, loc.end)).text, quote);
});

test("locates with straight quotes against curly quotes in the document", () => {
  const loc = locate(DOC, 'own all "Work Product" upon creation');
  assert.ok(loc);
  assert.equal(DOC.slice(loc.start, loc.end), "own all “Work Product” upon creation");
});

test("does not locate a paraphrase", () => {
  assert.equal(locate(DOC, "The agreement renews every year automatically"), null);
});

test("does not locate a near-miss with one word changed", () => {
  assert.equal(locate(DOC, "This Agreement will automatically renew"), null);
});

test("does not locate an empty or whitespace-only quote", () => {
  assert.equal(locate(DOC, ""), null);
  assert.equal(locate(DOC, "   \n"), null);
});

test("does not lowercase: case differences are not a match", () => {
  assert.equal(locate(DOC, "this agreement shall automatically renew"), null);
});
