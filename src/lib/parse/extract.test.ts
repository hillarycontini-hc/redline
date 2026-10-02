/**
 * The parsing path, run with the real parsers against real files.
 *
 * Nothing here is mocked. `extractText` is handed a genuine `File`, PDF.js and
 * Mammoth do the work, and what is asserted is what the reader would see: the
 * words that came out, whether a sentence quoted from them can still be found
 * in them, and the refusal when a file carries no words at all.
 *
 * The fixtures come from `tests/fixtures/parse/make-parse-fixtures.mjs`, except
 * the student handbook at the repo root, which is a real PDF produced by a real
 * tool and has been in this repo since the first commit.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { locate } from "../analysis/citation.ts";
import { normalize } from "../analysis/normalize.ts";
import {
  FILE_PICKER_ACCEPT,
  MIN_USABLE_CHARS,
  checkUsable,
  extractText,
} from "./extract.ts";

const FIXTURES = join(process.cwd(), "tests", "fixtures", "parse");
const REPO = process.cwd();

interface ParseFixtures {
  textPdf: string;
  scannedPdf: string;
  docx: string;
  sentences: string[];
}

const FIXTURE = JSON.parse(
  readFileSync(join(FIXTURES, "parse-fixtures.json"), "utf8"),
) as ParseFixtures;

/** A real File, built from bytes on disk, the way the browser would hand one over. */
function fileFrom(path: string, name: string, type: string): File {
  return new File([readFileSync(path)], name, { type });
}

const PDF = "application/pdf";
const DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

async function extractOrFail(file: File): Promise<string> {
  const result = await extractText(file);
  assert.equal(
    result.ok,
    true,
    result.ok ? "" : `${file.name} was refused: ${result.message}`,
  );
  return result.ok ? result.text : "";
}

// ---------------------------------------------------------------------------
// Too little text to read
// ---------------------------------------------------------------------------

test("too little text is reported as unreadable, not analysed", () => {
  const r = checkUsable("   \n\n  a few words  ");
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "no-text");
});

test("enough text passes through unchanged", () => {
  const text = "x".repeat(MIN_USABLE_CHARS) + "\n";
  const r = checkUsable(text);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.text, text);
});

// ---------------------------------------------------------------------------
// PDF with a text layer
// ---------------------------------------------------------------------------

test("a PDF with a text layer produces the document's own words", async () => {
  const text = await extractOrFail(
    fileFrom(join(FIXTURES, FIXTURE.textPdf), FIXTURE.textPdf, PDF),
  );

  const missing = FIXTURE.sentences.filter(
    (sentence) => !normalize(text).text.includes(normalize(sentence).text),
  );
  assert.deepEqual(
    missing,
    [],
    `${missing.length} sentence(s) in the fixture did not survive the parse:\n  ${missing.join("\n  ")}`,
  );
});

test("a sentence quoted out of a parsed PDF can be found in it again", async () => {
  const text = await extractOrFail(
    fileFrom(join(FIXTURES, FIXTURE.textPdf), FIXTURE.textPdf, PDF),
  );

  for (const sentence of FIXTURE.sentences) {
    const at = locate(text, sentence);
    assert.ok(at, `locate() could not place ${JSON.stringify(sentence)}`);

    // What the reader would be shown: the document's own characters at that
    // range, which have to be the sentence and not a neighbour of it.
    const shown = text.slice(at.start, at.end);
    assert.equal(normalize(shown).text, normalize(sentence).text);
  }
});

test("a sentence taken out of a real PDF's extracted text is locatable in it", async () => {
  // The handbook, not a fixture this build wrote: a PDF made by an ordinary
  // tool, with the layout and the line breaks that come with one.
  const text = await extractOrFail(
    fileFrom(
      join(REPO, "session-2-student-handbook.pdf"),
      "session-2-student-handbook.pdf",
      PDF,
    ),
  );

  assert.ok(
    text.length > 10_000,
    `a seventeen-page PDF produced only ${text.length} characters`,
  );

  // Take a sentence out of the extracted text itself, the way the model does,
  // and put it back through the citation check. Round-tripping through the
  // parser must not break citation — that is the whole criterion.
  const sentences = text
    .split(/(?<=\.)\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 60 && s.length < 300);

  assert.ok(
    sentences.length >= 10,
    `only ${sentences.length} sentences came out of the handbook`,
  );

  const unplaceable = sentences.filter((sentence) => {
    const at = locate(text, sentence);
    return !at || normalize(text.slice(at.start, at.end)).text !== normalize(sentence).text;
  });

  assert.deepEqual(
    unplaceable,
    [],
    `${unplaceable.length} of ${sentences.length} sentences could not be placed back in the text they came from:\n  ${unplaceable.slice(0, 3).join("\n  ")}`,
  );
});

