/**
 * The release gates, exercised against the readings recorded in the repo. No
 * model is called: every document, every sentence and every tier here comes
 * off disk, and the failures are made by withholding part of a recorded
 * reading rather than by typing a new one.
 *
 * What each test holds:
 *   - catches what matters fails, and names the clause, when a Critical clause
 *     identified in advance is missing from the analysis (PRD §4.2).
 *   - the clean-document gate fails on each of its three conditions on its own
 *     (PRD §4.4, spec D6).
 *   - both gates pass on the readings that should pass.
 *   - the severity measure is computed right and cannot change the verdict
 *     (PRD §4.3, spec D9).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { enforce } from "../analysis/analyze.ts";
import { SEED_RED_LINES } from "../analysis/red-lines.ts";
import type { Analysis, ModelResponse, Severity } from "../analysis/types.ts";
import { readGoldEntry } from "./entries.ts";
import type { GoldEntry } from "./entries.ts";
import {
  CLEAN_MAX_FLAGS,
  SEVERITY_AGREEMENT_TARGET,
  failed,
  judge,
  saysItLooksReasonable,
} from "./gates.ts";

const dangerous = readGoldEntry("adhesion-contract");
const clean = readGoldEntry("clean-agreement");

/** Put a recorded reading through the rules the live path applies after the model answers. */
function read(entry: GoldEntry, recorded: ModelResponse = entry.recorded): Analysis {
  return enforce(entry.documentText, SEED_RED_LINES, recorded);
}

/** The recorded reading with only some of its flags kept, and an optional other summary. */
function keeping(
  entry: GoldEntry,
  clauseTypes: readonly string[],
  summary: string = entry.recorded.summary,
): ModelResponse {
  return {
    summary,
    flags: entry.recorded.flags.filter((f) => clauseTypes.includes(f.clauseType)),
  };
}

/** A document marked clean, carrying whichever of the loud document's flags the test wants. */
function markedClean(recorded: ModelResponse): {
  entry: GoldEntry;
  analysis: Analysis;
} {
  const entry: GoldEntry = {
    ...dangerous,
    name: "marked-clean",
    kind: "clean",
    identified: [],
  };
  return { entry, analysis: read(entry, recorded) };
}

const CRITICAL = dangerous.identified
  .filter((c) => c.severity === "Critical")
  .map((c) => c.clauseType);

const ALL_CLAUSES = dangerous.identified.map((c) => c.clauseType);

test("the gold set entries this suite runs on hold what it needs", () => {
  assert.equal(dangerous.kind, "dangerous");
  assert.equal(clean.kind, "clean");
  assert.ok(CRITICAL.length >= 1, "the dangerous entry identifies no Critical clause");
  assert.deepEqual(clean.identified, []);
});

test("both gates pass on the readings recorded for them", () => {
  const loud = judge(dangerous, read(dangerous));
  assert.deepEqual(loud.failures, []);
  assert.equal(failed(loud), false);
  assert.equal(loud.catches?.identified, CRITICAL.length);
  assert.equal(loud.catches?.caught, CRITICAL.length);
  assert.deepEqual(loud.catches?.missing, []);

  const quiet = judge(clean, read(clean));
  assert.deepEqual(quiet.failures, []);
  assert.equal(failed(quiet), false);
  assert.equal(quiet.clean?.criticalFlags, 0);
  assert.equal(quiet.clean?.flagCount, 0);
  assert.equal(quiet.clean?.saysItLooksReasonable, true);
});

test("catches what matters fails, and names the clause, when a Critical clause is missing", () => {
  const withheld = CRITICAL[0];
  const kept = ALL_CLAUSES.filter((t) => t !== withheld);

  const verdict = judge(dangerous, read(dangerous, keeping(dangerous, kept)));

  assert.equal(failed(verdict), true);
  assert.deepEqual(verdict.catches?.missing, [withheld]);
  assert.equal(verdict.catches?.caught, CRITICAL.length - 1);
  assert.equal(
    verdict.failures.filter((f) => f.includes(withheld)).length,
    1,
    `nothing in the failures named ${withheld}: ${verdict.failures.join(" | ")}`,
  );
});

