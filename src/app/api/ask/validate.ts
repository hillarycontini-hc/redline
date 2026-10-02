import {
  MALFORMED_JSON,
  MAX_DOCUMENT_CHARS,
  isJsonRequest,
  type Refusal,
} from "../analyze/validate.ts";

/**
 * What POST /api/ask will accept, decided without touching the network or the
 * model so it can be tested on its own.
 *
 * The same rules the analysis route holds, and for the same reason: JSON
 * holding the document's text, plus the one question. A request arriving as any
 * other content type is refused with 415, which is how "no route accepts a
 * file body" stays true as routes are added rather than being true of one of
 * them.
 */

export { MALFORMED_JSON, MAX_DOCUMENT_CHARS, isJsonRequest };
export type { Refusal };

/** The longest question Redline takes. A question longer than this is a brief. */
export const MAX_QUESTION_CHARS = 500;

export type Checked =
  | { ok: true; documentText: string; question: string }
  | ({ ok: false } & Refusal);

const FIELDS = ["documentText", "question"];

export function checkRequest(
  contentType: string | null,
  body: unknown,
): Checked {
  if (!isJsonRequest(contentType)) {
    return {
      ok: false,
      status: 415,
      message:
        "This takes a document's text and a question, as JSON. A file body is refused: your browser reads the file and sends on the text.",
    };
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return {
      ok: false,
      status: 400,
      message:
        "Redline expects a JSON object with two fields: documentText, set to the agreement's text, and question, set to what you want to know.",
    };
  }

  const extra = Object.keys(body as Record<string, unknown>).filter(
    (f) => !FIELDS.includes(f),
  );
  if (extra.length > 0) {
    return {
      ok: false,
      status: 400,
      message: `Redline takes the document's text and one question, nothing else. Drop ${extra.join(", ")} from the request.`,
    };
  }

  const { documentText, question } = body as {
    documentText?: unknown;
    question?: unknown;
  };

  if (typeof documentText !== "string" || documentText.trim().length === 0) {
    return {
      ok: false,
      status: 400,
      message:
        "There is no document to ask about. Put the agreement in first, then ask.",
    };
  }

  if (documentText.length > MAX_DOCUMENT_CHARS) {
    return {
      ok: false,
      status: 400,
      message: `That document runs to ${documentText.length.toLocaleString("en-GB")} characters, past the ${MAX_DOCUMENT_CHARS.toLocaleString("en-GB")} Redline reads at a time. Send the part you need.`,
    };
  }

  if (typeof question !== "string" || question.trim().length === 0) {
    return {
      ok: false,
      status: 400,
      message: "No question arrived. Type what you want to know, then ask.",
    };
  }

  if (question.length > MAX_QUESTION_CHARS) {
    return {
      ok: false,
      status: 400,
      message: `That question runs to ${question.length.toLocaleString("en-GB")} characters, past the ${MAX_QUESTION_CHARS} Redline takes. Ask the shorter version.`,
    };
  }

  return { ok: true, documentText, question: question.trim() };
}
