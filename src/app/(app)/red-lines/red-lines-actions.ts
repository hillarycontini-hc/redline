"use server";

import { refresh } from "next/cache";
import { gateRedLines } from "@/lib/supabase/access.ts";
import {
  addRedLine,
  asTier,
  newRedLine,
  removeRedLine,
  setRedLineTier,
} from "@/lib/supabase/red-lines.ts";
import { readSession } from "@/lib/supabase/server.ts";
import { NOTHING_TO_SAY, type RedLinesState } from "./red-lines-state.ts";

/**
 * Editing the list a reading is answerable to.
 *
 * All three run on the server and ask who is calling there, so nothing in the
 * form decides whose list is changed: the account comes from the session, every
 * query is filtered on it, and row-level security checks it again in the
 * database. A form posting somebody else's clause type changes nothing.
 *
 * Nothing here seeds, re-seeds, or restores an entry the reader took off. The
 * defaults are an opening balance, written once at account creation by
 * supabase/migrations/0004_seed_red_lines_for_a_new_account.sql. A reader who
 * clears the list has decided something, and putting it back would overrule
 * them.
 */

const NO_ACCOUNTS: RedLinesState = {
  problem:
    "This copy of Redline has no accounts set up, so there is no list to change. Reading a document still works.",
  notice: null,
};

const SIGNED_OUT: RedLinesState = {
  problem:
    "You are signed out now, so there is no list to change. Sign in and try again.",
  notice: null,
};

/** Who is calling, and the list they are entitled to change. */
async function callerList() {
  const { viewer, access } = await readSession();
  const gate = gateRedLines(viewer);

  if (gate.show === "no-accounts") return { ok: false, state: NO_ACCOUNTS } as const;
  if (gate.show !== "red-lines") return { ok: false, state: SIGNED_OUT } as const;

  return { ok: true, access, userId: gate.userId } as const;
}

export async function addOwnRedLine(
  _previously: RedLinesState,
  form: FormData,
): Promise<RedLinesState> {
  const written = newRedLine({
    label: form.get("label"),
    description: form.get("description"),
    severity: form.get("severity"),
  });

  if (!written.ok) return { problem: written.problem, notice: null };

  const caller = await callerList();
  if (!caller.ok) return caller.state;

  const added = await addRedLine(caller.access, caller.userId, written.redLine);

  if (!added.added) {
    if (added.why === "already-there") {
      return {
        problem: `${written.redLine.label} is already on your list. Change the tier on the entry you have instead of adding a second one.`,
        notice: null,
      };
    }
    if (added.why === "no-accounts") return NO_ACCOUNTS;
    return {
      problem:
        "Redline could not add that just now, so your list is as it was. Give it a minute and try again.",
      notice: null,
    };
  }

  // What puts the new row on the page without the reader reloading it. The
  // screen is read fresh on every visit, so there is no cached data to throw
  // away — what is needed is for the router to render the page again, which in
  // Next 16 is what refresh() is for. It may only be called in a Server Action.
  refresh();

  return {
    problem: null,
    notice: `${written.redLine.label} is on your list, at ${written.redLine.severity}. Every document you read from now on is read against it.`,
  };
}

export async function changeRedLineTier(
  _previously: RedLinesState,
  form: FormData,
): Promise<RedLinesState> {
  const clauseType = String(form.get("clauseType") ?? "");
  const label = String(form.get("label") ?? "").trim();
  const severity = asTier(form.get("severity"));

  if (!severity) {
    return { problem: "Pick one of the three tiers.", notice: null };
  }

  const caller = await callerList();
  if (!caller.ok) return caller.state;

  const changed = await setRedLineTier(
    caller.access,
    caller.userId,
    clauseType,
    severity,
  );

  if (!changed.changed) {
    if (changed.why === "no-accounts") return NO_ACCOUNTS;
    if (changed.why === "not-found") {
      // Gone, or never this account's. Either way the row should not be on the
      // page, and rendering it again is the honest way to say so.
      refresh();
      return NOTHING_TO_SAY;
    }
    return {
      problem:
        "Redline could not change that just now, so the tier is as it was. Give it a minute and try again.",
      notice: null,
    };
  }

  refresh();

  return {
    problem: null,
    notice: `${label.length > 0 ? label : "That clause"} comes back at ${severity} from the next document on.`,
  };
}

export async function takeRedLineOff(
  _previously: RedLinesState,
  form: FormData,
): Promise<RedLinesState> {
  const clauseType = String(form.get("clauseType") ?? "");

  const caller = await callerList();
  if (!caller.ok) return caller.state;

  const removed = await removeRedLine(caller.access, caller.userId, clauseType);

  if (!removed.removed) {
    if (removed.why === "no-accounts") return NO_ACCOUNTS;
    if (removed.why === "not-found") {
      refresh();
      return NOTHING_TO_SAY;
    }
    return {
      problem:
        "Redline could not take that one off just now, so it is still on your list. Give it a minute and try again.",
      notice: null,
    };
  }

  // The row goes from the page, which is the whole message.
  refresh();

  return NOTHING_TO_SAY;
}
