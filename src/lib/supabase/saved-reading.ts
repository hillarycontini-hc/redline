import { normalize } from "../analysis/normalize.ts";
import { SEVERITIES } from "../analysis/types.ts";
import type { Flag, RedLine, Severity } from "../analysis/types.ts";
import type { SupabaseAccess } from "./client.ts";

/**
 * One reading, kept and read back.
 *
 * A saved reading is a record of what the reader was told at the time. Two
 * things follow from that, and they are the whole design of this module.
 *
 * The first is that the red lines it ran against are **copied into the stored
 * reading as data**, never referenced by id. The reader is allowed to change
 * their mind about what they care about, and a record that moved when they did
 * would not be a record of anything.
 *
 * The second is that the document's text is stored beside the flags, so every
 * flag's `location` still slices the text it was measured against. That is ADR
 * 0001 surviving a round trip through the database: a flag whose source
 * sentence cannot be shown is a bug, and a flag read back out of a row is no
 * exception. So the range is checked against the text on the way in and on the
 * way out, and a reading that does not hold is reported rather than rendered.
 */

export interface SavedReading {
  documentId: string;
  filename: string;
  /** Verbatim, as the reader confirmed it. Every flag's location indexes this. */
  documentText: string;
  summary: string;
  flags: Flag[];
  /** The reader's red lines as at the moment it ran. A copy, never a link. */
  redLinesInForce: RedLine[];
  /** ISO 8601, as Postgres returned it. Formatted where it is rendered. */
  readAt: string;
}

/** What the analysis hands over to be kept. */
export interface ReadingToSave {
  filename: string;
  documentText: string;
  summary: string;
  flags: readonly Flag[];
  redLinesInForce: readonly RedLine[];
}

/**
 * Whether the reading reached the reader's library.
 *
 * `detail` is for the server log and never for the reader: it carries whatever
 * Postgres said, which is not something to put on a screen.
 */
export type Saved =
  | { kept: true; documentId: string }
  | {
      kept: false;
      why: "no-account" | "not-signed-in" | "would-not-hold" | "unwritable";
      detail?: string;
    };

export type OpenedReading =
  | { ok: true; reading: SavedReading }
  | { ok: false; why: "no-accounts" | "not-found" | "unreadable" | "damaged" };

export type Removed =
  | { removed: true }
  | { removed: false; why: "no-accounts" | "not-found" | "unwritable" };

/** The rows as they go to Postgres, before the ids the database supplies. */
export interface ReadingRows {
  document: { filename: string; extracted_text: string };
  analysis: {
    summary: string;
    flags: Flag[];
    red_lines_in_force: RedLine[];
  };
}

/**
 * A document id as the database makes them. Checked before it reaches a query,
 * because an id that arrived in a URL is whatever somebody typed, and sending
 * that to Postgres turns "no such document" into a database error.
 */
const DOCUMENT_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function looksLikeDocumentId(value: unknown): value is string {
  return typeof value === "string" && DOCUMENT_ID.test(value);
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function severity(value: unknown): Severity | null {
  return SEVERITIES.find((s) => s === value) ?? null;
}

/**
 * Whether this flag's range really does point at this sentence in this text.
 *
 * The comparison is on the normalised forms, which is what "verbatim" means
 * here and nothing looser (spec D8): the stored sentence may carry the quote
 * characters and the line wrapping the model sent, while the slice carries the
 * document's own.
 */
function rangeHoldsTheSentence(
  documentText: string,
  sourceSentence: string,
  start: number,
  end: number,
): boolean {
  if (!Number.isInteger(start) || !Number.isInteger(end)) return false;
  if (start < 0 || end <= start || end > documentText.length) return false;

  return (
    normalize(documentText.slice(start, end)).text ===
    normalize(sourceSentence).text
  );
}

/**
 * One flag, checked against the text rather than cast. Returns a fresh object,
 * so nothing that was riding along in the row comes through with it.
 */
export function asStoredFlag(value: unknown, documentText: string): Flag | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const row = value as Record<string, unknown>;

  const clauseType = text(row.clauseType);
  const sourceSentence = text(row.sourceSentence);
  const consequence = text(row.consequence);
  const tier = severity(row.severity);
  if (!clauseType || !sourceSentence || !consequence || !tier) return null;

  const location = row.location;
  if (typeof location !== "object" || location === null) return null;
  const { start, end } = location as Record<string, unknown>;
  if (typeof start !== "number" || typeof end !== "number") return null;

  if (!rangeHoldsTheSentence(documentText, sourceSentence, start, end)) {
    return null;
  }

  const flag: Flag = {
    clauseType,
    severity: tier,
    sourceSentence,
    location: { start, end },
    consequence,
  };

  // Absent is the right state on a Worth-knowing flag, so only a present one
  // has to be a usable string.
  if (row.counterOffer !== undefined && row.counterOffer !== null) {
    const counterOffer = text(row.counterOffer);
    if (!counterOffer) return null;
    flag.counterOffer = counterOffer;
  }

  return flag;
}

