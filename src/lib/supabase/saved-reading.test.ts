/**
 * A reading through the library and back.
 *
 * This is ADR 0001 surviving a round trip through the database, and it is the
 * whole reason a library is worth having. A real reading of the adhesion
 * fixture is built with a stub model, serialised the way it is stored, pushed
 * through JSON the way Postgres would hold it, and read back — and then every
 * flag is checked against the text that came back with it: the sentence it
 * quotes has to be the sentence its character range slices out of that text.
 *
 * Nothing here mocks the thing under test. The model is stubbed from the sidecar
 * on disk, so no sentence is typed into this file, and the storage shape is the
 * one the writer uses.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyze } from "../analysis/analyze.ts";
import type { CallModel } from "../analysis/analyze.ts";
import { normalize } from "../analysis/normalize.ts";
import { SEED_RED_LINES } from "../analysis/red-lines.ts";
import type {
  Analysis,
  ModelFlag,
  ModelResponse,
  RedLine,
  Severity,
} from "../analysis/types.ts";
import {
  asSavedReading,
  asStoredFlag,
  asStoredRedLine,
  looksLikeDocumentId,
  rowsForReading,
} from "./saved-reading.ts";

const FIXTURES = join(process.cwd(), "tests", "fixtures");

const DOCUMENT_ID = "0f6e2d10-0000-4000-8000-000000000001";
const READ_AT = "2026-09-30T18:12:04.221Z";
const FILENAME = "client-agreement.pdf";

interface PlantedClause {
  clauseType: string;
  expectedSeverity: Severity;
  sourceSentence: string;
  consequence: string;
  counterOffer: string | null;
}

interface Sidecar {
  filename: string;
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

/** A model that returns exactly what the sidecar plants. Never the module under test. */
function stubModel(sidecar: Sidecar): CallModel {
  const payload: ModelResponse = {
    summary: `What this document commits the signer to, on the points checked: ${sidecar.summaryMustMention.join("; ")}.`,
    flags: sidecar.plantedClauses.map((c) => {
      const flag: ModelFlag = {
        clauseType: c.clauseType,
        sourceSentence: c.sourceSentence,
        consequence: c.consequence,
        confidence: "high",
      };
      if (c.counterOffer !== null) flag.counterOffer = c.counterOffer;
      return flag;
    }),
  };

  return async () => JSON.stringify(payload);
}

const adhesion = readFixture("adhesion-contract.json");

/** The reader's own copy of the list, so a test can change it like a reader can. */
function liveRedLines(): RedLine[] {
  return SEED_RED_LINES.map((r) => ({ ...r }));
}

async function readTheAdhesionContract(): Promise<Analysis> {
  return analyze({
    documentText: adhesion.documentText,
    redLines: SEED_RED_LINES,
    callModel: stubModel(adhesion.sidecar),
  });
}

/**
 * The reading, written and read back.
 *
 * `rowsForReading` is the same function the writer uses. The JSON round trip is
 * what jsonb does to it, and the two generated columns are supplied the way
 * Postgres supplies them.
 */
function throughTheLibrary(
  analysis: Analysis,
  redLinesInForce: readonly RedLine[],
) {
  const rows = rowsForReading({
    filename: FILENAME,
    documentText: adhesion.documentText,
    summary: analysis.summary,
    flags: analysis.flags,
    redLinesInForce,
  });

  assert.ok(rows, "the reading would not go into the library at all");

  const stored = JSON.parse(JSON.stringify(rows)) as typeof rows;

  return asSavedReading(
    { id: DOCUMENT_ID, ...stored.document },
    { ...stored.analysis, created_at: READ_AT },
  );
}

