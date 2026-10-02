import { analyze } from "@/lib/analysis/analyze.ts";
import { SEED_RED_LINES } from "@/lib/analysis/red-lines.ts";
import type { AnalyzeResponse } from "@/lib/analysis/types.ts";
import { ConfigError, openRouterCaller } from "@/lib/openrouter.ts";
import { MALFORMED_JSON, checkRequest, isJsonRequest } from "./validate.ts";

/**
 * The analysis route. Text in, statement out.
 *
 * It reads the body with request.json() and with nothing else. There is no
 * call to formData(), blob(), or arrayBuffer() here or anywhere in the build:
 * the file is parsed in the reader's own browser and only the text it confirms
 * travels (CLAUDE.md). A request arriving as any other content type is refused
 * before the body is touched.
 *
 * Phase 1 reads against the seeded red lines. Ticket 09 makes the list the
 * reader's own.
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
      console.error(`[analyze] not configured: ${error.message}`);
      return refuse(
        503,
        "Redline cannot reach the model from this server, so nothing was read.",
      );
    }
    throw error;
  }

  let analysis;
  try {
    analysis = await analyze({
      documentText: checked.documentText,
      redLines: SEED_RED_LINES,
      callModel,
    });
  } catch (error) {
    console.error("[analyze] the model call failed", error);
    return refuse(
      502,
      "The reading did not come back in one piece. Try it again.",
    );
  }

  // ADR 0001: a refusal is recorded, not discarded. The sentence is logged
  // here and never sent to the browser.
  for (const d of analysis.dropped) {
    console.warn(
      `[analyze] flag refused: reason=${d.reason} clauseType=${d.clauseType ?? "(none)"} sourceSentence=${JSON.stringify(d.sourceSentence ?? null)}`,
    );
  }

  const payload: AnalyzeResponse = {
    summary: analysis.summary,
    flags: analysis.flags,
    droppedCount: analysis.dropped.length,
  };

  return Response.json(payload);
}
