/**
 * What POST /api/ask accepts, and what it refuses. No model is involved.
 *
 * Two refusals carry weight beyond keeping bad input out. A request that is not
 * JSON is turned away with 415, which is how "no route accepts a file body"
 * stays true as routes are added. And a request carrying anything beyond the
 * document and the question is refused outright, which is how the answer stays
 * grounded in the document rather than in a summary or an earlier answer.
 *
 * Assertions are on the status and the refusal the caller gets back.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_DOCUMENT_CHARS, MAX_QUESTION_CHARS, checkRequest } from "./validate.ts";

const JSON_TYPE = "application/json";
const DOC = "The Client may terminate this Agreement at any time.";
const QUESTION = "Can the Client end this without paying me?";

function refusal(contentType: string | null, body: unknown) {
  const checked = checkRequest(contentType, body);
  assert.equal(checked.ok, false, "expected the request to be refused");
  if (checked.ok) throw new Error("unreachable");
  return checked;
}

test("a document and a question are accepted", () => {
  const checked = checkRequest(JSON_TYPE, {
    documentText: DOC,
    question: QUESTION,
  });
  assert.equal(checked.ok, true);
  if (!checked.ok) throw new Error("unreachable");
  assert.equal(checked.documentText, DOC);
  assert.equal(checked.question, QUESTION);
});

test("surrounding whitespace is taken off the question", () => {
  const checked = checkRequest(JSON_TYPE, {
    documentText: DOC,
    question: `  ${QUESTION}\n`,
  });
  assert.equal(checked.ok, true);
  if (!checked.ok) throw new Error("unreachable");
  assert.equal(checked.question, QUESTION);
});

test("a file body is refused with 415", () => {
  const r = refusal("multipart/form-data; boundary=----abc", {
    documentText: DOC,
    question: QUESTION,
  });
  assert.equal(r.status, 415);
  assert.match(r.message, /a file body is refused/i);
});

test("every content type other than JSON is refused with 415", () => {
  for (const type of [
    null,
    "",
    "text/plain",
    "application/pdf",
    "application/octet-stream",
    "application/x-www-form-urlencoded",
  ]) {
    assert.equal(
      refusal(type, { documentText: DOC, question: QUESTION }).status,
      415,
      `content type ${JSON.stringify(type)} was not refused with 415`,
    );
  }
});

test("application/json is accepted with or without a charset", () => {
  for (const type of [JSON_TYPE, "application/json; charset=utf-8", "Application/JSON"]) {
    const checked = checkRequest(type, { documentText: DOC, question: QUESTION });
    assert.equal(checked.ok, true, `content type ${type} was refused`);
  }
});

test("a body that is not a JSON object is refused with 400", () => {
  for (const body of [null, undefined, "a string", 7, [{ question: QUESTION }]]) {
    assert.equal(refusal(JSON_TYPE, body).status, 400);
  }
});

test("a missing question is refused, and the refusal says what to do", () => {
  for (const body of [
    { documentText: DOC },
    { documentText: DOC, question: null },
    { documentText: DOC, question: 42 },
  ]) {
    const r = refusal(JSON_TYPE, body);
    assert.equal(r.status, 400);
    assert.match(r.message, /no question arrived/i);
  }
});

test("an empty question is refused", () => {
  for (const question of ["", "   ", "\n\t"]) {
    const r = refusal(JSON_TYPE, { documentText: DOC, question });
    assert.equal(r.status, 400);
    assert.match(r.message, /no question arrived/i);
  }
});

test("a question past the limit is refused, and the refusal says the limit", () => {
  const r = refusal(JSON_TYPE, {
    documentText: DOC,
    question: "a".repeat(MAX_QUESTION_CHARS + 1),
  });
  assert.equal(r.status, 400);
  assert.match(r.message, new RegExp(String(MAX_QUESTION_CHARS)));
});

test("a question right on the limit is accepted", () => {
  const checked = checkRequest(JSON_TYPE, {
    documentText: DOC,
    question: "a".repeat(MAX_QUESTION_CHARS),
  });
  assert.equal(checked.ok, true);
});

test("a missing or empty document is refused", () => {
  for (const body of [
    { question: QUESTION },
    { documentText: "", question: QUESTION },
    { documentText: "   \n", question: QUESTION },
    { documentText: 12, question: QUESTION },
  ]) {
    const r = refusal(JSON_TYPE, body);
    assert.equal(r.status, 400);
    assert.match(r.message, /no document to ask about/i);
  }
});

test("a document past the limit is refused, and the refusal says the limit", () => {
  const r = refusal(JSON_TYPE, {
    documentText: "a".repeat(MAX_DOCUMENT_CHARS + 1),
    question: QUESTION,
  });
  assert.equal(r.status, 400);
  assert.match(r.message, /300,000/);
});

test("anything beyond the document and the question is refused by name", () => {
  const r = refusal(JSON_TYPE, {
    documentText: DOC,
    question: QUESTION,
    summary: "What this document commits you to.",
    history: [{ question: "an earlier one", answer: "an earlier answer" }],
  });
  assert.equal(r.status, 400);
  assert.match(r.message, /summary/);
  assert.match(r.message, /history/);
});
