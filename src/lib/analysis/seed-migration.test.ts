/**
 * The drift guard between the two copies of the seeded list.
 *
 * supabase/migrations/0004_seed_red_lines_for_a_new_account.sql writes the
 * default eight into a new account by trigger. SEED_RED_LINES in red-lines.ts
 * holds the same eight for the reader who has no account. They are two copies
 * of one list and nothing in the language of either file keeps them equal — so
 * if one is edited and the other is not, a new account would be read against a
 * list that disagrees with the code, and nobody would be told.
 *
 * This test is what tells them. It parses the migration and insists the two
 * agree on every clause type, every tier, every label, every description, and
 * on how many there are.
 *
 * When this fails, the fix is never to edit 0004 — it has already run against
 * the accounts that exist. Change src/lib/analysis/red-lines.ts and add a new
 * migration that brings existing accounts along.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SEED_RED_LINES } from "./red-lines.ts";
import { SEVERITIES } from "./types.ts";
import type { RedLine } from "./types.ts";

const MIGRATION = join(
  process.cwd(),
  "supabase",
  "migrations",
  "0004_seed_red_lines_for_a_new_account.sql",
);

/** One SQL string literal, with a doubled quote read back as one. */
const LITERAL = /'((?:[^']|'')*)'/g;

/** One row of the insert: (new.id, 'clause type', 'label', 'look for', 'tier'). */
const SEEDED_ROW = /\(\s*new\.id\s*,\s*((?:'(?:[^']|'')*'\s*,?\s*)+)\)/g;

/**
 * The seeded rows as the migration writes them.
 *
 * It reads the file rather than being handed the list, because a parser given
 * the answer would prove nothing. A row that does not carry exactly four values
 * fails here rather than being skipped: a skipped row is a drift this test was
 * written to catch.
 */
function seededByMigration(sql: string): RedLine[] {
  const insert = sql.slice(
    sql.indexOf("insert into public.red_lines"),
    sql.indexOf("on conflict"),
  );
  assert.ok(
    insert.length > 0,
    "the migration no longer inserts into public.red_lines — this test is reading the wrong file",
  );

  const rows: RedLine[] = [];

  for (const row of insert.matchAll(SEEDED_ROW)) {
    const values = [...row[1].matchAll(LITERAL)].map((literal) =>
      literal[1].replaceAll("''", "'"),
    );

    assert.equal(
      values.length,
      4,
      `a seeded row carries ${values.length} values, not the four the table takes: ${row[0]}`,
    );

    const [clauseType, label, description, severity] = values;
    const tier = SEVERITIES.find((s) => s === severity);
    assert.ok(
      tier,
      `the migration seeds ${clauseType} at ${JSON.stringify(severity)}, which is not one of the three tiers`,
    );

    rows.push({ clauseType, label, description, severity: tier });
  }

  return rows;
}

function byClauseType(redLines: readonly RedLine[]): RedLine[] {
  return [...redLines].sort((a, b) => a.clauseType.localeCompare(b.clauseType));
}

const sql = readFileSync(MIGRATION, "utf8");
const seeded = seededByMigration(sql);

test("the migration seeds as many red lines as the code holds", () => {
  assert.equal(
    seeded.length,
    SEED_RED_LINES.length,
    `the migration seeds ${seeded.length} red lines and src/lib/analysis/red-lines.ts holds ${SEED_RED_LINES.length}`,
  );
  assert.equal(seeded.length, 8, "PRD §5 is eight clause types, with D1 applied");
});

test("the migration seeds the same clause types as the code", () => {
  assert.deepEqual(
    seeded.map((r) => r.clauseType).sort(),
    [...SEED_RED_LINES].map((r) => r.clauseType).sort(),
  );
});

test("the migration seeds every clause type at the tier the code gives it", () => {
  const inCode = new Map(
    SEED_RED_LINES.map((r) => [r.clauseType, r.severity] as const),
  );

  const disagree = seeded
    .filter((r) => inCode.get(r.clauseType) !== r.severity)
    .map(
      (r) =>
        `[${r.clauseType}] seeded as ${r.severity}, the code says ${inCode.get(r.clauseType)}`,
    );

  assert.deepEqual(disagree, [], disagree.join("\n  "));
});

test("the migration and the code agree on every word of every entry", () => {
  // Labels and descriptions too, not only the tiers: the description is what
  // the model is told to look for, so a drift there is a new account looking
  // for something different from a reader with no account.
  assert.deepEqual(byClauseType(seeded), byClauseType(SEED_RED_LINES));
});

test("the seeding runs once, when the account is made, and never on an empty list", () => {
  // A reader who takes every entry off has decided something. Seeding on an
  // empty list would undo it, so the trigger fires on a new account and
  // nowhere else, and it leaves an entry that is already there alone.
  assert.match(sql, /after insert on auth\.users/);
  assert.match(sql, /on conflict \(owner_id, clause_type\) do nothing/);
});
