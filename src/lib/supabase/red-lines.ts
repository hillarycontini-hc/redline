import { SEED_RED_LINES, compareSeverity } from "../analysis/red-lines.ts";
import { SEVERITIES } from "../analysis/types.ts";
import type { RedLine, Severity } from "../analysis/types.ts";
import type { Viewer } from "./access.ts";
import type { SupabaseAccess } from "./client.ts";

/**
 * The reader's own red lines: read, added to, re-tiered, and taken off.
 *
 * This list is not a preference pane. It is the thing that decides what a
 * reading shows and how hard — `enforce()` in lib/analysis/analyze.ts drops any
 * clause type the list does not carry and takes the tier from the entry that
 * matched. So two rules run through everything here.
 *
 * The first is that the list is read on the server, from the account's own
 * rows, and never taken from the browser. A list posted back up would be
 * hearsay about what the reader refuses, and this one decides what they are
 * told about their contract.
 *
 * The second is that a row is checked before it is used, never cast. A severity
 * that is not one of the three words is not a tier, and a row carrying one is
 * refused rather than guessed at — a malformed row must not be able to decide
 * what a reader sees.
 *
 * Nothing here re-seeds an empty list. A reader who has taken every entry off
 * has made a choice, and putting the defaults back would undo it. The seeding
 * happens once, at account creation, in
 * supabase/migrations/0004_seed_red_lines_for_a_new_account.sql.
 */

/** One stored entry: a red line, plus the id of the row it came from. */
export interface RedLineEntry extends RedLine {
  id: string;
}

export type RedLinesList =
  | { ok: true; redLines: RedLineEntry[]; refused: number }
  | { ok: false; why: "no-accounts" | "unreadable" };

/**
 * The list a reading runs against. `ok: false` is not an empty list: a reader
 * whose rows could not be read must not be read against somebody else's
 * defaults, because the flags they would then see are not the ones their own
 * list asks for.
 */
export type RedLinesInForce =
  | { ok: true; redLines: readonly RedLine[] }
  | { ok: false; why: "unreadable" };

export type RedLineAdded =
  | { added: true }
  | { added: false; why: "no-accounts" | "already-there" | "unwritable" };

export type RedLineChanged =
  | { changed: true }
  | { changed: false; why: "no-accounts" | "not-found" | "unwritable" };

export type RedLineRemoved =
  | { removed: true }
  | { removed: false; why: "no-accounts" | "not-found" | "unwritable" };

/** Whose list this reading is read against. Pure, so the decision is testable. */
export type WhichRedLines =
  | { which: "the seeded list" }
  | { which: "the account's own"; userId: string };

/** Postgres' code for a unique constraint it would not let through. */
const ALREADY_THERE = "23505";

export const LONGEST_LABEL = 80;
export const LONGEST_DESCRIPTION = 400;

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

/**
 * One of the three words, or nothing. There is no fourth tier, no numeric
 * severity, and no near miss: "critical" and "Severe" are both refused, because
 * a tier Redline cannot name is a tier it cannot show.
 */
export function asTier(value: unknown): Severity | null {
  return SEVERITIES.find((tier) => tier === value) ?? null;
}

/**
 * A clause type for an entry the reader wrote themselves.
 *
 * It is an identifier, not words anybody reads — the label is what the screen
 * shows and the description is what the model is told to look for. It has to be
 * stable for the same label and usable in JSON the model copies back, so it is
 * reduced to lowercase letters, digits and hyphens. A label with none of those
 * in it still deserves an entry, so it falls back to a digest of the label
 * rather than being refused: a reader writing in their own script is not a
 * malformed entry.
 */
export function clauseTypeFrom(label: string): string {
  const slug = label
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");

  return slug.length > 0 ? slug : `own-${digestOf(label.trim())}`;
}

/** djb2, base 36. Short, stable, and only ever used as an identifier. */
function digestOf(value: string): string {
  let hash = 5381;
  for (const character of value) {
    hash = (hash * 33 + character.codePointAt(0)!) % 0xffffffff;
  }
  return hash.toString(36);
}

export type NewRedLine =
  | { ok: true; redLine: RedLine }
  | { ok: false; problem: string };