test("a reading comes back out of the library whole", async () => {
  const analysis = await readTheAdhesionContract();
  const reopened = throughTheLibrary(analysis, liveRedLines());

  assert.ok(reopened, "the stored reading did not come back");
  assert.equal(reopened.documentId, DOCUMENT_ID);
  assert.equal(reopened.filename, FILENAME);
  assert.equal(reopened.readAt, READ_AT);

  // The summary and the tiers are what they were.
  assert.equal(reopened.summary, analysis.summary);
  assert.deepEqual(
    reopened.flags.map((f) => f.severity),
    analysis.flags.map((f) => f.severity),
  );
  assert.deepEqual(
    reopened.flags.map((f) => f.clauseType),
    analysis.flags.map((f) => f.clauseType),
  );
  assert.equal(reopened.flags.length, 8);

  // And the counter-offers came with them, on the tiers that owe one.
  assert.deepEqual(
    reopened.flags.map((f) => f.counterOffer ?? null),
    analysis.flags.map((f) => f.counterOffer ?? null),
  );
});

test("every flag out of the library still carries the sentence it came from", async () => {
  const analysis = await readTheAdhesionContract();
  const reopened = throughTheLibrary(analysis, liveRedLines());
  assert.ok(reopened);

  const unsourced = reopened.flags.filter(
    (f) => !reopened.documentText.includes(f.sourceSentence),
  );
  assert.deepEqual(
    unsourced.map((f) => f.clauseType),
    [],
    "a reopened flag quotes a sentence that is not in the stored text",
  );
});

test("every flag's range still slices the stored text to exactly its sentence", async () => {
  const analysis = await readTheAdhesionContract();
  const reopened = throughTheLibrary(analysis, liveRedLines());
  assert.ok(reopened);

  // This is what the highlight in the document column does. If the range moved,
  // the reader would see the wrong sentence lit up, which is worse than seeing
  // none at all.
  for (const flag of reopened.flags) {
    const sliced = reopened.documentText.slice(
      flag.location.start,
      flag.location.end,
    );
    assert.equal(
      normalize(sliced).text,
      normalize(flag.sourceSentence).text,
      `[${flag.clauseType}] the stored range slices ${JSON.stringify(sliced)}`,
    );
  }
});

test("the red lines the reading ran against come back with it", async () => {
  const analysis = await readTheAdhesionContract();
  const reopened = throughTheLibrary(analysis, liveRedLines());
  assert.ok(reopened);

  assert.deepEqual(reopened.redLinesInForce, liveRedLines());
});

test("editing the red lines afterwards leaves a kept reading exactly as it was", async () => {
  const analysis = await readTheAdhesionContract();

  // The list as it stood when the reading ran, held the way the reader holds it.
  const theList = liveRedLines();

  const rows = rowsForReading({
    filename: FILENAME,
    documentText: adhesion.documentText,
    summary: analysis.summary,
    flags: analysis.flags,
    redLinesInForce: theList,
  });
  assert.ok(rows);

  const stored = JSON.parse(JSON.stringify(rows)) as typeof rows;
  const documentRow = { id: DOCUMENT_ID, ...stored.document };
  const analysisRow = { ...stored.analysis, created_at: READ_AT };

  const before = asSavedReading(documentRow, analysisRow);
  assert.ok(before);

  // The reader changes their mind: arbitration is promoted to Critical, and
  // auto-renewal is deleted outright.
  const arbitration = theList.find((r) => r.clauseType === "arbitration");
  assert.ok(arbitration);
  arbitration.severity = "Critical";
  theList.splice(
    theList.findIndex((r) => r.clauseType === "auto-renewal"),
    1,
  );
  assert.equal(theList.length, 7, "the list under test did not actually change");

  const after = asSavedReading(documentRow, analysisRow);
  assert.ok(after);

  // The kept reading knows nothing about any of that.
  assert.deepEqual(after, before);
  assert.equal(after.redLinesInForce.length, 8);
  assert.equal(
    after.redLinesInForce.find((r) => r.clauseType === "arbitration")?.severity,
    "Worth knowing",
  );
  assert.ok(
    after.redLinesInForce.some((r) => r.clauseType === "auto-renewal"),
    "a red line the reader deleted went missing from a reading already kept",
  );
});

