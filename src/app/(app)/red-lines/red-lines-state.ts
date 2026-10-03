/**
 * What a red lines control has to say after a go. Kept out of the actions file
 * because a "use server" module may export nothing but async functions.
 *
 * Two fields, because both things happen here. Adding an entry is worth saying
 * out loud — it changes what every later document is read against, and the row
 * appearing in a list of nine is easy to miss. A problem is always worth
 * saying: a control that was pressed and did nothing leaves the reader guessing
 * whether their list is what they think it is.
 */
export interface RedLinesState {
  problem: string | null;
  notice: string | null;
}

export const NOTHING_TO_SAY: RedLinesState = { problem: null, notice: null };