/**
 * What the reader typed, turned into an entry or refused with a reason they can
 * act on. Pure, and the only place the three fields of a new entry are checked.
 */
export function newRedLine(fields: {
  label: unknown;
  description: unknown;
  severity: unknown;
}): NewRedLine {
  const label = typeof fields.label === "string" ? fields.label.trim() : "";
  const description =
    typeof fields.description === "string" ? fields.description.trim() : "";
  const severity = asTier(fields.severity);

  if (label.length === 0) {
    return { ok: false, problem: "Name the clause you will not accept." };
  }
  if (label.length > LONGEST_LABEL) {
    return {
      ok: false,
      problem: `That name runs to ${label.length} characters. Keep it under ${LONGEST_LABEL} so it fits on the line.`,
    };
  }
  if (description.length === 0) {
    return {
      ok: false,
      problem:
        "Say what the clause looks like in a document. Redline reads your words to find it.",
    };
  }
  if (description.length > LONGEST_DESCRIPTION) {
    return {
      ok: false,
      problem: `That runs to ${description.length} characters. Keep it under ${LONGEST_DESCRIPTION}.`,
    };
  }
  if (!severity) {
    return { ok: false, problem: "Pick how hard this one should land." };
  }

  return {
    ok: true,
    redLine: {
      clauseType: clauseTypeFrom(label),
      label,
      description,
      severity,
    },
  };
}

/**
 * One row, checked rather than cast. Returns a fresh object, so nothing that
 * was riding along in the row comes through with it.
 */
export function asRedLineEntry(row: unknown): RedLineEntry | null {
  if (typeof row !== "object" || row === null || Array.isArray(row)) return null;

  const {
    id,
    clause_type: clauseType,
    label,
    description,
    severity,
  } = row as Record<string, unknown>;

  const rowId = text(id);
  const type = text(clauseType);
  const name = text(label);
  const lookFor = text(description);
  const tier = asTier(severity);

  if (!rowId || !type || !name || !lookFor || !tier) return null;

  return {
    id: rowId,
    clauseType: type.trim(),
    label: name.trim(),
    description: lookFor.trim(),
    severity: tier,
  };
}

/**
 * Every row that makes an entry, and a count of the ones that did not.
 *
 * A bad row is left out rather than taking the whole list down with it: the
 * reader's other red lines still say what they refuse. The count is logged
 * where this is called, because a refused row means a reader is being read
 * against a shorter list than they wrote.
 */
export function redLineEntriesFrom(rows: unknown): {
  redLines: RedLineEntry[];
  refused: number;
} {
  if (!Array.isArray(rows)) return { redLines: [], refused: 0 };

  const redLines: RedLineEntry[] = [];
  let refused = 0;

  for (const row of rows) {
    const entry = asRedLineEntry(row);
    if (entry) redLines.push(entry);
    else refused += 1;
  }

  return { redLines, refused };
}

/** The entry without its row id: what the model is told, and what is stored. */
export function plainRedLine(entry: RedLineEntry): RedLine {
  return {
    clauseType: entry.clauseType,
    label: entry.label,
    description: entry.description,
    severity: entry.severity,
  };
}

/**
 * The account's own red lines, hardest tier first and then alphabetically, so
 * the list reads the way a statement does.
 *
 * The `owner_id` filter is not what keeps one account out of another's rows —
 * row-level security does that, in the database, where it cannot be forgotten.
 * It is here so the query says out loud what it is entitled to.
 */
export async function listRedLines(
  access: SupabaseAccess,
  ownerId: string,
): Promise<RedLinesList> {
  if (!access.configured) return { ok: false, why: "no-accounts" };

  const { data, error } = await access.client
    .from("red_lines")
    .select("id, clause_type, label, description, severity")
    .eq("owner_id", ownerId);

  // The commonest cause on a fresh project is that supabase/migrations has not
  // been run, so the table is not there. Either way the reader is told the list
  // would not open rather than shown an empty one: an empty list and an unread
  // one are different facts, and here they would lead to different readings.
  if (error) return { ok: false, why: "unreadable" };

  const { redLines, refused } = redLineEntriesFrom(data);
  return { ok: true, redLines: inReadingOrder(redLines), refused };
}