test("catches what matters passes when a clause that is not Critical is missing", () => {
  const notCritical = dangerous.identified.find((c) => c.severity !== "Critical");
  assert.ok(notCritical, "the dangerous entry identifies nothing below Critical");

  const kept = ALL_CLAUSES.filter((t) => t !== notCritical.clauseType);
  const verdict = judge(dangerous, read(dangerous, keeping(dangerous, kept)));

  assert.deepEqual(verdict.failures, []);
  assert.deepEqual(verdict.catches?.missing, []);
  // A clause that was never flagged has no tier to compare, and is not
  // counted as a tier the reviewer disagreed with.
  assert.equal(verdict.severity.notFlagged, 1);
  assert.equal(verdict.severity.compared, ALL_CLAUSES.length - 1);
});

test("the clean-document gate fails on a Critical flag, and on nothing else", () => {
  // One Critical flag, which is inside the flag count and carries a summary
  // that does say the document looks reasonable.
  const { entry, analysis } = markedClean(
    keeping(dangerous, [CRITICAL[0]], clean.recorded.summary),
  );
  const verdict = judge(entry, analysis);

  assert.equal(verdict.clean?.criticalFlags, 1);
  assert.equal(verdict.clean?.flagCount, 1);
  assert.equal(verdict.clean?.saysItLooksReasonable, true);
  assert.equal(verdict.clean?.failures.length, 1);
  assert.match(verdict.clean?.failures[0] ?? "", /Critical/);
  assert.equal(failed(verdict), true);
});

test("the clean-document gate fails on more than two flags, and on nothing else", () => {
  const quietTiers = dangerous.identified
    .filter((c) => c.severity !== "Critical")
    .map((c) => c.clauseType)
    .slice(0, CLEAN_MAX_FLAGS + 1);
  assert.equal(quietTiers.length, CLEAN_MAX_FLAGS + 1);

  const { entry, analysis } = markedClean(
    keeping(dangerous, quietTiers, clean.recorded.summary),
  );
  const verdict = judge(entry, analysis);

  assert.equal(verdict.clean?.criticalFlags, 0);
  assert.equal(verdict.clean?.flagCount, CLEAN_MAX_FLAGS + 1);
  assert.equal(verdict.clean?.saysItLooksReasonable, true);
  assert.equal(verdict.clean?.failures.length, 1);
  assert.match(verdict.clean?.failures[0] ?? "", /at most 2/);
  assert.equal(failed(verdict), true);
});

test("the clean-document gate fails on a summary that does not say the document looks reasonable, and on nothing else", () => {
  // Nothing flagged at all, so the only thing left to fail on is the summary.
  // The wording is the one recorded for the loud document, which describes
  // what the signer is committing to rather than reassuring them.
  const { entry, analysis } = markedClean(
    keeping(dangerous, [], dangerous.recorded.summary),
  );
  const verdict = judge(entry, analysis);

  assert.equal(verdict.clean?.criticalFlags, 0);
  assert.equal(verdict.clean?.flagCount, 0);
  assert.equal(verdict.clean?.saysItLooksReasonable, false);
  assert.equal(verdict.clean?.failures.length, 1);
  assert.match(verdict.clean?.failures[0] ?? "", /summary/);
  assert.equal(failed(verdict), true);
});

test("a summary saying the document does not look reasonable fails the same condition", () => {
  const { entry, analysis } = markedClean(
    keeping(
      dangerous,
      [],
      "Taken together, this document does not look reasonable on the points checked.",
    ),
  );
  const verdict = judge(entry, analysis);

  assert.equal(verdict.clean?.saysItLooksReasonable, false);
  assert.equal(failed(verdict), true);
});

