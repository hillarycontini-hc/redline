/**
 * What POST /api/analyze will accept, decided without touching the network or
 * the model so it can be tested on its own.
 *
 * The route takes JSON holding one string and nothing else. A request that
 * arrives as any other content type is refused with 415, which is how
 * "no route accepts a file body" is enforced rather than merely intended.
 */

/** The longest document Redline reads in one request. Roughly 100 pages. */
export const MAX_DOCUMENT_CHARS = 300_000;

export interface Refusal {
  status: number;
  message: string;
}

export type Checked = { ok: true; documentText: string } | ({ ok: false } & Refusal);

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
  const extra = fields.filter((f) => f !== "documentText");
  if (extra.length > 0) {
    return {
      ok: false,
      status: 400,
      message: `Redline takes the document's text and nothing else. Drop ${extra.join(", ")} from the request.`,
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

  return { ok: true, documentText };
}
