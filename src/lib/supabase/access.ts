/**
 * Who is asking, and what they are allowed to see. Pure: no Supabase, no
 * cookies, no framework. The screens read a viewer and then ask these
 * functions, so the decision can be tested on its own terms.
 *
 * Three viewers, not two. "No accounts here" is a different thing from "not
 * signed in" and the reader is owed different words for each: one of them can
 * sign in, and the other cannot, however hard they try.
 */

export const SIGN_IN_PATH = "/sign-in";
export const LIBRARY_PATH = "/library";
export const RED_LINES_PATH = "/red-lines";
export const READ_PATH = "/read";

export type Viewer =
  | { state: "no-accounts"; missing: readonly string[] }
  | { state: "signed-out" }
  | { state: "signed-in"; userId: string; email: string | null };

export type LibraryGate =
  | { show: "library"; userId: string }
  | { show: "no-accounts"; missing: readonly string[] }
  | { show: "sign-in-first"; goTo: string };

export type RedLinesGate =
  | { show: "red-lines"; userId: string }
  | { show: "no-accounts"; missing: readonly string[] }
  | { show: "sign-in-first"; goTo: string };

export type KeepingGate =
  | { keep: true; userId: string }
  | { keep: false; why: "no-account" | "not-signed-in" };

/** One saved reading, by the id of the document it is of. */
export function savedReadingPath(documentId: string): string {
  return `${LIBRARY_PATH}/${encodeURIComponent(documentId)}`;
}

/**
 * Whether this request gets the library.
 *
 * Only a signed-in viewer does, and the gate hands back the account id it is
 * allowed to read, so the query that follows cannot be written without one.
 * A signed-out viewer is sent to sign in and told where they were going.
 */
export function gateLibrary(viewer: Viewer): LibraryGate {
  if (viewer.state === "no-accounts") {
    return { show: "no-accounts", missing: viewer.missing };
  }
  if (viewer.state === "signed-out") {
    return { show: "sign-in-first", goTo: signInPathFor(LIBRARY_PATH) };
  }
  return { show: "library", userId: viewer.userId };
}

/**
 * Whether this request gets the reader's own red lines.
 *
 * The same three answers as the library, for the same reason: the list is one
 * account's and nobody else's. It matters more here than it does there, because
 * this list decides what every later reading shows — a stranger who could edit
 * it could decide what somebody else is told about their own contract.
 */
export function gateRedLines(viewer: Viewer): RedLinesGate {
  if (viewer.state === "no-accounts") {
    return { show: "no-accounts", missing: viewer.missing };
  }
  if (viewer.state === "signed-out") {
    return { show: "sign-in-first", goTo: signInPathFor(RED_LINES_PATH) };
  }
  return { show: "red-lines", userId: viewer.userId };
}

/**
 * Whether this reading is kept, and under which account.
 *
 * Only a signed-in reader's reading is. The other two viewers are told apart
 * because the reader is owed different words for each: one of them can sign in
 * and have the next one kept, and the other is looking at a copy of Redline
 * with nowhere to keep anything. Neither is interrupted — the reading they came
 * for runs either way.
 */
export function gateKeeping(viewer: Viewer): KeepingGate {
  if (viewer.state === "no-accounts") return { keep: false, why: "no-account" };
  if (viewer.state === "signed-out") {
    return { keep: false, why: "not-signed-in" };
  }
  return { keep: true, userId: viewer.userId };
}

/** Sign in, and come back to where you were going. */
export function signInPathFor(next: string): string {
  return `${SIGN_IN_PATH}?next=${encodeURIComponent(onwardPath(next))}`;
}

/**
 * Where to go after signing in, from a `next` that arrived in the URL.
 *
 * Anyone can put anything in a query string, so this takes only a path on this
 * site: one leading slash, no second slash, no scheme, no backslash. Anything
 * else lands on the reading surface instead of somewhere a stranger chose.
 */
export function onwardPath(next: string | undefined | null): string {
  if (typeof next !== "string") return READ_PATH;
  if (!next.startsWith("/")) return READ_PATH;
  // "//host" and "/\host" are both read as another site by browsers.
  if (next.startsWith("//") || next.startsWith("/\\")) return READ_PATH;
  if (next.includes("\\")) return READ_PATH;
  return next;
}
