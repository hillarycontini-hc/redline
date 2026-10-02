import { ask } from "@/lib/analysis/question.ts";
import type { AskResponse } from "@/lib/analysis/types.ts";
import {
  ConfigError,
  UpstreamBusyError,
  openRouterCaller,
} from "@/lib/openrouter.ts";
import { MALFORMED_JSON, checkRequest, isJsonRequest } from "./validate.ts";

/**
 * The question route. A document and one question in, an answer and the
 * sentences it rests on out.
 *
 * Like the analysis route, it reads the body with request.json() and with
 * nothing else: the file is parsed in the reader's own browser and only the
 * text they confirmed travels (CLAUDE.md).
 *
 * The request carries the document and the question. It carries no summary, no
 * flags and no earlier question, because the answer is grounded in the
 * document's own text and in nothing that came out of the model before
 * (BUILD-REPORT D2). The validation refuses any other field, so that stays
 * true rather than merely being the intention.
 */

export const runtime = "nodejs";

function refuse(status: number, message: string): Response {
  return Response.json({ message }, { status });
}

export async function POST(request: Request): Promise<Response> {
  const contentType = request.headers.get("content-type");

  let body: unknown;
  if (isJsonRequest(contentType)) {
    try {
      body = await request.json();
    } catch {
      return refuse(MALFORMED_JSON.status, MALFORMED_JSON.message);
    }
  }

  const checked = checkRequest(contentType, body);
  if (!checked.ok) return refuse(checked.status, checked.message);

  let callModel;
  try {
    callModel = openRouterCaller();
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(`[ask] not configured: ${error.message}`);
      return refuse(
        503,
        "Redline cannot reach the model from this server, so the question went unanswered.",
      );
    }
    throw error;
  }

  let answered;
  try {
    answered = await ask({
      documentText: checked.documentText,
      question: checked.question,
      callModel,
    });
  } catch (error) {
    // Busy is not broken, and nothing here retries on its own.
    if (error instanceof UpstreamBusyError) {
      console.error("[ask] the model was busy", error);
      return refuse(
        429,
        "Too many questions are going through at once, and this one did not get a turn. Wait a minute and ask it again.",
      );
    }
    console.error("[ask] the model call failed", error);
    return refuse(502, "The answer did not come back in one piece. Ask again.");
  }

  // ADR 0001: a refusal is recorded, not discarded. The quote is logged here
  // and never sent to the browser.
  for (const d of answered.dropped) {
    console.warn(
      `[ask] quote refused: reason=${d.reason} quote=${JSON.stringify(d.quote ?? null)}`,
    );
  }

  const payload: AskResponse = {
    answer: answered.answer,
    citations: answered.citations,
    droppedCount: answered.dropped.length,
  };

  return Response.json(payload);
}
