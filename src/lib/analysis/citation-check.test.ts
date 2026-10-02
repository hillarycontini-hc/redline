/**
 * The citation check. PRD §4.1, spec Testing Decisions, ADR 0001.
 *
 * For every document in gold-set/, every source sentence in its recorded
 * reading must be locatable in the document text. One miss fails the build.
 *
 * The entries come through the gold-set loader, so an entry whose document
 * lives in tests/fixtures/ is checked here too, against the one copy of that
 * document in the repo. Layout and manifests: gold-set/README.md.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { locate } from "./citation.ts";
import { listGoldSet } from "../gold-set/entries.ts";

const entries = listGoldSet();

test("the gold set is not empty", () => {
  assert.ok(entries.length > 0, "gold-set/ has no documents");
});

for (const entry of entries) {
  test(`gold-set/${entry.name}: every source sentence is verbatim in the document`, () => {
    const misses = entry.recorded.flags
      .filter((f) => locate(entry.documentText, f.sourceSentence) === null)
      .map((f) => `[${f.clauseType}] ${JSON.stringify(f.sourceSentence)}`);

    assert.deepEqual(
      misses,
      [],
      `${misses.length} source sentence(s) not found in ${entry.documentPath}:\n  ${misses.join("\n  ")}`,
    );
  });
}
