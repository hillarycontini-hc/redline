/**
 * What the account form has to say after a go. Kept out of the actions file
 * because a "use server" module may export nothing but async functions.
 *
 * Two fields, because two different things can come back and they do not read
 * alike. A `problem` is something the reader has to fix. A `notice` is the
 * form having done its job and handed the next step to them.
 */
export interface AccountFormState {
  problem: string | null;
  notice: string | null;
}

export const NOTHING_SAID: AccountFormState = { problem: null, notice: null };
