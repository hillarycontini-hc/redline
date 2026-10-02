/**
 * What POST /api/analyze will accept, decided without touching the network or
 * the model so it can be tested on its own.
 *
 * The route takes JSON holding the document's text, and the document's name
 * alongside it so a reading that is kept can be found again by the name the
 * reader knows it by. Two strings, and nothing else. A request that arrives as
 * any other content type is refused with 415, which is how "no route accepts a
 * file body" is enforced rather than merely intended — a name is not a file,
 * and no file ever reaches this route.
 */

/** The longest document Redline reads in one request. Roughly 100 pages. */
export const MAX_DOCUMENT_CHARS = 300_000;

/** Longer than any real filename, short enough to sit in a library row. */
export const MAX_FILENAME_CHARS = 300;

/** What a document is called when it was pasted rather than chosen. */
export const PASTED_DOCUMENT = "Pasted text";

const ACCEPTED_FIELDS = ["documentText", "filename"];

export interface Refusal {
  status: number;
  message: string;
}

export type Checked =
  | { ok: true; documentText: string; filename: string }
  | ({ ok: false } & Refusal);

/** True when the content type is the one JSON shape this route accepts. */
export function isJsonRequest(contentType: string | null): boolean {
  if (!contentType) return false;
  return contentType.split(";")[0].trim().toLowerCase() === "application/json";
}

/** The body arrived but was not JSON at all. Returned by the route itself. */
export const MALFORMED_JSON: Refusal = {
  status: 400,
  message:
    "Redline could not read that request. The body has to be JSON.",
};

export function checkRequest(
  contentType: string | null,
  body: unknown,
): Checked {
  if (!isJsonRequest(contentType)) {
    return {
      ok: false,
      status: 415,
      message:
        "This takes a document's text, as JSON. A file body is refused: your browser reads the file and sends on the text.",
    };
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return {
      ok: false,
      status: 400,
      message:
        "Redline expects a JSON object with one field, documentText, set to the agreement's text.",
    };
  }

  const fields = Object.keys(body as Record<string, unknown>);
  const extra = fields.filter((f) => !ACCEPTED_FIELDS.includes(f));
  if (extra.length > 0) {
    return {
      ok: false,
      status: 400,
      message: `Redline takes the document's text and its name, and nothing else. Drop ${extra.join(", ")} from the request.`,
    };
  }

  const { documentText } = body as { documentText?: unknown };

  if (typeof documentText !== "string") {
    return {
      ok: false,
      status: 400,
      message:
        "No document text arrived. Paste the agreement or choose a file, then try again.",
    };
  }

  if (documentText.trim().length === 0) {
    return {
      ok: false,
      status: 400,
      message:
        "The document text came through empty. Paste the agreement or choose a file, then try again.",
    };
  }

  if (documentText.length > MAX_DOCUMENT_CHARS) {
    return {
      ok: false,
      status: 400,
      message: `That document runs to ${documentText.length.toLocaleString("en-GB")} characters, past the ${MAX_DOCUMENT_CHARS.toLocaleString("en-GB")} Redline reads at a time. Send the part you need.`,
    };
  }

  const name = checkFilename((body as { filename?: unknown }).filename);
  if (!name.ok) return name;

  return { ok: true, documentText, filename: name.filename };
}

/**
 * The document's name. Absent is fine and common — a pasted agreement has no
 * filename — and then it takes the words that stand in for one.
 *
 * Control characters are taken out rather than refused. The name arrives from a
 * file the reader chose, so a stray one is the filesystem's doing and not
 * theirs, and it has no business reaching a library row or a page title.
 */
function checkFilename(
  value: unknown,
): { ok: true; filename: string } | ({ ok: false } & Refusal) {
  if (value === undefined || value === null) {
    return { ok: true, filename: PASTED_DOCUMENT };
  }

  if (typeof value !== "string") {
    return {
      ok: false,
      status: 400,
      message:
        "The document's name has to be text. Leave it out and Redline will call it pasted text.",
    };
  }

  const cleaned = [...value]
    .map((ch) => {
      const code = ch.codePointAt(0) ?? 0x20;
      return code < 0x20 || code === 0x7f ? " " : ch;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length === 0) return { ok: true, filename: PASTED_DOCUMENT };

  if (cleaned.length > MAX_FILENAME_CHARS) {
    return {
      ok: false,
      status: 400,
      message: `That document's name runs to ${cleaned.length.toLocaleString("en-GB")} characters, past the ${MAX_FILENAME_CHARS.toLocaleString("en-GB")} Redline keeps. Shorten it and try again.`,
    };
  }

  return { ok: true, filename: cleaned };
}
