/**
 * The citation check. PRD §4.1, spec Testing Decisions, ADR 0001.
 *
 * For every document in gold-set/, every source sentence in its recorded
 * analysis must be locatable in the document text. One miss fails the build.
 *
 * Layout: gold-set/<name>/document.txt and gold-set/<name>/analysis.json,
 * where analysis.json is the model's raw response for that document. See
 * gold-set/README.md.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { locate } from "./citation.ts";
import { parseModelResponse } from "./analyze.ts";

const GOLD = join(process.cwd(), "gold-set");

const entries = existsSync(GOLD)
  ? readdirSync(GOLD, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
  : [];

test("the gold set is not empty", () => {
  assert.ok(entries.length > 0, "gold-set/ has no documents");
});

for (const name of entries) {
  test(`gold-set/${name}: every source sentence is verbatim in the document`, () => {
    const dir = join(GOLD, name);
    const document = readFileSync(join(dir, "document.txt"), "utf8");
    const raw = readFileSync(join(dir, "analysis.json"), "utf8");
    const analysis = parseModelResponse(raw);

    const misses = analysis.flags
      .filter((f) => locate(document, f.sourceSentence) === null)
      .map((f) => `[${f.clauseType}] ${JSON.stringify(f.sourceSentence)}`);

    assert.deepEqual(
      misses,
      [],
      `${misses.length} source sentence(s) not found in ${name}/document.txt:\n  ${misses.join("\n  ")}`,
    );
  });
}
