import { locate } from "./citation.ts";
import { parseJsonObject } from "./json.ts";
import { QUESTION_SYSTEM_PROMPT, buildQuestionPrompt } from "./prompt.ts";
import type {
  CallModel,
  Citation,
  DroppedCitation,
  ModelAnswer,
  QuestionAnswer,
} from "./types.ts";

/**
 * The question box. The second seam, the same shape as the first:
 * (documentText, question) in, (answer, citations) out, with the locatability
 * rule enforced inside.
 *
 * Two properties this module holds, and the reason it is written this way:
 *
 * - **It answers from the document's own text and nothing else.** The summary,
 *   the flags and any earlier answer are all model output, so a citation into
 *   one of them would prove nothing about the document and the chain of
 *   evidence would close on itself. ADR 0001 says question-box answers inherit
 *   the citation rule; BUILD-REPORT D2 settles that the text is the only
 *   source. Nothing but the document and the question is sent.
 *
 * - **No conversation state.** One question, one model call, built from the
 *   system prompt and that question alone. There is no history parameter to
 *   pass and nothing is held between calls, so a wrong turn in one question
 *   cannot reach the next.
 */

/**
 * The one answer the question box gives when it cannot ground an answer in the
 * document. Exported so the screen, the route and the tests all say the same
 * thing, and so the string cannot drift between them.
 */
export const DOCUMENT_DOES_NOT_ADDRESS =
  "This document does not say. Redline answers from its words alone, so there is nothing to quote back.";

export interface AskInput {
  documentText: string;
  question: string;
  callModel: CallModel;
}

/** Answer one question about one document. One model call, nothing retained. */
export async function ask(input: AskInput): Promise<QuestionAnswer> {
  const { documentText, question, callModel } = input;

  const raw = await callModel([
    { role: "system", content: QUESTION_SYSTEM_PROMPT },
    { role: "user", content: buildQuestionPrompt(documentText, question) },
  ]);

  return ground(documentText, parseAnswer(raw));
}

/**
 * Hold the answer to the document. Every quote is placed in the text or
 * dropped, and an answer left with no quote is not returned in its own wording
 * at all — it becomes the fixed response. Pure; exported for tests.
 */
export function ground(
  documentText: string,
  response: ModelAnswer,
): QuestionAnswer {
  const citations: Citation[] = [];
  const dropped: DroppedCitation[] = [];
  const placed = new Set<number>();

  // A model that already said the document is silent gets taken at its word.
  // Nothing it quoted alongside that changes the answer it gave.
  if (response.addressed) {
    for (const quote of response.citations) {
      if (typeof quote !== "string") {
        dropped.push({ reason: "malformed" });
        continue;
      }

      // ADR 0001, the same rule and the same normalisation a flag passes.
      const location = locate(documentText, quote);
      if (!location) {
        dropped.push({ reason: "unlocatable-quote", quote });
        continue;
      }

      // The same sentence quoted twice is one citation.
      if (placed.has(location.start)) continue;
      placed.add(location.start);

      citations.push({
        // Quote the document's own characters, not the model's copy of them.
        sourceSentence: documentText.slice(location.start, location.end),
        location,
      });
    }
  }

  const answer = typeof response.answer === "string" ? response.answer.trim() : "";

  // No sentence to stand on, no answer. An ungrounded answer is never returned
  // in the model's own wording, which is the whole point of the feature.
  if (!response.addressed || citations.length === 0 || answer.length === 0) {
    return { answer: DOCUMENT_DOES_NOT_ADDRESS, citations: [], dropped };
  }

  // In the order they appear in the document, so the reader works down it.
  citations.sort((a, b) => a.location.start - b.location.start);

  return { answer, citations, dropped };
}

/**
 * Read the answer back and insist on the top-level shape. `addressed` left out
 * altogether is read as true, because the citations decide whether an answer is
 * grounded and an absent field cannot loosen that.
 */
export function parseAnswer(raw: string): ModelAnswer {
  const data = parseJsonObject(raw);

  const addressed = data.addressed === undefined ? true : data.addressed;

  if (
    typeof addressed !== "boolean" ||
    typeof data.answer !== "string" ||
    !Array.isArray(data.citations)
  ) {
    throw new Error("Model response did not match the expected shape");
  }

  return { addressed, answer: data.answer, citations: data.citations };
}
