/**
 * The reader's own red lines, checked where the checking happens.
 *
 * This list is not a preference. It decides which clause types are flagged and
 * at what tier, so a row that is not a red line must not be able to drive a
 * reading, and a tier that is not one of the three words must not be able to
 * reach a screen. Both of those are decided by the functions below, so they are
 * asked directly, with rows shaped the way a damaged row really would be.
 *
 * Whose list a reading runs against is decided here too, and it is asked with
 * each of the three viewers: a signed-in reader is read against their own, and
 * everybody else against the seeded eight.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { SEED_RED_LINES } from "../analysis/red-lines.ts";
import {
  LONGEST_DESCRIPTION,
  LONGEST_LABEL,
  asRedLineEntry,
  asTier,
  clauseTypeFrom,
  inReadingOrder,
  newRedLine,
  plainRedLine,
  redLineEntriesFrom,
  whichRedLines,
} from "./red-lines.ts";

const ROW = {
  id: "7f0a1b2c-0000-4000-8000-000000000001",
  clause_type: "arbitration",
  label: "Arbitration or class-action waiver",
  description:
    "Disputes must go to binding arbitration, or the reader waives the right to join a class action.",
  severity: "Worth knowing",
};

test("a stored row becomes the entry it says it is", () => {
  const entry = asRedLineEntry(ROW);

  assert.deepEqual(entry, {
    id: ROW.id,
    clauseType: "arbitration",
    label: "Arbitration or class-action waiver",
    description: ROW.description,
    severity: "Worth knowing",
  });
});

test("a tier that is not one of the three words is refused", () => {
  for (const severity of [
    "Severe",
    "critical",
    "CRITICAL",
    "Worth Knowing",
    "High",
    3,
    null,
    undefined,
    ["Critical"],
  ]) {
    assert.equal(
      asTier(severity),
      null,
      `${JSON.stringify(severity)} was read as a tier`,
    );
    assert.equal(
      asRedLineEntry({ ...ROW, severity }),
      null,
      `a row at ${JSON.stringify(severity)} became an entry`,
    );
  }
});

test("the three words are the three tiers, and they are words", () => {
  for (const tier of ["Critical", "Serious", "Worth knowing"]) {
    assert.equal(asTier(tier), tier);
  }
});

test("a malformed row is refused rather than guessed at", () => {
  const malformed: Record<string, unknown>[] = [
    { ...ROW, id: undefined },
    { ...ROW, id: "" },
    { ...ROW, clause_type: undefined },
    { ...ROW, clause_type: "   " },
    { ...ROW, label: null },
    { ...ROW, description: "" },
    { ...ROW, severity: undefined },
    { ...ROW, clause_type: 7 },
  ];

  for (const row of malformed) {
    assert.equal(
      asRedLineEntry(row),
      null,
      `a malformed row became an entry: ${JSON.stringify(row)}`,
    );
  }

  assert.equal(asRedLineEntry(null), null);
  assert.equal(asRedLineEntry("arbitration"), null);
  assert.equal(asRedLineEntry([ROW]), null);
});

test("a bad row is left out and counted, and the reader's other red lines survive", () => {
  const { redLines, refused } = redLineEntriesFrom([
    ROW,
    { ...ROW, id: "7f0a1b2c-0000-4000-8000-000000000002", severity: "Severe" },
    {
      ...ROW,
      id: "7f0a1b2c-0000-4000-8000-000000000003",
      clause_type: "non-compete",
      label: "Non-compete or exclusivity",
      severity: "Serious",
    },
  ]);

  assert.equal(refused, 1);
  assert.deepEqual(
    redLines.map((r) => r.clauseType),
    ["arbitration", "non-compete"],
  );
});

test("nothing readable at all is an empty list, not a thrown error", () => {
  assert.deepEqual(redLineEntriesFrom(null), { redLines: [], refused: 0 });
  assert.deepEqual(redLineEntriesFrom([]), { redLines: [], refused: 0 });
});

test("the list reads hardest tier first, then by name", () => {
  // Postgres writes the seeded eight in one statement, so they share a creation
  // time and cannot be ordered on it. The order is settled here instead.
  const { redLines } = redLineEntriesFrom([
    { ...ROW, id: "1", clause_type: "arbitration", label: "Arbitration" },
    {
      ...ROW,
      id: "2",
      clause_type: "non-compete",
      label: "Non-compete",
      severity: "Serious",
    },
    {
      ...ROW,
      id: "3",
      clause_type: "uncapped-indemnity",
      label: "Uncapped indemnity",
      severity: "Critical",
    },
    {
      ...ROW,
      id: "4",
      clause_type: "personal-guarantee",
      label: "Personal guarantee",
      severity: "Critical",
    },
  ]);

  assert.deepEqual(
    inReadingOrder(redLines).map((r) => [r.label, r.severity]),
    [
      ["Personal guarantee", "Critical"],
      ["Uncapped indemnity", "Critical"],
      ["Non-compete", "Serious"],
      ["Arbitration", "Worth knowing"],
    ],
  );
});

test("what the model is told carries no row id", () => {
  const entry = asRedLineEntry(ROW)!;
  const plain = plainRedLine(entry);

  assert.deepEqual(Object.keys(plain).sort(), [
    "clauseType",
    "description",
    "label",
    "severity",
  ]);
});

/* ------------------------------------------------------- adding one of your own */