/** One red line as it was in force. Checked the same way, for the same reason. */
export function asStoredRedLine(value: unknown): RedLine | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const row = value as Record<string, unknown>;

  const clauseType = text(row.clauseType);
  const label = text(row.label);
  const description = text(row.description);
  const tier = severity(row.severity);
  if (!clauseType || !label || !description || !tier) return null;

  return { clauseType, label, description, severity: tier };
}

/**
 * Every flag, or none.
 *
 * A reading is rejected whole rather than shortened. On the live path a flag
 * that cannot be placed is dropped and counted, because the model is the thing
 * that got it wrong and the rest of the reading still stands. Here there is no
 * model to blame: a range that no longer fits its sentence means the record
 * itself is damaged — the text was truncated, or the row was edited — and a
 * reading quietly shown with four of its eight lines would read as a shorter
 * statement than the reader was given.
 */
function allFlags(value: unknown, documentText: string): Flag[] | null {
  if (!Array.isArray(value)) return null;

  const flags: Flag[] = [];
  for (const entry of value) {
    const flag = asStoredFlag(entry, documentText);
    if (!flag) return null;
    flags.push(flag);
  }
  return flags;
}

function allRedLines(value: unknown): RedLine[] | null {
  if (!Array.isArray(value)) return null;

  const redLines: RedLine[] = [];
  for (const entry of value) {
    const redLine = asStoredRedLine(entry);
    if (!redLine) return null;
    redLines.push(redLine);
  }
  return redLines;
}

/**
 * The two rows, read back as the reading they were. Null when they do not make
 * one, which the screen says out loud rather than rendering a gap.
 */
export function asSavedReading(
  documentRow: unknown,
  analysisRow: unknown,
): SavedReading | null {
  if (typeof documentRow !== "object" || documentRow === null) return null;
  if (typeof analysisRow !== "object" || analysisRow === null) return null;

  const document = documentRow as Record<string, unknown>;
  const analysis = analysisRow as Record<string, unknown>;

  const documentId = text(document.id);
  const filename = text(document.filename);
  const documentText = text(document.extracted_text);
  if (!documentId || !filename || !documentText) return null;

  const summary = text(analysis.summary);
  const readAt = text(analysis.created_at);
  if (!summary || !readAt) return null;

  const flags = allFlags(analysis.flags, documentText);
  if (!flags) return null;

  const redLinesInForce = allRedLines(analysis.red_lines_in_force);
  if (!redLinesInForce) return null;

  return {
    documentId,
    filename,
    documentText,
    summary,
    flags,
    redLinesInForce,
    readAt,
  };
}

/**
 * The reading as two rows, deep-copied.
 *
 * The copying is the point, not a formality. The red lines go in as values, so
 * the list the reader goes on editing afterwards and the list this reading ran
 * against are two different things from the moment it is written.
 *
 * Null when the reading would not hold: a flag whose range does not fit its
 * sentence is never written, because writing it would put a flag in the library
 * that cannot show where it came from.
 */
