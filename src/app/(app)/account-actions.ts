"use server";

import { redirect } from "next/navigation";
import { READ_PATH, onwardPath } from "@/lib/supabase/access.ts";
import { supabaseForRequest } from "@/lib/supabase/server.ts";
import type { AccountFormState } from "./account-form-state.ts";

/**
 * Making an account, getting into it, and getting out again.
 *
 * All three run on the server, which is where the session cookie has to be
 * written from: an action may set cookies, a page may not. Nothing here has a
 * bypass, a test mode, or a way to produce a signed-in reader without Supabase
 * having said so.
 */

/** Supabase's own floor is six. Eight, because this is the only lock on a library. */
const SHORTEST_PASSWORD = 8;

const NO_ACCOUNTS: AccountFormState = {
  problem:
    "This copy of Redline has no accounts set up, so there is nothing to sign in to. Reading a document still works.",
  notice: null,
};

const NO_SERVICE: AccountFormState = {
  problem:
    "Redline could not get through to the accounts service. Give it a minute and try again.",
  notice: null,
};

interface Credentials {
  email: string;
  password: string;
}

function readCredentials(
  form: FormData,
): { ok: true; credentials: Credentials } | { ok: false; problem: string } {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");

  if (email.length === 0) {
    return { ok: false, problem: "Type the email address you use." };
  }
  if (!email.includes("@")) {
    return {
      ok: false,
      problem: "That does not look like an email address.",
    };
  }
  if (password.length === 0) {
    return { ok: false, problem: "Type your password." };
  }

  return { ok: true, credentials: { email, password } };
}

export async function signIn(
  _previously: AccountFormState,
  form: FormData,
): Promise<AccountFormState> {
  const read = readCredentials(form);
  if (!read.ok) return { problem: read.problem, notice: null };

  const access = await supabaseForRequest();
  if (!access.configured) return NO_ACCOUNTS;

  let failed: string | null = null;
  try {
    const { error } = await access.client.auth.signInWithPassword(
      read.credentials,
    );
    if (error) {
      failed =
        error.code === "email_not_confirmed"
          ? "This account is not finished yet. Open the link in the email Redline sent you, then sign in."
          : "That email and password do not go together. Try them again, or make an account.";
    }
  } catch {
    return NO_SERVICE;
  }

  if (failed) return { problem: failed, notice: null };

  // Outside the try: redirect works by throwing, and catching it here would
  // swallow the navigation and leave the reader on the form.
  redirect(onwardPath(String(form.get("next") ?? "")));
}

/**
 * Supabase's words for why, in ours. A reader is told the thing they can act
 * on; where there is nothing to act on, they are told that instead of being
 * shown the library's own error text.
 */
function whySignUpFailed(code: string | undefined): string {
  switch (code) {
    case "user_already_exists":
    case "email_exists":
      return "There is already an account on that email. Sign in with it instead.";
    case "weak_password":
      return "That password is too easy to guess. Make it longer, or less like a word.";
    case "email_address_invalid":
    case "email_address_not_authorized":
      return "Redline cannot send to that address. Try another one.";
    case "over_email_send_rate_limit":
      return "Too many new accounts from here at once. Wait a few minutes and try again.";
    case "signup_disabled":
      return "New accounts are closed on this copy of Redline. Reading a document still works.";
    default:
      return "Redline could not make that account. Check the email and the password, then try again.";
  }
}

export async function signUp(
  _previously: AccountFormState,
  form: FormData,
): Promise<AccountFormState> {
  const read = readCredentials(form);
  if (!read.ok) return { problem: read.problem, notice: null };

  if (read.credentials.password.length < SHORTEST_PASSWORD) {
    return {
      problem: `A password here runs to ${SHORTEST_PASSWORD} characters or more. Yours is ${read.credentials.password.length}.`,
      notice: null,
    };
  }

  const access = await supabaseForRequest();
  if (!access.configured) return NO_ACCOUNTS;

  let signedIn = false;
  try {
    const { data, error } = await access.client.auth.signUp(read.credentials);

    if (error) {
      return { problem: whySignUpFailed(error.code), notice: null };
    }

    // Supabase projects that ask for email confirmation hand back a user and no
    // session. The reader is not signed in yet and has to be told so, rather
    // than being sent to a library they cannot reach.
    if (!data.session) {
      return {
        problem: null,
        notice:
          "Your account is made. Redline has emailed you a link that finishes it. Open that, then sign in here.",
      };
    }
    signedIn = true;
  } catch {
    return NO_SERVICE;
  }

  if (!signedIn) return NO_SERVICE;

  redirect(onwardPath(String(form.get("next") ?? "")));
}

/**
 * One form, two things it can do. The button the reader pressed says which,
 * because it carries its own name and value into the form data — so the form
 * works whether or not the browser ran any of our JavaScript.
 */
export async function submitAccount(
  previously: AccountFormState,
  form: FormData,
): Promise<AccountFormState> {
  return form.get("intent") === "create"
    ? signUp(previously, form)
    : signIn(previously, form);
}

export async function signOut(): Promise<void> {
  const access = await supabaseForRequest();
  if (access.configured) {
    // The session is cleared whether or not Supabase answers. A reader who
    // presses sign out and stays signed in has been lied to.
    await access.client.auth.signOut().catch(() => undefined);
  }
  redirect(READ_PATH);
}