test("a red line the reader writes becomes an entry at the tier they chose", () => {
  const written = newRedLine({
    label: "  Late delivery penalty on me alone  ",
    description: "  The agreement charges me a daily sum for a late deliverable.  ",
    severity: "Critical",
  });

  assert.equal(written.ok, true);
  if (!written.ok) throw new Error("unreachable");

  assert.deepEqual(written.redLine, {
    clauseType: "late-delivery-penalty-on-me-alone",
    label: "Late delivery penalty on me alone",
    description:
      "The agreement charges me a daily sum for a late deliverable.",
    severity: "Critical",
  });
});

test("an entry with nothing to look for is refused, and says what is missing", () => {
  const nameless = newRedLine({
    label: "   ",
    description: "Something",
    severity: "Serious",
  });
  assert.equal(nameless.ok, false);
  if (nameless.ok) throw new Error("unreachable");
  assert.match(nameless.problem, /name/i);

  const blind = newRedLine({
    label: "Something",
    description: "",
    severity: "Serious",
  });
  assert.equal(blind.ok, false);
  if (blind.ok) throw new Error("unreachable");
  assert.match(blind.problem, /looks like/i);
});

test("an entry at a tier that is not one of the three words is refused", () => {
  for (const severity of ["Severe", "", 2, null, "worth knowing"]) {
    const written = newRedLine({
      label: "Something",
      description: "Something that happens in a document",
      severity,
    });
    assert.equal(
      written.ok,
      false,
      `${JSON.stringify(severity)} was accepted as a tier`,
    );
  }
});

test("an entry too long to print is refused with the length", () => {
  const long = newRedLine({
    label: "x".repeat(LONGEST_LABEL + 1),
    description: "Something that happens in a document",
    severity: "Serious",
  });
  assert.equal(long.ok, false);
  if (long.ok) throw new Error("unreachable");
  assert.match(long.problem, new RegExp(String(LONGEST_LABEL)));

  const wordy = newRedLine({
    label: "Something",
    description: "x".repeat(LONGEST_DESCRIPTION + 1),
    severity: "Serious",
  });
  assert.equal(wordy.ok, false);
});

test("a clause type is a stable identifier, whatever the reader called it", () => {
  assert.equal(clauseTypeFrom("Auto-renewal"), "auto-renewal");
  assert.equal(
    clauseTypeFrom("IP assignment before full payment!"),
    "ip-assignment-before-full-payment",
  );
  assert.equal(clauseTypeFrom("  Spaces   everywhere  "), "spaces-everywhere");

  // The same words give the same identifier every time, or re-adding an entry
  // would make a second one rather than being refused as already there.
  assert.equal(clauseTypeFrom("Kill fee"), clauseTypeFrom("Kill fee"));

  // A label with no latin letters in it still gets one. A reader writing in
  // their own script is not a malformed entry.
  const own = clauseTypeFrom("違約金");
  assert.match(own, /^own-[0-9a-z]+$/);
  assert.equal(own, clauseTypeFrom("違約金"));
  assert.notEqual(own, clauseTypeFrom("解約金"));
});

/* --------------------------------------------------------- whose list it is */

test("a signed-in reader is read against their own list", () => {
  const whose = whichRedLines({
    state: "signed-in",
    userId: "a2c1f0de-0000-4000-8000-000000000001",
    email: "freelancer@example.com",
  });

  assert.equal(whose.which, "the account's own");
  if (whose.which !== "the account's own") throw new Error("unreachable");
  assert.equal(whose.userId, "a2c1f0de-0000-4000-8000-000000000001");
});

test("a reader with no account is read against the seeded list, and loses nothing else", () => {
  assert.equal(whichRedLines({ state: "signed-out" }).which, "the seeded list");
  assert.equal(
    whichRedLines({
      state: "no-accounts",
      missing: ["NEXT_PUBLIC_SUPABASE_URL"],
    }).which,
    "the seeded list",
  );

  // And the seeded list is a working list, not a placeholder: eight clause
  // types, each at one of the three tiers.
  assert.equal(SEED_RED_LINES.length, 8);
  for (const redLine of SEED_RED_LINES) {
    assert.equal(asTier(redLine.severity), redLine.severity);
  }
});
