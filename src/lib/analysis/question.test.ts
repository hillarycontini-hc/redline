/**
 * The question box, run against the gold fixture with a stub model.
 *
 * Every quote the stub hands back is built from the sidecar on disk, so no
 * sentence is typed into this file and the checks track the fixture rather than
 * a snapshot of it. The stub is a stub of the model; the module under test is
 * never mocked.
 *
 * What is asserted is what the reader would see: the answer they are given,
 * the sentences quoted under it, and whether those sentences are really in
 * their document.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { locate } from "./citation.ts";
import { DOCUMENT_DOES_NOT_ADDRESS, ask } from "./question.ts";
import type { CallModel, ChatMessage } from "./types.ts";

const FIXTURES = join(process.cwd(), "tests", "fixtures");

interface PlantedClause {
  clauseType: string;
  sourceSentence: string;
}

interface Sidecar {
  filename: string;
  plantedClauses: PlantedClause[];
}

const sidecar = JSON.parse(
  readFileSync(join(FIXTURES, "adhesion-contract.json"), "utf8"),
) as Sidecar;
const documentText = readFileSync(join(FIXTURES, sidecar.filename), "utf8");

/** A sentence that really is in the fixture, taken from its sidecar. */
function planted(clauseType: string): string {
  const clause = sidecar.plantedClauses.find(
    (c) => c.clauseType === clauseType,
  );
  if (!clause) throw new Error(`the fixture plants no ${clauseType} clause`);
  return clause.sourceSentence;
}

const TERMINATION = planted("unilateral-termination");
const GUARANTEE = planted("personal-guarantee");

/** A quote that reads like the document but is not in it. */
const INVENTED =
  "The Client may terminate this Agreement at any time and will pay the Contractor in full for every hour already worked.";

function payload(
  answer: string,
  citations: unknown[],
  addressed = true,
): string {
  return JSON.stringify({ addressed, answer, citations });
}

function stub(raw: string): CallModel {
  return async () => raw;
}

/** The question the demo in the ticket asks. */
const CAN_THEY_END_IT =
  "Can the Client end the agreement without paying for work already started?";

async function askWith(raw: string, question = CAN_THEY_END_IT) {
  return ask({ documentText, question, callModel: stub(raw) });
}

/** Every citation is the document's own characters, at its own position. */
function assertVerbatim(citations: readonly { sourceSentence: string; location: { start: number; end: number } }[]) {
  for (const citation of citations) {
    assert.ok(
      locate(documentText, citation.sourceSentence),
      `a quoted sentence cannot be placed in the document: ${JSON.stringify(citation.sourceSentence)}`,
    );
    assert.ok(
      documentText.includes(citation.sourceSentence),
      `a quoted sentence is not verbatim in the document: ${JSON.stringify(citation.sourceSentence)}`,
    );
    assert.equal(
      documentText.slice(citation.location.start, citation.location.end),
      citation.sourceSentence,
      "the sentence shown is not the one at the position given",
    );
  }
}

test("a question the document answers comes back with the sentence it rests on", async () => {
  const out = await askWith(
    payload(
      "The Client can end the agreement at any time on notice, and the document says the Client owes nothing for work that was scheduled or started but not accepted.",
      [TERMINATION],
    ),
  );

  assert.notEqual(
    out.answer,
    DOCUMENT_DOES_NOT_ADDRESS,
    "an answer the document supports was replaced by the fixed response",
  );
  assert.equal(out.citations.length, 1);
  assert.equal(out.citations[0].sourceSentence, TERMINATION);
  assertVerbatim(out.citations);
  assert.deepEqual(out.dropped, []);
});

test("the sentences quoted arrive in the order they appear in the document", async () => {
  const out = await askWith(
    payload("What the document says about ending it and who carries it.", [
      GUARANTEE,
      TERMINATION,
    ]),
    "Who is on the hook if the agreement ends badly?",
  );

  assert.deepEqual(
    out.citations.map((c) => c.sourceSentence),
    [TERMINATION, GUARANTEE],
  );
  assertVerbatim(out.citations);
});