test("a reading with nothing flagged is a reading, not a fault", async () => {
  const clean = readFixture("clean-agreement.json");
  const analysis = await analyze({
    documentText: clean.documentText,
    redLines: SEED_RED_LINES,
    callModel: stubModel(clean.sidecar),
  });

  const rows = rowsForReading({
    filename: "fair-terms.txt",
    documentText: clean.documentText,
    summary: analysis.summary,
    flags: analysis.flags,
    redLinesInForce: liveRedLines(),
  });
  assert.ok(rows);

  const reopened = asSavedReading(
    { id: DOCUMENT_ID, ...rows.document },
    { ...rows.analysis, created_at: READ_AT },
  );

  assert.ok(reopened, "a quiet reading did not come back out of the library");
  assert.deepEqual(reopened.flags, []);
  assert.ok(reopened.summary.length > 0);
});

/* ------------------------------------------------------- validation on the way in */

test("a row that is not a reading is refused rather than rendered as one", async () => {
  const analysis = await readTheAdhesionContract();
  const rows = rowsForReading({
    filename: FILENAME,
    documentText: adhesion.documentText,
    summary: analysis.summary,
    flags: analysis.flags,
    redLinesInForce: liveRedLines(),
  });
  assert.ok(rows);

  const good = JSON.parse(JSON.stringify(rows)) as typeof rows;
  const documentRow = { id: DOCUMENT_ID, ...good.document };
  const analysisRow = { ...good.analysis, created_at: READ_AT };

  // A truncated text is the one that matters most: the ranges all still look
  // like numbers and every one of them now points somewhere else.
  const truncated = {
    ...documentRow,
    extracted_text: adhesion.documentText.slice(
      0,
      Math.floor(adhesion.documentText.length / 2),
    ),
  };

  const offByOne = {
    ...analysisRow,
    flags: analysisRow.flags.map((f, i) =>
      i === 0
        ? { ...f, location: { start: f.location.start + 1, end: f.location.end } }
        : f,
    ),
  };

  const refused: [string, unknown, unknown][] = [
    ["the text was cut short", truncated, analysisRow],
    ["a range is off by one character", documentRow, offByOne],
    ["there is no text at all", { ...documentRow, extracted_text: "" }, analysisRow],
    ["the document has no name", { ...documentRow, filename: "   " }, analysisRow],
    ["there is no id", { ...documentRow, id: null }, analysisRow],
    ["the summary is empty", documentRow, { ...analysisRow, summary: "" }],
    ["there is no date", documentRow, { ...analysisRow, created_at: null }],
    ["the flags are not a list", documentRow, { ...analysisRow, flags: {} }],
    [
      "a flag carries a tier that does not exist",
      documentRow,
      {
        ...analysisRow,
        flags: analysisRow.flags.map((f, i) =>
          i === 0 ? { ...f, severity: "High" } : f,
        ),
      },
    ],
    [
      "a flag lost its sentence",
      documentRow,
      {
        ...analysisRow,
        flags: analysisRow.flags.map((f, i) =>
          i === 0 ? { ...f, sourceSentence: "" } : f,
        ),
      },
    ],
    [
      "the red lines are not a list",
      documentRow,
      { ...analysisRow, red_lines_in_force: "eight of them" },
    ],
    [
      "a red line carries a tier that does not exist",
      documentRow,
      {
        ...analysisRow,
        red_lines_in_force: analysisRow.red_lines_in_force.map((r, i) =>
          i === 0 ? { ...r, severity: "Critical-ish" } : r,
        ),
      },
    ],
    ["there is no document row", null, analysisRow],
    ["there is no analysis row", documentRow, null],
  ];

  for (const [what, document, stored] of refused) {
    assert.equal(
      asSavedReading(document, stored),
      null,
      `a reading was shown when ${what}`,
    );
  }

  // And the unaltered pair still reads, so the refusals above are the fault of
  // what was changed and not of the check itself.
  assert.ok(asSavedReading(documentRow, analysisRow));
});