test("a PDF is read from its extension when the browser sends no type", async () => {
  const text = await extractOrFail(
    fileFrom(join(FIXTURES, FIXTURE.textPdf), FIXTURE.textPdf, ""),
  );
  assert.ok(normalize(text).text.includes(normalize(FIXTURE.sentences[0]).text));
});

// ---------------------------------------------------------------------------
// Word
// ---------------------------------------------------------------------------

test("a Word document produces the document's own words", async () => {
  const text = await extractOrFail(
    fileFrom(join(FIXTURES, FIXTURE.docx), FIXTURE.docx, DOCX),
  );

  const missing = FIXTURE.sentences.filter(
    (sentence) => !normalize(text).text.includes(normalize(sentence).text),
  );
  assert.deepEqual(missing, [], missing.join("\n  "));
});

test("a sentence quoted out of a parsed Word document can be found in it again", async () => {
  const text = await extractOrFail(
    fileFrom(join(FIXTURES, FIXTURE.docx), FIXTURE.docx, DOCX),
  );

  for (const sentence of FIXTURE.sentences) {
    const at = locate(text, sentence);
    assert.ok(at, `locate() could not place ${JSON.stringify(sentence)}`);
    assert.equal(
      normalize(text.slice(at.start, at.end)).text,
      normalize(sentence).text,
    );
  }
});

test("the PDF route and the Word route produce the same document", async () => {
  const fromPdf = await extractOrFail(
    fileFrom(join(FIXTURES, FIXTURE.textPdf), FIXTURE.textPdf, PDF),
  );
  const fromDocx = await extractOrFail(
    fileFrom(join(FIXTURES, FIXTURE.docx), FIXTURE.docx, DOCX),
  );

  // Same words in the same order, whichever file the reader happened to hold.
  assert.equal(normalize(fromPdf).text, normalize(fromDocx).text);
});

// ---------------------------------------------------------------------------
// The refusals
// ---------------------------------------------------------------------------

test("a PDF whose pages carry no text is refused, and the refusal says why", async () => {
  const result = await extractText(
    fileFrom(join(FIXTURES, FIXTURE.scannedPdf), FIXTURE.scannedPdf, PDF),
  );

  assert.equal(result.ok, false, "a PDF with no text layer was accepted");
  if (result.ok) return;

  assert.equal(result.reason, "no-text");

  // The reader is told that the pages are pictures and that Redline will not
  // guess at them, and is given something to do instead.
  const message = result.message.toLowerCase();
  assert.ok(
    message.includes("pictures"),
    `the refusal does not tell the reader what is wrong: ${result.message}`,
  );
  assert.ok(
    message.includes("guess"),
    `the refusal does not say why Redline stops: ${result.message}`,
  );
  assert.ok(
    message.includes("paste"),
    `the refusal leaves the reader with nothing to do: ${result.message}`,
  );
});

test("a scanned PDF and a file we do not read are told apart", async () => {
  const scanned = await extractText(
    fileFrom(join(FIXTURES, FIXTURE.scannedPdf), FIXTURE.scannedPdf, PDF),
  );
  const notOurs = await extractText(
    new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "contract.png", {
      type: "image/png",
    }),
  );

  assert.equal(scanned.ok, false);
  assert.equal(notOurs.ok, false);
  if (scanned.ok || notOurs.ok) return;

  assert.equal(scanned.reason, "no-text");
  assert.equal(notOurs.reason, "unsupported-type");
  assert.notEqual(
    scanned.message,
    notOurs.message,
    "two different situations were given the same message",
  );
});

test("a file that cannot be opened is refused as damaged, not as a scan", async () => {
  const result = await extractText(
    new File([new TextEncoder().encode("this is not a PDF")], "deal.pdf", {
      type: PDF,
    }),
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "unreadable-file");
});

test("the file picker offers exactly the kinds that can be read", () => {
  for (const offered of [".pdf", ".docx", ".txt", "application/pdf"]) {
    assert.ok(
      FILE_PICKER_ACCEPT.includes(offered),
      `the picker does not offer ${offered}`,
    );
  }
  assert.ok(
    !/image|jpeg|png|\.doc\b/.test(FILE_PICKER_ACCEPT),
    `the picker offers a kind Redline refuses: ${FILE_PICKER_ACCEPT}`,
  );
});