test("the reassurance the clean gate looks for is the phrase, not the word", () => {
  assert.equal(
    saysItLooksReasonable("On the points checked, this document looks reasonable."),
    true,
  );
  assert.equal(
    saysItLooksReasonable("The terms\n  look  reasonable for work of this size."),
    true,
  );
  assert.equal(
    saysItLooksReasonable("The document does not look reasonable."),
    false,
  );
  assert.equal(
    saysItLooksReasonable("The fee is reasonable, and the indemnity is uncapped."),
    false,
  );
  assert.equal(saysItLooksReasonable(""), false);
});

test("the severity measure agrees with itself on a reading that matches what was identified", () => {
  const verdict = judge(dangerous, read(dangerous));

  assert.equal(verdict.severity.compared, ALL_CLAUSES.length);
  assert.equal(verdict.severity.agreed, ALL_CLAUSES.length);
  assert.equal(verdict.severity.agreement, 1);
  assert.deepEqual(verdict.severity.disagreements, []);
  assert.deepEqual(verdict.severity.offByTwo, []);
});

test("poor tier agreement, including a two-tier disagreement, does not change the verdict", () => {
  // Every clause identified as Critical, against a reading that returns the
  // tier each clause type actually earns. Three agree; the two Worth-knowing
  // clauses come back two tiers below what was identified.
  const seeded = new Map<string, Severity>(
    SEED_RED_LINES.map((r) => [r.clauseType, r.severity]),
  );
  const entry: GoldEntry = {
    ...dangerous,
    identified: dangerous.identified.map((c) => ({
      clauseType: c.clauseType,
      severity: "Critical" as const,
    })),
  };

  const verdict = judge(entry, read(dangerous));

  const expectedAgreed = ALL_CLAUSES.filter(
    (t) => seeded.get(t) === "Critical",
  ).length;
  const expectedOffByTwo = ALL_CLAUSES.filter(
    (t) => seeded.get(t) === "Worth knowing",
  ).length;

  assert.equal(verdict.severity.compared, ALL_CLAUSES.length);
  assert.equal(verdict.severity.agreed, expectedAgreed);
  assert.equal(verdict.severity.offByTwo.length, expectedOffByTwo);
  assert.ok(
    (verdict.severity.agreement ?? 1) < SEVERITY_AGREEMENT_TARGET,
    "this reading was meant to fall short of the agreement target",
  );

  // PRD §4.3, spec D9: tracked, not gating. Every Critical clause identified
  // here is in the analysis, so nothing gating failed, so the run passes.
  assert.deepEqual(verdict.catches?.missing, []);
  assert.deepEqual(verdict.failures, []);
  assert.equal(failed(verdict), false);
});

test("a flag citing a sentence that is not in the document fails the run", () => {
  // The analysis seam drops an unplaceable flag before anyone sees it, so this
  // reading cannot come out of the real path. The gate checks anyway: ADR 0001
  // is the one property the product exists to prove, and a gate that stopped
  // looking for it would be worse than no gate.
  const analysis: Analysis = {
    summary: dangerous.recorded.summary,
    flags: [
      {
        clauseType: "non-compete",
        severity: "Serious",
        sourceSentence:
          "The Contractor agrees never to work for anyone else again, anywhere, for any reason.",
        location: { start: 0, end: 1 },
        consequence: "The Contractor could never take another client.",
        counterOffer: "Strike this clause.",
      },
    ],
    dropped: [],
    missingCounterOffers: [],
  };

  const verdict = judge(dangerous, analysis);

  assert.equal(verdict.citations.checked, 1);
  assert.equal(verdict.citations.unlocatable.length, 1);
  assert.equal(verdict.citations.passed, false);
  assert.equal(failed(verdict), true);
  assert.ok(
    verdict.failures.some((f) => f.startsWith("citations:")),
    verdict.failures.join(" | "),
  );
});
