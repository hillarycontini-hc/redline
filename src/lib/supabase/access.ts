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
export const READ_PATH = "/read";

export type Viewer =
  | { state: "no-accounts"; missing: readonly string[] }
  | { state: "signed-out" }
  | { state: "signed-in"; userId: string; email: string | null };

export type LibraryGate =
  | { show: "library"; userId: string }
  | { show: "no-accounts"; missing: readonly string[] }
  | { show: "sign-in-first"; goTo: string };

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
