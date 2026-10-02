import type { SupabaseAccess } from "./client.ts";

/**
 * Reading an account's library. Saving to it is ticket 08; this is the read
 * side, which is what the library screen needs to be able to say honestly
 * either "here they are" or "there is nothing here yet".
 */

export interface SavedDocument {
  id: string;
  filename: string;
  /** ISO 8601, as Postgres returned it. Formatted where it is rendered. */
  createdAt: string;
}

export type SavedDocuments =
  | { ok: true; documents: SavedDocument[] }
  | { ok: false; why: "no-accounts" | "unreadable" };

/**
 * One row, checked rather than cast. What comes back over the wire is whatever
 * the database sent, and a library that rendered `undefined` as a document name
 * would be worse than one that left the row out.
 */
export function asSavedDocument(row: unknown): SavedDocument | null {
  if (typeof row !== "object" || row === null) return null;

  const { id, filename, created_at: createdAt } = row as Record<
    string,
    unknown
  >;

  if (typeof id !== "string" || id.length === 0) return null;
  if (typeof filename !== "string" || filename.length === 0) return null;
  if (typeof createdAt !== "string" || createdAt.length === 0) return null;

  return { id, filename, createdAt };
}

/**
 * The account's documents, newest first.
 *
 * The `owner_id` filter is not what keeps one account out of another's rows —
 * row-level security does that, in the database, where it cannot be forgotten.
 * It is here so the query says out loud what it is entitled to, and so a
 * misconfigured table shows up as nothing rather than as somebody else's
 * contracts.
 */
export async function listSavedDocuments(
  access: SupabaseAccess,
  ownerId: string,
): Promise<SavedDocuments> {
  if (!access.configured) return { ok: false, why: "no-accounts" };

  const { data, error } = await access.client
    .from("documents")
    .select("id, filename, created_at")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  // The commonest cause on a fresh project is that supabase/migrations has not
  // been run yet, so the table is not there. Either way the reader is told the
  // library would not open rather than shown an empty one, because an empty
  // library and an unread one are different facts.
  if (error) return { ok: false, why: "unreadable" };

  const documents: SavedDocument[] = [];
  for (const row of data ?? []) {
    const document = asSavedDocument(row);
    if (document) documents.push(document);
  }

  return { ok: true, documents };
}
