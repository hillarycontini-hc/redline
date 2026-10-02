/**
 * What the remove control has to say after a go. Kept out of the actions file
 * because a "use server" module may export nothing but async functions.
 *
 * One field. Removing a document has nothing to report when it works — the row
 * is gone from the page, which is the whole message — so the only thing to
 * carry back is a problem the reader can see for themselves is a problem.
 */
export interface RemoveState {
  problem: string | null;
}

export const NOTHING_WRONG: RemoveState = { problem: null };
