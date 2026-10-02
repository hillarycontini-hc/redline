"use server";

import { refresh } from "next/cache";
import { gateLibrary } from "@/lib/supabase/access.ts";
import { removeSavedDocument } from "@/lib/supabase/saved-reading.ts";
import { readSession } from "@/lib/supabase/server.ts";
import { NOTHING_WRONG, type RemoveState } from "./remove-state.ts";

/**
 * Taking a document out of the library.
 *
 * It runs on the server and asks who is calling there, so the id in the form is
 * never the thing that decides what gets deleted: the account comes from the
 * session, the query is filtered on it, and row-level security checks it again
 * in the database. A form that posted somebody else's document id would delete
 * nothing.
 *
 * The reading goes with the document. That is the cascade in
 * supabase/migrations/0002_analyses.sql, and it is deliberate: a reading whose
 * text is gone cannot show the sentence each flag came from.
 */
export async function removeDocument(
  _previously: RemoveState,
  form: FormData,
): Promise<RemoveState> {
  const documentId = String(form.get("documentId") ?? "");

  const { viewer, access } = await readSession();
  const gate = gateLibrary(viewer);

  if (gate.show === "no-accounts") {
    return {
      problem:
        "This copy of Redline has no accounts set up, so there is no library to take it out of.",
    };
  }

  if (gate.show !== "library") {
    return {
      problem:
        "You are signed out now, so there is no library to take it out of. Sign in and try again.",
    };
  }

  const removed = await removeSavedDocument(access, gate.userId, documentId);

  if (!removed.removed) {
    if (removed.why === "not-found") {
      // Already gone, or never this account's to begin with. Either way the row
      // should not be on the page, and re-rendering is the honest way to say so.
      refresh();
      return NOTHING_WRONG;
    }

    return {
      problem:
        "Redline could not take that one out just now, so it is still here. Give it a minute and try again.",
    };
  }

  // What makes the row go without the reader reloading the page themselves.
  //
  // `refresh()` and not `revalidatePath()`: the library is read fresh on every
  // visit — readSession() calls connection(), so the page is never cached — so
  // there is no cached data to invalidate. What is needed is for the client
  // router to render this page again, and in Next 16 that is what refresh() is
  // for. It is a Server Action, which is the only place refresh() may be called.
  refresh();

  return NOTHING_WRONG;
}
