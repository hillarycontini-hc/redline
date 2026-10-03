/**
 * The reader's own list deciding what a reading shows.
 *
 * This is the heart of the ticket, so it is tested at the seam the reader's
 * statement comes out of — `analyze()`, both passes, with a stub model — rather
 * than at `enforce()`, which cannot show whether a promoted clause came back
 * with wording to send. analyze.test.ts already checks the override and the
 * deletion at `enforce()` on a hand-written document; these run the whole path
 * over the fixture.
 *
 * The stub returns what a perfect model would: one flag per planted clause,
 * built from the sidecar on disk, so no sentence is typed into this file and
 * the checks track the fixture rather than a snapshot of it. It is a stub of
 * the model and never of the module under test.
 *
 * Everything asserted is something the reader would see: which flags came
 * back, the tier each carries, the sentence it quotes, and whether it carries
 * wording to send the other side.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyze } from "./analyze.ts";
import type { CallModel } from "./analyze.ts";
import { SEED_RED_LINES } from "./red-lines.ts";
import type { ModelFlag, ModelResponse, RedLine, Severity } from "./types.ts";
import {
  newRedLine,
  plainRedLine,
  redLineEntriesFrom,
} from "../supabase/red-lines.ts";

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

const sidecar = JSON.parse(
  readFileSync(join(FIXTURES, "adhesion-contract.json"), "utf8"),
) as Sidecar;
const documentText = readFileSync(join(FIXTURES, sidecar.filename), "utf8");

const PLANTED = new Map(sidecar.plantedClauses.map((c) => [c.clauseType, c]));

/** The flags a perfect model would return for the fixture, from the sidecar. */
function plantedFlags(): ModelFlag[] {
  return sidecar.plantedClauses.map((c) => {
    const flag: ModelFlag = {
      clauseType: c.clauseType,
      sourceSentence: c.sourceSentence,
      consequence: c.consequence,
      confidence: "high",
    };
    if (c.counterOffer !== null) flag.counterOffer = c.counterOffer;
    return flag;
  });
}

/**
 * A model that answers both calls: the reading first, and then the drafting
 * pass, which analyze() makes only when the reading left a Critical or Serious
 * flag owed wording. Wording is keyed by clause type, which is how the drafting
 * pass ties an offer back to the sentence it replaces when there is one flag of
 * each type.
 */
function stubModel(
  flags: ModelFlag[],
  drafted: Record<string, string> = {},
): CallModel {
  let calls = 0;

  return async () => {
    calls += 1;

    if (calls === 1) {
      const reading: ModelResponse = {
        summary: `What this document commits the signer to, on the points checked: ${sidecar.summaryMustMention.join("; ")}.`,
        flags,
      };
      return JSON.stringify(reading);
    }

    return JSON.stringify({
      counterOffers: Object.entries(drafted).map(
        ([clauseType, counterOffer]) => ({ clauseType, counterOffer }),
      ),
    });
  };
}

function reTiered(clauseType: string, severity: Severity): RedLine[] {
  return SEED_RED_LINES.map((r) =>
    r.clauseType === clauseType ? { ...r, severity } : r,
  );
}

/* ------------------------------------------- promoting one of the seeded eight */

test("promoting arbitration to Critical brings that flag back Critical, carrying wording to send", async () => {
  const drafted =
    "Any dispute arising out of this Agreement may be brought in the state or federal courts sitting in the county where the Contractor has its principal place of business, and neither party waives any right to bring or join a class or collective action.";

  const out = await analyze({
    documentText,
    redLines: reTiered("arbitration", "Critical"),
    callModel: stubModel(plantedFlags(), { arbitration: drafted }),
  });

  const arbitration = out.flags.find((f) => f.clauseType === "arbitration");
  assert.ok(arbitration, "the arbitration flag did not come back at all");

  // The seeded tier for arbitration is Worth knowing. The reader's own entry
  // replaces it (spec D3), rather than being a floor it cannot go above.
  assert.equal(PLANTED.get("arbitration")?.expectedSeverity, "Worth knowing");
  assert.equal(arbitration.severity, "Critical");

  // Critical always carries wording. The sidecar plants none for arbitration,
  // because it is seeded as Worth knowing — so this is the drafting pass
  // closing a gap the promotion opened.
  assert.equal(PLANTED.get("arbitration")?.counterOffer, null);
  assert.equal(arbitration.counterOffer, drafted);
  assert.deepEqual(out.missingCounterOffers, []);

  // And it still cites the document's own sentence, which is the only reason
  // the tier on it means anything.
  assert.equal(
    arbitration.sourceSentence,
    PLANTED.get("arbitration")?.sourceSentence,
  );
  assert.ok(documentText.includes(arbitration.sourceSentence));

  // And it has moved up the statement with its tier. It was last of eight at
  // Worth knowing; at Critical it sits in the Critical block, after the other
  // Critical clauses only because they appear earlier in the document.
  const where = out.flags.findIndex((f) => f.clauseType === "arbitration");
  assert.deepEqual(
    out.flags.slice(0, where).map((f) => f.severity),
    ["Critical", "Critical", "Critical"],
  );
  assert.ok(
    out.flags.slice(where + 1).every((f) => f.severity !== "Critical"),
    "the promoted flag is not inside the Critical block",
  );
});