/**
 * Hardest tier first, then by name. Sorted here rather than in the query
 * because the eight seeded rows are written in one statement and so share a
 * creation time to the microsecond — ordering on it would leave the list in
 * whatever order Postgres felt like.
 */
export function inReadingOrder(redLines: RedLineEntry[]): RedLineEntry[] {
  return [...redLines].sort(
    (a, b) =>
      compareSeverity(a.severity, b.severity) ||
      a.label.localeCompare(b.label, "en-GB"),
  );
}

/**
 * Whose list this reading runs against.
 *
 * A signed-in reader's own, and the seeded list for everybody else. A reader
 * with no account loses the library and the editing, and nothing about the
 * reading itself: the seeded eight are a working list, not a placeholder.
 */
export function whichRedLines(viewer: Viewer): WhichRedLines {
  if (viewer.state === "signed-in") {
    return { which: "the account's own", userId: viewer.userId };
  }
  return { which: "the seeded list" };
}

/**
 * The red lines this reading is read against, fetched where the reading
 * happens. Called by the analysis route before the model is asked anything.
 */
export async function redLinesFor(
  access: SupabaseAccess,
  viewer: Viewer,
): Promise<RedLinesInForce> {
  const whose = whichRedLines(viewer);
  if (whose.which === "the seeded list") {
    return { ok: true, redLines: SEED_RED_LINES };
  }

  const list = await listRedLines(access, whose.userId);
  if (!list.ok) return { ok: false, why: "unreadable" };

  if (list.refused > 0) {
    console.warn(
      `[red lines] ${list.refused} stored row(s) refused: a row that is not a red line cannot drive a reading`,
    );
  }

  return { ok: true, redLines: list.redLines.map(plainRedLine) };
}

/** Put one entry on the account's list. */
export async function addRedLine(
  access: SupabaseAccess,
  ownerId: string,
  redLine: RedLine,
): Promise<RedLineAdded> {
  if (!access.configured) return { added: false, why: "no-accounts" };

  const { error } = await access.client.from("red_lines").insert({
    owner_id: ownerId,
    clause_type: redLine.clauseType,
    label: redLine.label,
    description: redLine.description,
    severity: redLine.severity,
  });

  if (error) {
    // One entry per clause type per account, held by a unique constraint in
    // 0003. A second entry for the same clause type is not a new red line, it
    // is a second opinion about the same one.
    if (error.code === ALREADY_THERE) {
      return { added: false, why: "already-there" };
    }
    return { added: false, why: "unwritable" };
  }

  return { added: true };
}

/**
 * Re-tier one entry. The update is asked to say what it changed, so a row that
 * row-level security refused is told apart from one that moved.
 */
export async function setRedLineTier(
  access: SupabaseAccess,
  ownerId: string,
  clauseType: string,
  severity: Severity,
): Promise<RedLineChanged> {
  if (!access.configured) return { changed: false, why: "no-accounts" };
  if (clauseType.trim().length === 0) {
    return { changed: false, why: "not-found" };
  }

  const { data, error } = await access.client
    .from("red_lines")
    .update({ severity })
    .eq("owner_id", ownerId)
    .eq("clause_type", clauseType)
    .select("id");

  if (error) return { changed: false, why: "unwritable" };
  if (!data || data.length === 0) return { changed: false, why: "not-found" };

  return { changed: true };
}

/**
 * Take one entry off the list. The clause type stops being flagged from the
 * next reading on, which is the whole point of the control and the reason the
 * screen says so before the press.
 */
export async function removeRedLine(
  access: SupabaseAccess,
  ownerId: string,
  clauseType: string,
): Promise<RedLineRemoved> {
  if (!access.configured) return { removed: false, why: "no-accounts" };
  if (clauseType.trim().length === 0) {
    return { removed: false, why: "not-found" };
  }

  const { data, error } = await access.client
    .from("red_lines")
    .delete()
    .eq("owner_id", ownerId)
    .eq("clause_type", clauseType)
    .select("id");

  if (error) return { removed: false, why: "unwritable" };
  if (!data || data.length === 0) return { removed: false, why: "not-found" };

  return { removed: true };
}
