/**
 * What POST /api/analyze accepts, and what it refuses.
 *
 * The refusal that matters most is the first one: a request that is not JSON is
 * turned away with 415, which is how "no route accepts a file body" is enforced
 * rather than merely intended. The rest keep the route from handing the model
 * something that is not a document.
 *
 * Assertions are on the status and the refusal the caller gets back, not on how
 * the check is written.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_DOCUMENT_CHARS,
  MAX_FILENAME_CHARS,
  PASTED_DOCUMENT,
  checkRequest,
} from "./validate.ts";

const JSON_TYPE = "application/json";
const DOC = "The Client may terminate this Agreement at any time.";

function refusal(contentType: string | null, body: unknown) {
  const checked = checkRequest(contentType, body);
  assert.equal(checked.ok, false, "expected the request to be refused");
  if (checked.ok) throw new Error("unreachable");
  return checked;
}

test("a multipart file body is refused with 415", () => {
  const r = refusal("multipart/form-data; boundary=----abc", {
    documentText: DOC,
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
    "application/json-patch+json",
  ]) {
    assert.equal(
      refusal(type, { documentText: DOC }).status,
      415,
      `content type ${JSON.stringify(type)} was not refused with 415`,
    );
  }
});

test("application/json is accepted with or without a charset", () => {
  for (const type of [
    JSON_TYPE,
    "application/json; charset=utf-8",
    "Application/JSON",
    " application/json ",
  ]) {
    const checked = checkRequest(type, { documentText: DOC });
    assert.equal(checked.ok, true, `content type ${type} was refused`);
  }
});

test("a valid body passes and carries the document text through unchanged", () => {
  const checked = checkRequest(JSON_TYPE, { documentText: DOC });
  assert.equal(checked.ok, true);
  if (!checked.ok) throw new Error("unreachable");
  assert.equal(checked.documentText, DOC);
});

test("the document's name comes through, so a kept reading can be found under it", () => {
  const checked = checkRequest(JSON_TYPE, {
    documentText: DOC,
    filename: "Acme — services agreement v3.pdf",
  });
  assert.equal(checked.ok, true);
  if (!checked.ok) throw new Error("unreachable");
  assert.equal(checked.filename, "Acme — services agreement v3.pdf");
});

test("a document with no name of its own is called pasted text", () => {
  for (const value of [undefined, null, "", "   ", "\n\t"]) {
    const checked = checkRequest(JSON_TYPE, {
      documentText: DOC,
      filename: value,
    });
    assert.equal(checked.ok, true, `${JSON.stringify(value)} was refused`);
    if (!checked.ok) throw new Error("unreachable");
    assert.equal(checked.filename, PASTED_DOCUMENT);
  }

  const absent = checkRequest(JSON_TYPE, { documentText: DOC });
  assert.equal(absent.ok, true);
  if (!absent.ok) throw new Error("unreachable");
  assert.equal(absent.filename, PASTED_DOCUMENT);
});

test("a name carrying line breaks or control characters arrives as one plain line", () => {
  const checked = checkRequest(JSON_TYPE, {
    documentText: DOC,
    filename: "  lease\u0000 \n  draft\t2.docx  ",
  });
  assert.equal(checked.ok, true);
  if (!checked.ok) throw new Error("unreachable");
  assert.equal(checked.filename, "lease draft 2.docx");
});

test("a name that is not text is refused with 400", () => {
  for (const value of [42, true, ["a.pdf"], { name: "a.pdf" }]) {
    const r = refusal(JSON_TYPE, { documentText: DOC, filename: value });
    assert.equal(r.status, 400, `${JSON.stringify(value)} was not refused`);
  }
});

test("a name past the stated limit is refused with 400, and the limit is in the message", () => {
  const r = refusal(JSON_TYPE, {
    documentText: DOC,
    filename: "x".repeat(MAX_FILENAME_CHARS + 1),
  });
  assert.equal(r.status, 400);
  assert.ok(
    r.message.includes(MAX_FILENAME_CHARS.toLocaleString("en-GB")),
    `the refusal does not state the limit: ${r.message}`,
  );
});

test("a missing documentText is refused with 400", () => {
  const r = refusal(JSON_TYPE, {});
  assert.equal(r.status, 400);
  assert.match(r.message, /no document text/i);
});

test("an empty or whitespace-only documentText is refused with 400", () => {
  for (const text of ["", "   ", "\n\n\t"]) {
    const r = refusal(JSON_TYPE, { documentText: text });
    assert.equal(r.status, 400, `${JSON.stringify(text)} was not refused`);
  }
});

test("a documentText that is not a string is refused with 400", () => {
  for (const value of [42, true, null, ["a"], { text: "a" }]) {
    const r = refusal(JSON_TYPE, { documentText: value });
    assert.equal(r.status, 400, `${JSON.stringify(value)} was not refused`);
  }
});

test("a documentText past the stated limit is refused with 400, and the limit is in the message", () => {
  const r = refusal(JSON_TYPE, {
    documentText: "x".repeat(MAX_DOCUMENT_CHARS + 1),
  });
  assert.equal(r.status, 400);
  assert.ok(
    r.message.includes(MAX_DOCUMENT_CHARS.toLocaleString("en-GB")),
    `the refusal does not state the limit: ${r.message}`,
  );
});

test("a documentText exactly at the limit is accepted", () => {
  const checked = checkRequest(JSON_TYPE, {
    documentText: "x".repeat(MAX_DOCUMENT_CHARS),
  });
  assert.equal(checked.ok, true);
});

test("a body that is not an object is refused with 400", () => {
  for (const body of [undefined, null, "a string", 7, ["documentText"]]) {
    const r = refusal(JSON_TYPE, body);
    assert.equal(r.status, 400, `${JSON.stringify(body)} was not refused`);
  }
});

test("a body carrying anything besides the document's text and name is refused with 400", () => {
  // The route takes two fields. Everything else is turned away by name,
  // including an owner id — who the reading belongs to is settled by the session
  // on the server and is never something a request gets to say.
  for (const field of ["ownerId", "redLines", "fileName", "file"]) {
    const r = refusal(JSON_TYPE, { documentText: DOC, [field]: "anything" });
    assert.equal(r.status, 400, `${field} was not refused`);
    assert.ok(
      r.message.includes(field),
      `the refusal does not name ${field}: ${r.message}`,
    );
  }
});