/* ---------------------------------------------------- taking one off the list */

test("taking auto-renewal off the list means no auto-renewal flag", async () => {
  const redLines = SEED_RED_LINES.filter(
    (r) => r.clauseType !== "auto-renewal",
  );

  const out = await analyze({
    documentText,
    redLines,
    callModel: stubModel(plantedFlags()),
  });

  assert.ok(
    PLANTED.has("auto-renewal"),
    "the fixture no longer plants an auto-renewal clause, so this proves nothing",
  );
  assert.ok(
    !out.flags.some((f) => f.clauseType === "auto-renewal"),
    "a clause type the reader took off their list was still flagged",
  );

  // The other seven are untouched: taking one entry off silences one clause
  // type, not the reading.
  assert.equal(out.flags.length, 7);
  assert.deepEqual(
    out.flags.map((f) => f.clauseType).sort(),
    [...PLANTED.keys()].filter((t) => t !== "auto-renewal").sort(),
  );

  assert.deepEqual(
    out.dropped.map((d) => [d.reason, d.clauseType]),
    [["unknown-clause-type", "auto-renewal"]],
  );
});

/* ---------------------------------------------- a red line the reader adds */

/**
 * The sentence at a numbered clause, read out of the document rather than typed
 * into this file. The fixture plants nothing at 5.3, which is what makes it a
 * clause a reader would have to add themselves.
 */
function clauseSentence(number: string): string {
  const at = documentText.indexOf(`\n${number} `);
  assert.ok(at >= 0, `the fixture no longer has a clause ${number}`);

  const from = at + 1 + number.length + 1;
  const to = documentText.indexOf("\n", from);
  const sentence = documentText.slice(from, to === -1 ? undefined : to).trim();

  for (const planted of PLANTED.values()) {
    assert.notEqual(
      planted.sourceSentence,
      sentence,
      `clause ${number} is planted in the sidecar, so it is not a clause the reader has to add`,
    );
  }

  return sentence;
}

test("a red line the reader adds, at the tier they chose, produces flags at that tier", async () => {
  const portfolioBan = clauseSentence("5.3");

  for (const chosen of ["Critical", "Serious", "Worth knowing"] as const) {
    const written = newRedLine({
      label: "No portfolio or case study rights",
      description:
        "The agreement stops me showing the work in a portfolio, a case study, or any marketing material without the client's written consent.",
      severity: chosen,
    });
    assert.equal(written.ok, true);
    if (!written.ok) throw new Error("unreachable");

    const own = written.redLine;
    const drafted =
      "The Contractor may describe the work product and display non-confidential excerpts of it in a portfolio or case study, provided no confidential information of the Client is disclosed.";

    const out = await analyze({
      documentText,
      redLines: [...SEED_RED_LINES, own],
      callModel: stubModel(
        [
          ...plantedFlags(),
          {
            clauseType: own.clauseType,
            sourceSentence: portfolioBan,
            consequence:
              "The work cannot be shown to the next client without this client's permission, so it does nothing to win further work.",
            confidence: "high",
          },
        ],
        { [own.clauseType]: drafted },
      ),
    });

    const added = out.flags.find((f) => f.clauseType === own.clauseType);
    assert.ok(added, `the reader's own red line produced no flag at ${chosen}`);

    // The tier is the one the reader chose, not one Redline decided for them.
    assert.equal(added.severity, chosen);
    assert.equal(added.sourceSentence, portfolioBan);
    assert.ok(documentText.includes(added.sourceSentence));

    // And the counter-offer rule holds for an added entry exactly as it does
    // for a seeded one: Critical and Serious carry wording, Worth knowing
    // never does.
    if (chosen === "Worth knowing") {
      assert.equal(added.counterOffer, undefined);
    } else {
      assert.equal(added.counterOffer, drafted);
    }

    // The eight seeded clause types are still read alongside it.
    assert.equal(out.flags.length, PLANTED.size + 1);
  }
});

