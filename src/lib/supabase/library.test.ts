/**
 * Reading the library.
 *
 * Two things are asserted, and both are things a reader could see. A row that
 * does not carry a name and a date is left out rather than rendered as a blank
 * line, because a library listing "undefined" is worse than one listing
 * nothing. And asking for a library on a deployment with no account database
 * comes back as a stated reason rather than as an empty list — an empty library
 * and an unread one are different facts, and the screen says different things
 * about them.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { asSavedDocument, listSavedDocuments } from "./library.ts";

const ROW = {
  id: "0f6e2d10-0000-4000-8000-000000000001",
  filename: "client-agreement.pdf",
  created_at: "2026-09-30T18:12:04.221Z",
};

test("a complete row becomes a document in the library", () => {
  assert.deepEqual(asSavedDocument(ROW), {
    id: ROW.id,
    filename: ROW.filename,
    createdAt: ROW.created_at,
  });
});

test("a row missing anything the library shows is left out", () => {
  for (const bad of [
    { ...ROW, filename: undefined },
    { ...ROW, filename: "" },
    { ...ROW, id: "" },
    { ...ROW, created_at: null },
    { ...ROW, created_at: 1759254724221 },
    null,
    undefined,
    "a string",
    42,
  ]) {
    assert.equal(
      asSavedDocument(bad),
      null,
      `${JSON.stringify(bad)} is not a document the library can show`,
    );
  }
});

test("asking for a library with no account database behind it gives a reason, not an empty list", async () => {
  const saved = await listSavedDocuments(
    { configured: false, missing: ["NEXT_PUBLIC_SUPABASE_URL"] },
    "a2c1f0de-0000-4000-8000-000000000001",
  );

  assert.equal(saved.ok, false);
  if (saved.ok) throw new Error("unreachable");
  assert.equal(saved.why, "no-accounts");
});
