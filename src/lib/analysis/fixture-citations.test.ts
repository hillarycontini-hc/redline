/**
 * The fixture check. BRIEF §5, PRD §5, ADR 0001.
 *
 * The sidecars in tests/fixtures/ are the test data the rest of the build runs
 * against, so they are held to the rules a flag is held to: the source sentence
 * is locatable in its document, the clause type is a seeded red line, the tier
 * is the one that red line carries, and a counter-offer is present on every
 * tier that requires one.
 *
 * Everything is read off disk at run time. No sentence is copied into this
 * file, so the check tracks the fixture instead of a snapshot of it.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { locate } from "./citation.ts";
import { SEED_RED_LINES, requiresCounterOffer } from "./red-lines.ts";
import type { Severity } from "./types.ts";

const FIXTURES = join(process.cwd(), "tests", "fixtures");

/** One planted clause, as the sidecar records it. */
interface PlantedClause {
  clauseType: string;
  expectedSeverity: Severity;
  sourceSentence: string;
  consequence: string;
  /** null on Worth knowing, drafted replacement language otherwise. */
  counterOffer: string | null;
}

interface Sidecar {
  /** The document this sidecar describes, beside it in tests/fixtures/. */
  filename: string;
  kind: "dangerous" | "clean";
  summaryMustMention: string[];
  plantedClauses: PlantedClause[];
}

interface Fixture {
  /** The sidecar's own filename, e.g. "adhesion-contract.json". */
  name: string;
  sidecar: Sidecar;
  documentText: string;
}

function readFixture(name: string): Fixture {
  const sidecar = JSON.parse(
    readFileSync(join(FIXTURES, name), "utf8"),
  ) as Sidecar;
  const documentText = readFileSync(join(FIXTURES, sidecar.filename), "utf8");
  return { name, sidecar, documentText };
}

const fixtures: Fixture[] = readdirSync(FIXTURES)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map(readFixture);

/** The tier each seeded clause type carries. Spec D3: the list decides. */
const SEEDED = new Map<string, Severity>(
  SEED_RED_LINES.map((r) => [r.clauseType, r.severity]),
);

test("the fixtures plant every seeded clause type, and nothing else", () => {
  const planted = new Set(
    fixtures.flatMap((f) => f.sidecar.plantedClauses.map((c) => c.clauseType)),
  );
  assert.deepEqual(
    [...planted].sort(),
    [...SEEDED.keys()].sort(),
    "the planted clause types and the seeded clause types are not the same set",
  );
});

test("the clean fixture plants nothing", () => {
  const clean = fixtures.filter((f) => f.sidecar.kind === "clean");
  assert.ok(
    clean.length > 0,
    'no fixture is marked kind: "clean" — the suite needs a fair agreement that Redline stays quiet on',
  );
  for (const f of clean) {
    assert.deepEqual(
      f.sidecar.plantedClauses,
      [],
      `${f.name} is marked clean but plants ${f.sidecar.plantedClauses.length} clause(s)`,
    );
  }
});

for (const { name, sidecar, documentText } of fixtures) {
  const planted = sidecar.plantedClauses;

  test(`${name}: every source sentence is verbatim in ${sidecar.filename}`, () => {
    const misses = planted
      .filter((c) => locate(documentText, c.sourceSentence) === null)
      .map((c) => `[${c.clauseType}] ${JSON.stringify(c.sourceSentence)}`);

    assert.deepEqual(
      misses,
      [],
      `${misses.length} source sentence(s) not found in ${sidecar.filename}:\n  ${misses.join("\n  ")}`,
    );
  });

  test(`${name}: every clause type is a seeded red line`, () => {
    const unknown = planted
      .map((c) => c.clauseType)
      .filter((t) => !SEEDED.has(t));

    assert.deepEqual(
      unknown,
      [],
      `clause type(s) not in SEED_RED_LINES: ${unknown.join(", ")}`,
    );
  });

  test(`${name}: every expected severity is the tier its clause type carries`, () => {
    const wrong = planted
      .filter((c) => SEEDED.get(c.clauseType) !== c.expectedSeverity)
      .map(
        (c) =>
          `[${c.clauseType}] sidecar says ${JSON.stringify(c.expectedSeverity)}, SEED_RED_LINES says ${JSON.stringify(SEEDED.get(c.clauseType) ?? null)}`,
      );

    assert.deepEqual(wrong, [], wrong.join("\n  "));
  });

  test(`${name}: a counter-offer is present on every tier that requires one and null on Worth knowing`, () => {
    const wrong: string[] = [];

    for (const c of planted) {
      const hasOffer =
        typeof c.counterOffer === "string" && c.counterOffer.trim().length > 0;

      if (requiresCounterOffer(c.expectedSeverity)) {
        if (!hasOffer) {
          wrong.push(
            `[${c.clauseType}] is ${c.expectedSeverity} and needs a counter-offer, sidecar has ${JSON.stringify(c.counterOffer)}`,
          );
        }
      } else if (c.counterOffer !== null) {
        wrong.push(
          `[${c.clauseType}] is Worth knowing and must carry null, sidecar has ${JSON.stringify(c.counterOffer)}`,
        );
      }
    }

    assert.deepEqual(wrong, [], wrong.join("\n  "));
  });
}