test("a reading that would not hold is never written in the first place", async () => {
  const analysis = await readTheAdhesionContract();

  const moved = analysis.flags.map((f, i) =>
    i === 2 ? { ...f, location: { start: f.location.start, end: f.location.end - 3 } } : f,
  );

  assert.equal(
    rowsForReading({
      filename: FILENAME,
      documentText: adhesion.documentText,
      summary: analysis.summary,
      flags: moved,
      redLinesInForce: liveRedLines(),
    }),
    null,
    "a flag whose range does not fit its sentence was accepted for storage",
  );

  assert.equal(
    rowsForReading({
      filename: "   ",
      documentText: adhesion.documentText,
      summary: analysis.summary,
      flags: analysis.flags,
      redLinesInForce: liveRedLines(),
    }),
    null,
    "a document with no name was accepted for storage",
  );

  assert.equal(
    rowsForReading({
      filename: FILENAME,
      documentText: adhesion.documentText,
      summary: "  ",
      flags: analysis.flags,
      redLinesInForce: liveRedLines(),
    }),
    null,
    "a reading with no summary was accepted for storage",
  );
});

test("a flag is checked against the text it claims to come from", () => {
  const documentText =
    "The Contractor shall indemnify the Client without limit. Payment falls due on acceptance.";
  const sentence = "The Contractor shall indemnify the Client without limit.";
  const start = documentText.indexOf(sentence);

  const flag = {
    clauseType: "uncapped-indemnity",
    severity: "Critical",
    sourceSentence: sentence,
    location: { start, end: start + sentence.length },
    consequence: "Exposure is unbounded.",
    counterOffer: "Cap it at fees paid.",
  };

  assert.deepEqual(asStoredFlag(flag, documentText), {
    clauseType: "uncapped-indemnity",
    severity: "Critical",
    sourceSentence: sentence,
    location: { start, end: start + sentence.length },
    consequence: "Exposure is unbounded.",
    counterOffer: "Cap it at fees paid.",
  });

  // The same flag pointed at the other sentence is not the same flag.
  const elsewhere = documentText.indexOf("Payment falls due");
  assert.equal(
    asStoredFlag(
      { ...flag, location: { start: elsewhere, end: documentText.length } },
      documentText,
    ),
    null,
  );

  for (const bad of [
    { ...flag, location: { start: -1, end: 10 } },
    { ...flag, location: { start: 0, end: 0 } },
    { ...flag, location: { start: 5, end: 2 } },
    { ...flag, location: { start, end: documentText.length + 50 } },
    { ...flag, location: { start: 1.5, end: 20 } },
    { ...flag, location: { start: "0", end: "10" } },
    { ...flag, location: null },
    { ...flag, counterOffer: "   " },
    { ...flag, consequence: undefined },
    { ...flag, clauseType: "" },
    null,
    "a flag",
    [],
  ]) {
    assert.equal(
      asStoredFlag(bad, documentText),
      null,
      `${JSON.stringify(bad)} is not a flag that can be shown`,
    );
  }

  // Absent replacement wording is the right state on a Worth-knowing flag.
  const worthKnowing = asStoredFlag(
    { ...flag, severity: "Worth knowing", counterOffer: undefined },
    documentText,
  );
  assert.ok(worthKnowing);
  assert.equal(worthKnowing.counterOffer, undefined);
});

test("a red line is kept only if it carries everything the reading needs", () => {
  const redLine = SEED_RED_LINES[0];
  assert.deepEqual(asStoredRedLine({ ...redLine }), { ...redLine });

  for (const bad of [
    { ...redLine, clauseType: "" },
    { ...redLine, label: "  " },
    { ...redLine, description: null },
    { ...redLine, severity: "critical" },
    { ...redLine, severity: 1 },
    null,
    [],
    "personal-guarantee",
  ]) {
    assert.equal(
      asStoredRedLine(bad),
      null,
      `${JSON.stringify(bad)} is not a red line a reading can report`,
    );
  }
});

test("only a real document id ever reaches a query", () => {
  assert.ok(looksLikeDocumentId(DOCUMENT_ID));
  assert.ok(looksLikeDocumentId(DOCUMENT_ID.toUpperCase()));

  for (const bad of [
    "",
    "   ",
    "../../etc/passwd",
    "0f6e2d10-0000-4000-8000",
    `${DOCUMENT_ID} or 1=1`,
    `${DOCUMENT_ID}\n`,
    "0f6e2d10-0000-4000-8000-00000000000g",
    undefined,
    null,
    42,
  ]) {
    assert.equal(
      looksLikeDocumentId(bad),
      false,
      `${JSON.stringify(bad)} was taken for a document id`,
    );
  }
});