/* --------------------------------------- one list, every kind of document */

const AUTO_RENEWAL =
  "This agreement renews automatically for a further twelve months unless notice is given no later than thirty days before the end of the then-current term.";

const LEASE = `RESIDENTIAL TENANCY AGREEMENT

1. TERM

1.1 The tenancy runs for twelve months from the commencement date. ${AUTO_RENEWAL}

2. RENT

2.1 Rent is payable monthly in advance on the first day of each month.
`;

const TERMS_OF_SERVICE = `TERMS OF SERVICE

4. SUBSCRIPTION

4.1 Your subscription is billed annually to the card on file. ${AUTO_RENEWAL}

5. CHANGES

5.1 We may change these terms by posting a revised version on the site.
`;

test("the same list applies to a lease and to terms of service alike", async () => {
  // No lease or terms-of-service fixture exists, so both documents are written
  // here, each around the same sentence the stub then quotes. What is being
  // checked is not the parsing: it is that the analysis takes a document and a
  // list and nothing else, so no document type can be given a list of its own
  // (spec D4).
  const flag: ModelFlag = {
    clauseType: "auto-renewal",
    sourceSentence: AUTO_RENEWAL,
    consequence:
      "The agreement rolls into another full term unless notice is given inside the window.",
    confidence: "high",
  };
  const drafted =
    "This agreement ends at the end of the term unless both parties agree in writing to renew it.";

  const promoted = reTiered("auto-renewal", "Critical");

  for (const [kind, text] of [
    ["a lease", LEASE],
    ["terms of service", TERMS_OF_SERVICE],
  ] as const) {
    const out = await analyze({
      documentText: text,
      redLines: promoted,
      callModel: stubModel([flag], { "auto-renewal": drafted }),
    });

    assert.equal(out.flags.length, 1, `${kind} came back with the wrong count`);
    assert.equal(out.flags[0].clauseType, "auto-renewal");
    assert.equal(
      out.flags[0].severity,
      "Critical",
      `${kind} did not take the tier the reader set`,
    );
    assert.equal(out.flags[0].counterOffer, drafted);
    assert.ok(text.includes(out.flags[0].sourceSentence));
  }

  // And taking it off silences both, for the same reason: there is one list.
  const without = SEED_RED_LINES.filter((r) => r.clauseType !== "auto-renewal");

  for (const [kind, text] of [
    ["a lease", LEASE],
    ["terms of service", TERMS_OF_SERVICE],
  ] as const) {
    const out = await analyze({
      documentText: text,
      redLines: without,
      callModel: stubModel([flag]),
    });

    assert.deepEqual(out.flags, [], `${kind} still flagged a deleted red line`);
  }
});

/* ------------------------------------ a row that is not a red line drives nothing */

test("a malformed stored row is refused and never decides what a reader sees", async () => {
  const rows = [
    {
      id: "7f0a1b2c-0000-4000-8000-000000000001",
      clause_type: "arbitration",
      label: "Arbitration or class-action waiver",
      description: PLANTED.get("arbitration")?.consequence ?? "x",
      // The reader promoted this one, and that is the tier the flag must carry.
      severity: "Critical",
    },
    {
      id: "7f0a1b2c-0000-4000-8000-000000000002",
      clause_type: "non-compete",
      label: "Non-compete or exclusivity",
      description: "Restricts who I can work for.",
      // Not one of the three words. There is no tier to show this at, so the
      // row is refused rather than guessed at.
      severity: "Severe",
    },
  ];

  const { redLines, refused } = redLineEntriesFrom(rows);
  assert.equal(refused, 1);

  const drafted = "Disputes may be brought in the courts of either party's state.";

  const out = await analyze({
    documentText,
    redLines: redLines.map(plainRedLine),
    callModel: stubModel(plantedFlags(), { arbitration: drafted }),
  });

  // The good row drove a flag, at the tier it carries.
  assert.deepEqual(
    out.flags.map((f) => [f.clauseType, f.severity]),
    [["arbitration", "Critical"]],
  );
  assert.equal(out.flags[0].counterOffer, drafted);

  // The malformed row drove nothing. Its clause type was in the document and
  // the model found it, and it is still not on the statement.
  assert.ok(
    !out.flags.some((f) => f.clauseType === "non-compete"),
    "a row that is not a red line put a flag in front of the reader",
  );
  assert.ok(
    out.dropped.some(
      (d) => d.clauseType === "non-compete" && d.reason === "unknown-clause-type",
    ),
  );
});
