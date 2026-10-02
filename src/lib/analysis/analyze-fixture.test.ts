/**
 * The whole analysis path, run against the gold fixtures with a stub model.
 *
 * The stub returns the payload a perfect model would return: one ModelFlag per
 * planted clause, built from the sidecar on disk. No sentence is typed into
 * this file, so the check tracks the fixture rather than a snapshot of it.
 *
 * Everything asserted here is something the reader would see on screen: how
 * many flags came back, what tier each carries, the order they arrive in,
 * whether the sentence they quote is really in the document, and which ones
 * carry replacement language.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyze } from "./analyze.ts";
import type { CallModel } from "./analyze.ts";
import { SEED_RED_LINES, compareSeverity } from "./red-lines.ts";
import type { ModelFlag, ModelResponse, Severity } from "./types.ts";

const FIXTURES = join(process.cwd(), "tests", "fixtures");

interface PlantedClause {
  clauseType: string;
  expectedSeverity: Severity;
  sourceSentence: string;
  consequence: string;
  counterOffer: string | null;
}

interface Sidecar {
  filename: string;
  kind: "dangerous" | "clean";
  summaryMustMention: string[];
  plantedClauses: PlantedClause[];
}

function readFixture(sidecarName: string) {
  const sidecar = JSON.parse(
    readFileSync(join(FIXTURES, sidecarName), "utf8"),
  ) as Sidecar;
  const documentText = readFileSync(join(FIXTURES, sidecar.filename), "utf8");
  return { sidecar, documentText };
}

/**
 * A model that returns exactly what the sidecar plants, plus anything the test
 * adds. This is a stub of the model, never of the module under test.
 */
function stubModel(sidecar: Sidecar, extra: ModelFlag[] = []): CallModel {
  const planted: ModelFlag[] = sidecar.plantedClauses.map((c) => {
    const flag: ModelFlag = {
      clauseType: c.clauseType,
      sourceSentence: c.sourceSentence,
      consequence: c.consequence,
      confidence: "high",
    };
    if (c.counterOffer !== null) flag.counterOffer = c.counterOffer;
    return flag;
  });

  const payload: ModelResponse = {
    summary: `What this document commits the signer to, on the points checked: ${sidecar.summaryMustMention.join("; ")}.`,
    flags: [...planted, ...extra],
  };

  return async () => JSON.stringify(payload);
}

const adhesion = readFixture("adhesion-contract.json");
const clean = readFixture("clean-agreement.json");

const EXPECTED_TIER = new Map(
  adhesion.sidecar.plantedClauses.map((c) => [c.clauseType, c.expectedSeverity]),
);

async function readAdhesion(extra: ModelFlag[] = []) {
  return analyze({
    documentText: adhesion.documentText,
    redLines: SEED_RED_LINES,
    callModel: stubModel(adhesion.sidecar, extra),
  });
}

test("the adhesion contract comes back with one flag per planted clause", async () => {
  const out = await readAdhesion();
  assert.equal(out.flags.length, adhesion.sidecar.plantedClauses.length);
  assert.equal(out.flags.length, 8);
  assert.deepEqual(out.dropped, []);
  assert.ok(out.summary.length > 0, "the statement came back with no summary");
});

test("every flag carries the tier its clause type earns", async () => {
  const out = await readAdhesion();
  const wrong = out.flags
    .filter((f) => EXPECTED_TIER.get(f.clauseType) !== f.severity)
    .map(
      (f) =>
        `[${f.clauseType}] shown as ${f.severity}, sidecar expects ${EXPECTED_TIER.get(f.clauseType)}`,
    );
  assert.deepEqual(wrong, [], wrong.join("\n  "));
});

test("flags arrive Critical, then Serious, then Worth knowing, and within a tier in document order", async () => {
  const out = await readAdhesion();

  // What the reader should see, worked out from the sidecar and the document
  // rather than from the implementation.
  const expected = [...adhesion.sidecar.plantedClauses]
    .map((c) => ({
      clauseType: c.clauseType,
      severity: c.expectedSeverity,
      at: adhesion.documentText.indexOf(c.sourceSentence),
    }))
    .sort(
      (a, b) => compareSeverity(a.severity, b.severity) || a.at - b.at,
    )
    .map((c) => c.clauseType);

  assert.deepEqual(
    out.flags.map((f) => f.clauseType),
    expected,
  );

  // And the ordering holds on its own terms, not only against that list.
  for (let i = 1; i < out.flags.length; i++) {
    const previous = out.flags[i - 1];
    const current = out.flags[i];
    const byTier = compareSeverity(previous.severity, current.severity);
    assert.ok(
      byTier < 0 ||
        (byTier === 0 && previous.location.start < current.location.start),
      `flag ${i} (${current.clauseType}, ${current.severity}) is out of order after ${previous.clauseType} (${previous.severity})`,
    );
  }
});

test("every source sentence shown is really in the document", async () => {
  const out = await readAdhesion();
  const missing = out.flags
    .filter((f) => !adhesion.documentText.includes(f.sourceSentence))
    .map((f) => `[${f.clauseType}] ${JSON.stringify(f.sourceSentence)}`);
  assert.deepEqual(
    missing,
    [],
    `${missing.length} flag(s) quote a sentence that is not in the document:\n  ${missing.join("\n  ")}`,
  );
});

test("Critical and Serious flags carry replacement language, Worth knowing does not", async () => {
  const out = await readAdhesion();

  const withOffer = out.flags.filter(
    (f) => typeof f.counterOffer === "string" && f.counterOffer.length > 0,
  );
  const withoutOffer = out.flags.filter((f) => f.counterOffer === undefined);

  assert.deepEqual(
    withOffer.map((f) => f.severity).sort(),
    ["Critical", "Critical", "Critical", "Serious", "Serious", "Serious"],
  );
  assert.deepEqual(
    withoutOffer.map((f) => f.severity),
    ["Worth knowing", "Worth knowing"],
  );
});

test("the clean agreement comes back with nothing flagged", async () => {
  const out = await analyze({
    documentText: clean.documentText,
    redLines: SEED_RED_LINES,
    callModel: stubModel(clean.sidecar),
  });

  assert.deepEqual(out.flags, []);
  assert.deepEqual(out.dropped, []);
  assert.ok(out.summary.length > 0, "a quiet result still needs its summary");
});

test("a flag whose sentence is not in the document is refused and recorded, and the rest survive", async () => {
  const invented: ModelFlag = {
    clauseType: "non-compete",
    sourceSentence:
      "The Contractor agrees never to work for anyone else again, anywhere, for any reason.",
    consequence: "The Contractor could never take another client.",
    confidence: "high",
    counterOffer: "Strike this clause.",
  };

  const out = await readAdhesion([invented]);

  assert.equal(out.flags.length, 8, "the eight locatable flags did not survive");
  assert.ok(
    !out.flags.some((f) => f.sourceSentence === invented.sourceSentence),
    "a flag whose sentence is not in the document reached the reader",
  );

  assert.equal(out.dropped.length, 1);
  assert.equal(out.dropped[0].reason, "unlocatable-source");
  assert.equal(out.dropped[0].clauseType, "non-compete");
  assert.equal(out.dropped[0].sourceSentence, invented.sourceSentence);
});
