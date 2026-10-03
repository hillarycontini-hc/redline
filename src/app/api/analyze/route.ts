import { analyze } from "@/lib/analysis/analyze.ts";
import type {
  Analysis,
  AnalyzeResponse,
  RedLine,
  SavedTo,
} from "@/lib/analysis/types.ts";
import {
  ConfigError,
  UpstreamBusyError,
  openRouterCaller,
} from "@/lib/openrouter.ts";
import { gateKeeping } from "@/lib/supabase/access.ts";
import { redLinesFor } from "@/lib/supabase/red-lines.ts";
import { saveReading } from "@/lib/supabase/saved-reading.ts";
import { readSession, type Session } from "@/lib/supabase/server.ts";
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
 * The red lines the reading runs against are read here too, on the server,
 * from the account's own rows. They are never taken from the request: this list
 * decides which clause types are flagged and at what tier, so a list posted up
 * from the browser would let the caller choose what the reader is told about
 * their own contract. A signed-in reader is read against their own list; anyone
 * else against the seeded one, which is a working list and not a placeholder.
 *
 * This is also where a reading is kept, when there is an account to keep it in.
 * It is kept here rather than by a later call from the browser because this is
 * the only place that knows which red lines the reading actually ran against.
 * A list sent back up afterwards would be hearsay, and the red lines in force
 * are the one part of a saved reading that cannot be reconstructed later.
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

  // Who is reading, and the list their reading is answerable to. Both are
  // settled before the model is asked anything, because the list is an input to
  // the reading and not a note about it.
  const session = await readSession();
  const inForce = await redLinesFor(session.access, session.viewer);

  if (!inForce.ok) {
    // Reading this reader against the seeded list instead would hand them a
    // statement that is not about what they refuse: clause types they took off
    // would come back, and the tiers they set would be somebody else's. Saying
    // nothing came back is the honest answer.
    console.error(
      "[analyze] the reader's red lines would not open, so nothing was read",
    );
    return refuse(
      503,
      "Redline could not open your red lines, so it has not read the document. Any statement it gave you now would be against the wrong list. Give it a minute and put the document in again.",
    );
  }

  let analysis;
  try {
    analysis = await analyze({
      documentText: checked.documentText,
      redLines: inForce.redLines,
      callModel,
    });
  } catch (error) {
    // Busy is not broken. Saying the reading came back in pieces when it never
    // started would be the wrong thing to tell the reader, and nothing here
    // retries on its own.
    if (error instanceof UpstreamBusyError) {
      console.error("[analyze] the model was busy", error);
      return refuse(
        429,
        "Too many documents are going through at once, and this one did not get a turn. Wait a minute and read it again.",
      );
    }
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

  // A flag is never dropped for want of a counter-offer, so the gap is logged
  // instead of hidden. The screen says so too, on the entry itself.
  for (const m of analysis.missingCounterOffers) {
    console.warn(
      `[analyze] no counter-offer drafted: clauseType=${m.clauseType} severity=${m.severity}`,
    );
  }

  const payload: AnalyzeResponse = {
    summary: analysis.summary,
    flags: analysis.flags,
    droppedCount: analysis.dropped.length,
    saved: await keep(
      session,
      inForce.redLines,
      checked.filename,
      checked.documentText,
      analysis,
    ),
  };

  return Response.json(payload);
}

/**
 * Keep the reading, if there is somewhere to keep it.
 *
 * Nothing in here can stop the reader getting their reading. A reader with no
 * account, a reader who is not signed in, and a reader whose library would not
 * take the row all get the same statement on screen; what differs is one quiet
 * line underneath it. So every failure comes back as a value, is logged with
 * whatever the database said, and the reading goes out regardless.
 */
async function keep(
  session: Session,
  redLinesInForce: readonly RedLine[],
  filename: string,
  documentText: string,
  analysis: Analysis,
): Promise<SavedTo> {
  const { viewer, access } = session;
  const gate = gateKeeping(viewer);
  if (!gate.keep) return { kept: false, why: gate.why };

  const saved = await saveReading(access, gate.userId, {
    filename,
    documentText,
    summary: analysis.summary,
    // The list this reading actually ran against, copied in as data. Editing
    // the live list afterwards leaves this one alone, which is the whole reason
    // a reading is stored rather than read again.
    redLinesInForce,
    flags: analysis.flags,
  });

  if (saved.kept) return saved;

  if (saved.why === "would-not-hold") {
    // ADR 0001 at the storage boundary: a flag whose range does not fit its
    // sentence is not written. If this ever fires it is a bug in the analysis,
    // not a database problem, so it is logged as loudly as a dropped flag.
    console.error(
      "[analyze] the reading would not hold on the way into the library, so nothing was kept",
    );
  } else {
    console.error(
      `[analyze] the reading did not reach the library: ${saved.detail ?? saved.why}`,
    );
  }

  return { kept: false, why: "would-not-keep" };
}