export function rowsForReading(reading: ReadingToSave): ReadingRows | null {
  const filename = reading.filename.trim();
  const summary = reading.summary.trim();
  const documentText = reading.documentText;

  if (filename.length === 0) return null;
  if (summary.length === 0) return null;
  if (documentText.trim().length === 0) return null;

  const flags: Flag[] = [];
  for (const flag of reading.flags) {
    const kept = asStoredFlag(flag, documentText);
    if (!kept) return null;
    flags.push(kept);
  }

  const redLines: RedLine[] = [];
  for (const redLine of reading.redLinesInForce) {
    const kept = asStoredRedLine(redLine);
    if (!kept) return null;
    redLines.push(kept);
  }

  return {
    document: { filename, extracted_text: documentText },
    analysis: { summary, flags, red_lines_in_force: redLines },
  };
}

/**
 * Keep one reading against one account.
 *
 * Two inserts, because they are two tables. If the second fails the first is
 * taken back: a document with no reading of it would sit in the library looking
 * openable and open to nothing.
 *
 * `owner_id` is written explicitly and row-level security checks it again in
 * the database, where it cannot be forgotten.
 */
export async function saveReading(
  access: SupabaseAccess,
  ownerId: string,
  reading: ReadingToSave,
): Promise<Saved> {
  if (!access.configured) return { kept: false, why: "no-account" };

  const rows = rowsForReading(reading);
  if (!rows) return { kept: false, why: "would-not-hold" };

  const document = await access.client
    .from("documents")
    .insert({ owner_id: ownerId, ...rows.document })
    .select("id")
    .single();

  if (document.error || !looksLikeDocumentId(document.data?.id)) {
    return {
      kept: false,
      why: "unwritable",
      detail: document.error?.message ?? "no document id came back",
    };
  }

  const documentId = document.data.id;

  const analysis = await access.client
    .from("analyses")
    .insert({ owner_id: ownerId, document_id: documentId, ...rows.analysis });

  if (analysis.error) {
    await access.client
      .from("documents")
      .delete()
      .eq("id", documentId)
      .eq("owner_id", ownerId);

    return { kept: false, why: "unwritable", detail: analysis.error.message };
  }

  return { kept: true, documentId };
}

/**
 * One saved reading, read back whole: the document's text and name, the
 * summary, the flags, and the red lines that were in force.
 *
 * No model is called here and none can be. This is a read of two rows.
 */
export async function openSavedReading(
  access: SupabaseAccess,
  ownerId: string,
  documentId: string,
): Promise<OpenedReading> {
  if (!access.configured) return { ok: false, why: "no-accounts" };
  if (!looksLikeDocumentId(documentId)) return { ok: false, why: "not-found" };

  const document = await access.client
    .from("documents")
    .select("id, filename, extracted_text")
    .eq("id", documentId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (document.error) return { ok: false, why: "unreadable" };
  if (!document.data) return { ok: false, why: "not-found" };

  // The newest reading of it. Reading a document again makes another, and the
  // one the reader means is the last one they were shown.
  const analysis = await access.client
    .from("analyses")
    .select("summary, flags, red_lines_in_force, created_at")
    .eq("document_id", documentId)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (analysis.error) return { ok: false, why: "unreadable" };
  // The document is here and no reading of it is. Nothing to show, and it is
  // not the same fact as the document being gone.
  if (!analysis.data) return { ok: false, why: "damaged" };

  const reading = asSavedReading(document.data, analysis.data);
  if (!reading) return { ok: false, why: "damaged" };

  return { ok: true, reading };
}

/**
 * Take a document out of the library. Its readings go with it: the cascade in
 * supabase/migrations/0002_analyses.sql sees to that, because a reading whose
 * text is gone cannot show the sentence each flag came from.
 *
 * The delete is asked to return what it deleted, so "nothing matched" is told
 * apart from "it went". Without that, a delete that row-level security refused
 * would look exactly like a delete that worked.
 */
export async function removeSavedDocument(
  access: SupabaseAccess,
  ownerId: string,
  documentId: string,
): Promise<Removed> {
  if (!access.configured) return { removed: false, why: "no-accounts" };
  if (!looksLikeDocumentId(documentId)) {
    return { removed: false, why: "not-found" };
  }

  const { data, error } = await access.client
    .from("documents")
    .delete()
    .eq("id", documentId)
    .eq("owner_id", ownerId)
    .select("id");

  if (error) return { removed: false, why: "unwritable" };
  if (!data || data.length === 0) return { removed: false, why: "not-found" };

  return { removed: true };
}
