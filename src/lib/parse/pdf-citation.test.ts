/**
 * A document that arrived as a PDF still cites.
 *
 * This is ticket 05's second criterion, and it is the one that could quietly
 * fail: a parser that reflowed paragraphs or tidied up punctuation would
 * produce text that reads fine on screen and in which no quoted sentence can
 * be placed. Every flag would then be dropped for want of a source sentence,
 * and the reader would see an empty statement rather than an error.
 *
 * So the PDF is parsed by the real parser, the model is stubbed with the
 * sentences the fixture plants, and what is asserted is what the reader would
 * see: the flags that came back, the tier each carries, and the sentence each
 * one quotes — found again in the text the parser produced.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyze, type CallModel } from "../analysis/analyze.ts";
import { locate } from "../analysis/citation.ts";
import { normalize } from "../analysis/normalize.ts";
import { SEED_RED_LINES } from "../analysis/red-lines.ts";
import type { ModelFlag, ModelResponse, Severity } from "../analysis/types.ts";
import { extractText } from "./extract.ts";

const FIXTURES = join(process.cwd(), "tests", "fixtures", "parse");

interface PlantedClause {
  clauseType: string;
  expectedSeverity: Severity;
  sourceSentence: string;
  consequence: string;
  counterOffer: string | null;
}

interface ParseFixtures {
  textPdf: string;
  plantedClauses: PlantedClause[];
}

const FIXTURE = JSON.parse(
  readFileSync(join(FIXTURES, "parse-fixtures.json"), "utf8"),
) as ParseFixtures;

/**
 * A model that quotes the sentences the fixture planted, verbatim as the
 * fixture records them. A stub of the model and of nothing else: the parser
 * and the citation check are the things under test here.
 */
const stubModel: CallModel = async () => {
  const payload: ModelResponse = {
    summary:
      "This agreement renews itself, pays late, takes the work before paying for it, can be ended in two days, and leaves the Contractor carrying every claim.",
    flags: FIXTURE.plantedClauses.map((clause): ModelFlag => {
      const flag: ModelFlag = {
        clauseType: clause.clauseType,
        sourceSentence: clause.sourceSentence,
        consequence: clause.consequence,
        confidence: "high",
      };
      if (clause.counterOffer !== null) flag.counterOffer = clause.counterOffer;
      return flag;
    }),
  };
  return JSON.stringify(payload);
};

async function pdfText(): Promise<string> {
  const bytes = readFileSync(join(FIXTURES, FIXTURE.textPdf));
  const result = await extractText(
    new File([bytes], FIXTURE.textPdf, { type: "application/pdf" }),
  );
  assert.equal(
    result.ok,
    true,
    result.ok ? "" : `the fixture PDF was refused: ${result.message}`,
  );
  return result.ok ? result.text : "";
}

test("flags on a PDF-parsed document survive with their source sentences", async () => {
  const documentText = await pdfText();

  const analysis = await analyze({
    documentText,
    redLines: SEED_RED_LINES,
    callModel: stubModel,
  });

  assert.deepEqual(
    analysis.dropped,
    [],
    "a flag was dropped for want of a source sentence after the PDF was parsed",
  );
  assert.equal(analysis.flags.length, FIXTURE.plantedClauses.length);
});

test("every sentence a PDF flag quotes can be found in the extracted text", async () => {
  const documentText = await pdfText();

  const analysis = await analyze({
    documentText,
    redLines: SEED_RED_LINES,
    callModel: stubModel,
  });

  const unplaceable = analysis.flags
    .filter((flag) => locate(documentText, flag.sourceSentence) === null)
    .map((flag) => `[${flag.clauseType}] ${JSON.stringify(flag.sourceSentence)}`);

  assert.deepEqual(
    unplaceable,
    [],
    `${unplaceable.length} flag(s) quote a sentence that is not in the parsed PDF:\n  ${unplaceable.join("\n  ")}`,
  );

  // And the range each flag carries is the sentence it claims, so the document
  // column marks the right words rather than words nearby.
  for (const flag of analysis.flags) {
    const marked = documentText.slice(flag.location.start, flag.location.end);
    assert.equal(normalize(marked).text, normalize(flag.sourceSentence).text);
  }
});

test("a PDF flag quotes the PDF's own characters, not the model's copy of them", async () => {
  const documentText = await pdfText();

  const analysis = await analyze({
    documentText,
    redLines: SEED_RED_LINES,
    callModel: stubModel,
  });

  const planted = new Map(
    FIXTURE.plantedClauses.map((c) => [c.clauseType, c.sourceSentence]),
  );

  // The PDF lays this sentence out over two lines, so the document's own
  // characters carry a line break the model's copy does not have. The flag has
  // to carry the document's version: it is what the reader is shown and what
  // the marked range points at.
  const wrapped = analysis.flags.filter((f) => /\s\n|\n/.test(f.sourceSentence));
  assert.ok(
    wrapped.length > 0,
    "no flag quoted a sentence the PDF had broken across lines, so this test proves nothing",
  );

  for (const flag of analysis.flags) {
    assert.ok(
      documentText.includes(flag.sourceSentence),
      `[${flag.clauseType}] does not quote the document verbatim`,
    );
    assert.equal(
      normalize(flag.sourceSentence).text,
      normalize(planted.get(flag.clauseType) ?? "").text,
      `[${flag.clauseType}] quotes a different sentence from the one planted`,
    );
  }
});

test("flags on a PDF carry the tier their clause type earns", async () => {
  const documentText = await pdfText();

  const analysis = await analyze({
    documentText,
    redLines: SEED_RED_LINES,
    callModel: stubModel,
  });

  const expected = new Map(
    FIXTURE.plantedClauses.map((c) => [c.clauseType, c.expectedSeverity]),
  );
  const wrong = analysis.flags
    .filter((flag) => expected.get(flag.clauseType) !== flag.severity)
    .map(
      (flag) =>
        `[${flag.clauseType}] shown as ${flag.severity}, the fixture expects ${expected.get(flag.clauseType)}`,
    );

  assert.deepEqual(wrong, [], wrong.join("\n  "));
});