test("a sentence quoted with different spacing or quote marks is still placed, and is shown as the document has it", async () => {
  // The same sentence the fixture plants, rewrapped and with a curly
  // apostrophe — the shapes a real model hands back.
  const rewrapped = planted("slow-payment-no-late-fee")
    .replace(/ /g, "\n   ")
    .replace(/'/g, "’");

  const out = await askWith(
    payload("The document sets ninety days and no late fee.", [rewrapped]),
    "How long does the Client have to pay an invoice?",
  );

  assert.equal(out.citations.length, 1);
  assert.equal(
    out.citations[0].sourceSentence,
    planted("slow-payment-no-late-fee"),
    "the model's copy of the sentence was shown instead of the document's",
  );
  assertVerbatim(out.citations);
});

test("a quoted sentence that is not in the document is dropped and the real one survives", async () => {
  const out = await askWith(
    payload("What the document says about ending it.", [INVENTED, TERMINATION]),
  );

  assert.equal(out.citations.length, 1);
  assert.equal(out.citations[0].sourceSentence, TERMINATION);
  assert.ok(
    !out.citations.some((c) => c.sourceSentence === INVENTED),
    "a sentence that is not in the document reached the reader",
  );
  assertVerbatim(out.citations);

  assert.equal(out.dropped.length, 1);
  assert.equal(out.dropped[0].reason, "unlocatable-quote");
  assert.equal(out.dropped[0].quote, INVENTED);
});

test("an answer whose every quote is unplaceable becomes the fixed response, with nothing quoted", async () => {
  const out = await askWith(
    payload("The Client has to pay for work already started.", [
      INVENTED,
      "The Contractor keeps every right in the work until the Client pays for it in full.",
    ]),
  );

  assert.equal(out.answer, DOCUMENT_DOES_NOT_ADDRESS);
  assert.deepEqual(out.citations, []);
  assert.equal(out.dropped.length, 2);
});

test("an answer with nothing quoted at all becomes the fixed response", async () => {
  const out = await askWith(
    payload("The Client has to pay for work already started.", []),
  );

  assert.equal(out.answer, DOCUMENT_DOES_NOT_ADDRESS);
  assert.deepEqual(out.citations, []);
});

test("a question the document does not address returns the fixed response, with nothing quoted", async () => {
  // The fixture says nothing about health insurance, and that absence is
  // deliberate. A model with nothing to quote says so.
  const out = await askWith(
    payload("", [], false),
    "Does the Client pay for my health insurance?",
  );

  assert.equal(out.answer, DOCUMENT_DOES_NOT_ADDRESS);
  assert.deepEqual(out.citations, []);
});

test("a model that answers anyway on something the document does not address is still refused", async () => {
  const out = await askWith(
    payload(
      "Contractors usually arrange their own cover, and nothing here changes that.",
      [],
    ),
    "Does the Client pay for my pension contributions?",
  );

  assert.equal(
    out.answer,
    DOCUMENT_DOES_NOT_ADDRESS,
    "an answer the document does not support was passed on in the model's own words",
  );
  assert.deepEqual(out.citations, []);
});

test("a model that says the document is silent is taken at its word, whatever it quoted", async () => {
  const out = await askWith(
    payload("", [TERMINATION], false),
    "Does the Client cover relocation expenses?",
  );

  assert.equal(out.answer, DOCUMENT_DOES_NOT_ADDRESS);
  assert.deepEqual(out.citations, []);
});

test("asking a second question sends nothing from the first", async () => {
  const sent: ChatMessage[][] = [];
  const answers = [
    payload("The Client can end it at any time on notice.", [TERMINATION]),
    payload("The individual who signs guarantees the obligations.", [
      GUARANTEE,
    ]),
  ];

  const recording: CallModel = async (messages) => {
    sent.push(messages);
    return answers[sent.length - 1];
  };

  const first = await ask({
    documentText,
    question: CAN_THEY_END_IT,
    callModel: recording,
  });
  const second = await ask({
    documentText,
    question: "If my company closes, am I still on the hook personally?",
    callModel: recording,
  });

  assert.equal(sent.length, 2);
  assert.equal(
    sent[1].length,
    sent[0].length,
    "the second question was sent with more messages than the first",
  );

  const secondCall = JSON.stringify(sent[1]);
  assert.ok(
    !secondCall.includes(CAN_THEY_END_IT),
    "the first question was sent again with the second",
  );
  assert.ok(
    !secondCall.includes(first.answer),
    "the first answer was sent with the second question",
  );
  // And the second answer stands on its own sentence, not the first's.
  assert.equal(second.citations.length, 1);
  assert.equal(second.citations[0].sourceSentence, GUARANTEE);
  assertVerbatim(second.citations);
});

test("a reply that is not the shape asked for is an error, not a guess", async () => {
  await assert.rejects(
    () => askWith("The document does not address this."),
    /did not match the expected shape|not valid JSON/,
  );

  await assert.rejects(
    () => askWith(JSON.stringify({ answer: "Yes." })),
    /did not match the expected shape/,
  );
});
