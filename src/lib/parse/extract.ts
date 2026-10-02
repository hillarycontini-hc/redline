/**
 * Browser-side text extraction. This module runs in the client only. The file
 * never leaves the browser; only the string it returns does, and only after
 * the reader has seen it.
 *
 * Three kinds of file come in: plain text, PDF, and Word. One entry point
 * handles all three, because the screens above it should not have to know
 * which parser ran. The parsers live in `./pdf.ts` and `./docx.ts` and are
 * loaded only when a file of that kind actually arrives, so a reader who
 * pastes their agreement never downloads either.
 *
 * There is no character recognition here and no path that reaches for one. A
 * PDF whose pages carry no text is refused, not guessed at: a citation
 * into text that was recognised wrongly looks exactly like a citation into
 * text that was read correctly, and the reader cannot tell them apart. That is
 * ADR 0001, and it is the reason this file would rather return a refusal than
 * a parse it cannot stand behind.
 */

export type ExtractResult =
  | { ok: true; text: string }
  | {
      ok: false;
      reason: "no-text" | "unsupported-type" | "unreadable-file";
      message: string;
    };

const TEXT_TYPES = new Set(["text/plain", "text/markdown"]);
const TEXT_EXTENSIONS = [".txt", ".md", ".text"];

const PDF_TYPE = "application/pdf";
const DOCX_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Below this many non-whitespace characters we assume a scan or an empty file. */
export const MIN_USABLE_CHARS = 200;

/**
 * What a file picker should offer, kept here beside the detection it has to
 * agree with. A picker that offers a kind this module refuses, or hides a kind
 * it reads, is the same defect seen from two directions.
 */
export const FILE_PICKER_ACCEPT = [
  ".pdf",
  ".docx",
  ...TEXT_EXTENSIONS,
  PDF_TYPE,
  DOCX_TYPE,
  ...TEXT_TYPES,
].join(",");

/**
 * Where the text came from. It changes only what the reader is told when there
 * is too little of it: a PDF with no text layer has one explanation and one
 * thing to do about it, and a reader looking at that message deserves the one
 * that fits their file.
 */
export type Source = "file" | "pdf";

const NOT_A_FILE_WE_READ =
  "Redline reads PDFs, Word documents and plain text. This file is none of " +
  "those. If it is a photograph of a document, Redline cannot read it: it " +
  "will not quote words it might have got wrong.";

const NOTHING_TO_READ =
  "Redline could not find enough readable text in this file. If it is a " +
  "photograph of a document, Redline cannot read it, because a sentence it " +
  "misread is worse than no sentence at all.";

const NOTHING_TO_READ_IN_PDF =
  "This PDF holds pictures of its pages rather than the words themselves, " +
  "which is what a scanner produces. Redline will not guess at what the " +
  "pictures say, because you could not check a quoted sentence against your " +
  "own copy. If you can get hold of the file it was typed in, use that. " +
  "Otherwise paste the words in.";

const COULD_NOT_OPEN =
  "Redline could not open this file. It may be damaged, or locked with a " +
  "password. If it opens on your own machine, save a fresh copy from there " +
  "and try again, or paste the words in instead.";

type Kind = "text" | "pdf" | "docx" | "other";

function kindOf(file: File): Kind {
  const name = file.name.toLowerCase();

  if (TEXT_TYPES.has(file.type) || TEXT_EXTENSIONS.some((e) => name.endsWith(e)))
    return "text";
  if (file.type === PDF_TYPE || name.endsWith(".pdf")) return "pdf";
  if (file.type === DOCX_TYPE || name.endsWith(".docx")) return "docx";

  return "other";
}

/**
 * Read a file the reader chose. The whole of the work happens here, in their
 * browser; what comes back is either the document's text or the reason it
 * cannot be read.
 */
export async function extractText(file: File): Promise<ExtractResult> {
  const kind = kindOf(file);

  if (kind === "other") {
    return { ok: false, reason: "unsupported-type", message: NOT_A_FILE_WE_READ };
  }

  if (kind === "text") {
    return checkUsable(await file.text());
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  if (kind === "docx") {
    const { extractDocxText } = await import("./docx.ts");
    try {
      return checkUsable(await extractDocxText(bytes));
    } catch {
      return { ok: false, reason: "unreadable-file", message: COULD_NOT_OPEN };
    }
  }

  const { extractPdfText } = await import("./pdf.ts");
  try {
    const { text } = await extractPdfText(bytes);
    // A PDF that opened cleanly and carried no text is a scan. That is not a
    // failure to parse and it is not an unreadable file: it is a document
    // whose words are pictures, and the reader is told exactly that.
    return checkUsable(text, "pdf");
  } catch {
    return { ok: false, reason: "unreadable-file", message: COULD_NOT_OPEN };
  }
}

/**
 * The gate every route into the app passes through: pasted text, a text file,
 * a parsed PDF, a parsed Word document. Too little text and nothing is
 * analysed, because an analysis of a document we could not read is the one
 * output this product must never produce.
 */
export function checkUsable(text: string, source: Source = "file"): ExtractResult {
  const usable = text.replace(/\s/g, "").length;
  if (usable < MIN_USABLE_CHARS) {
    return {
      ok: false,
      reason: "no-text",
      message: source === "pdf" ? NOTHING_TO_READ_IN_PDF : NOTHING_TO_READ,
    };
  }
  return { ok: true, text };
}
