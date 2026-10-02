/**
 * The gold set as it actually stands on disk, and the count that says whether
 * it is evidence yet.
 *
 * PRD §4.5 asks for ten real freelance agreements or leases with their
 * dangerous clauses identified in advance, plus five clean documents. A
 * synthetic document tests Redline against the imagination of whoever wrote
 * it, so the count that matters only counts real ones. These tests hold that
 * line: if synthetic entries ever started counting, a run against nothing
 * would read as a pass.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  TARGET_CLEAN,
  TARGET_DANGEROUS,
  coverage,
  coverageLine,
  listGoldSet,
} from "./entries.ts";
import type { GoldEntry, Provenance } from "./entries.ts";

const entries = listGoldSet();

test("every entry says where it came from and what it is", () => {
  assert.ok(entries.length > 0, "gold-set/ has no entries");

  const undeclared = entries
    .filter(
      (e) =>
        !["real", "synthetic"].includes(e.provenance) ||
        !["dangerous", "clean"].includes(e.kind),
    )
    .map((e) => e.name);

  assert.deepEqual(undeclared, [], undeclared.join(", "));
});

test("a dangerous entry has clauses identified in advance, a clean entry has none", () => {
  const wrong: string[] = [];
  for (const e of entries) {
    if (e.kind === "dangerous" && e.identified.length === 0) {
      wrong.push(`${e.name} is dangerous and identifies nothing`);
    }
    if (e.kind === "clean" && e.identified.length > 0) {
      wrong.push(`${e.name} is clean and identifies ${e.identified.length} clause(s)`);
    }
  }
  assert.deepEqual(wrong, [], wrong.join("\n  "));
});

test("synthetic entries are left out of the real-document count", () => {
  const dangerous = entries.find((e) => e.kind === "dangerous");
  const clean = entries.find((e) => e.kind === "clean");
  assert.ok(dangerous && clean, "the gold set needs one of each to measure this");

  const asReal = (e: GoldEntry, provenance: Provenance): GoldEntry => ({
    ...e,
    provenance,
  });

  const mixed = coverage([
    asReal(dangerous, "real"),
    asReal(dangerous, "synthetic"),
    asReal(dangerous, "synthetic"),
    asReal(clean, "synthetic"),
  ]);

  assert.equal(mixed.realDangerous, 1);
  assert.equal(mixed.syntheticDangerous, 2);
  assert.equal(mixed.realClean, 0);
  assert.equal(mixed.syntheticClean, 1);
  assert.equal(
    mixed.short,
    TARGET_DANGEROUS - 1 + TARGET_CLEAN,
    "the three synthetic entries were counted toward the target",
  );
  assert.equal(mixed.met, false);
});

test("the count is met only when ten real dangerous and five real clean documents are there", () => {
  const dangerous = entries.find((e) => e.kind === "dangerous");
  const clean = entries.find((e) => e.kind === "clean");
  assert.ok(dangerous && clean);

  const real = (e: GoldEntry, n: number): GoldEntry[] =>
    Array.from({ length: n }, (_, i) => ({
      ...e,
      name: `${e.name}-${i}`,
      provenance: "real" as const,
    }));

  const full = coverage([
    ...real(dangerous, TARGET_DANGEROUS),
    ...real(clean, TARGET_CLEAN),
  ]);
  assert.equal(full.met, true);
  assert.equal(full.short, 0);
  assert.match(coverageLine(full), /The gold set is complete\./);

  const oneShort = coverage([
    ...real(dangerous, TARGET_DANGEROUS),
    ...real(clean, TARGET_CLEAN - 1),
  ]);
  assert.equal(oneShort.met, false);
  assert.equal(oneShort.short, 1);
});

test("the line the runner prints names the real count and the target it is short of", () => {
  const cover = coverage(entries);
  const line = coverageLine(cover);

  assert.match(
    line,
    new RegExp(
      `${cover.realDangerous} of ${TARGET_DANGEROUS} dangerous, ${cover.realClean} of ${TARGET_CLEAN} clean`,
    ),
  );
  if (!cover.met) {
    assert.match(line, new RegExp(`${cover.short} short`));
  }
});

test("a fixture-backed entry reads the one copy of the document, with no second copy in gold-set/", () => {
  for (const entry of entries) {
    const dir = join(process.cwd(), "gold-set", entry.name);
    const manifest = JSON.parse(
      readFileSync(join(dir, "manifest.json"), "utf8"),
    ) as { fixture?: string };
    if (manifest.fixture === undefined) continue;

    assert.ok(
      !existsSync(join(dir, "document.txt")),
      `gold-set/${entry.name} is fixture-backed and also holds its own document.txt, so the two can drift apart`,
    );
    assert.ok(
      !existsSync(join(dir, "analysis.json")),
      `gold-set/${entry.name} is fixture-backed and also holds its own analysis.json, so the two can drift apart`,
    );

    assert.equal(
      entry.documentText,
      readFileSync(join(process.cwd(), entry.documentPath), "utf8"),
      `gold-set/${entry.name} did not read its text from ${entry.documentPath}`,
    );
  }
});

test("a fixture-backed entry identifies exactly the clauses the fixture plants, at the tiers it plants them", () => {
  for (const entry of entries) {
    const dir = join(process.cwd(), "gold-set", entry.name);
    const manifest = JSON.parse(
      readFileSync(join(dir, "manifest.json"), "utf8"),
    ) as { fixture?: string };
    if (manifest.fixture === undefined) continue;

    const sidecar = JSON.parse(
      readFileSync(
        join(process.cwd(), "tests", "fixtures", manifest.fixture),
        "utf8",
      ),
    ) as {
      plantedClauses: { clauseType: string; expectedSeverity: string }[];
    };

    assert.deepEqual(
      entry.identified.map((c) => `${c.clauseType}=${c.severity}`).sort(),
      sidecar.plantedClauses
        .map((c) => `${c.clauseType}=${c.expectedSeverity}`)
        .sort(),
    );
  }
});
