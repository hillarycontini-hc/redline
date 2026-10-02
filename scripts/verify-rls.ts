/**
 * Proves, against the running database, that one account cannot read another's
 * rows. One command:
 *
 *   pnpm verify:rls
 *
 * Ticket 07 asks for this to be verified against the database rather than
 * asserted against a test double, and it cannot be verified any other way: a
 * double would be checking that the double behaves, and row-level security
 * lives in Postgres. So this signs in as two real accounts over the ordinary
 * anon key — the same key a browser uses, with no service role anywhere — has
 * each write a row to all three tables, and then has each ask for the other's.
 *
 * It refuses to run unless it has everything it needs. A verification that
 * passes because it had nothing to check is worse than no verification, so
 * there is no skip, no default and no "assumed fine" path.
 *
 * What it needs, in .env.local:
 *
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   REDLINE_RLS_EMAIL_A / REDLINE_RLS_PASSWORD_A
 *   REDLINE_RLS_EMAIL_B / REDLINE_RLS_PASSWORD_B
 *
 * Two accounts you made for this and nothing else. supabase/migrations/README.md
 * says how to make them.
 */
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readSupabaseConfig } from "../src/lib/supabase/config.ts";

const NEEDED = [
  "REDLINE_RLS_EMAIL_A",
  "REDLINE_RLS_PASSWORD_A",
  "REDLINE_RLS_EMAIL_B",
  "REDLINE_RLS_PASSWORD_B",
] as const;

const TABLES = ["documents", "analyses", "red_lines"] as const;

function stop(...lines: string[]): never {
  console.error("");
  for (const line of lines) console.error(line);
  console.error("");
  process.exit(1);
}

// ------------------------------------------------------------ what it needs

const config = readSupabaseConfig();
if (!config.configured) {
  stop(
    `Cannot verify row-level security: ${config.missing.join(" and ")} ${
      config.missing.length === 1 ? "is" : "are"
    } not set.`,
    `There is nothing to check against. Set them in .env.local and run this again.`,
  );
}

const absent = NEEDED.filter((name) => !process.env[name]?.trim());
if (absent.length > 0) {
  stop(
    `Cannot verify row-level security: ${absent.join(", ")} not set.`,
    `This needs two real accounts on the project to check one against the other.`,
    `See supabase/migrations/README.md for how to make them.`,
  );
}

function fromEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) stop(`${name} is not set.`);
  return value;
}

const accounts = [
  {
    name: "A",
    email: fromEnv("REDLINE_RLS_EMAIL_A"),
    password: fromEnv("REDLINE_RLS_PASSWORD_A"),
  },
  {
    name: "B",
    email: fromEnv("REDLINE_RLS_EMAIL_B"),
    password: fromEnv("REDLINE_RLS_PASSWORD_B"),
  },
];

if (accounts[0].email === accounts[1].email) {
  stop(
    `Cannot verify row-level security: both accounts are ${accounts[0].email}.`,
    `One account cannot be kept out of its own rows. Use two different accounts.`,
  );
}

// ------------------------------------------------------------ signing in

interface SignedIn {
  name: string;
  email: string;
  userId: string;
  client: SupabaseClient;
  /** The ids this account wrote, per table. */
  wrote: Record<string, string>;
}

async function signIn(account: {
  name: string;
  email: string;
  password: string;
}): Promise<SignedIn> {
  if (!config.configured) throw new Error("unreachable");

  // A fresh client per account, holding nothing in common: sharing one would
  // let the second sign-in replace the first and the whole run would be one
  // account talking to itself.
  const client = createClient(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });

  if (error || !data.user) {
    stop(
      `Account ${account.name} (${account.email}) could not sign in: ${error?.message ?? "no user came back"}.`,
      `Check the password, and that the account's email has been confirmed.`,
    );
  }

  return {
    name: account.name,
    email: account.email,
    userId: data.user.id,
    client,
    wrote: {},
  };
}

// ------------------------------------------------------------ writing a row

const stamp = `rls-check-${Date.now()}`;

async function writeRows(who: SignedIn): Promise<void> {
  const document = await who.client
    .from("documents")
    .insert({
      owner_id: who.userId,
      filename: `${stamp}-${who.name}.txt`,
      extracted_text: `Written by account ${who.name} to check row-level security. ${stamp}`,
    })
    .select("id")
    .single();

  if (document.error || !document.data) {
    stop(
      `Account ${who.name} could not write to documents: ${document.error?.message ?? "no row came back"}.`,
      `If the table is missing, run the migrations first — supabase/migrations/README.md.`,
    );
  }
  who.wrote.documents = String(document.data.id);

  const analysis = await who.client
    .from("analyses")
    .insert({
      owner_id: who.userId,
      document_id: who.wrote.documents,
      summary: `Written by account ${who.name} to check row-level security. ${stamp}`,
      flags: [],
      red_lines_in_force: [],
    })
    .select("id")
    .single();

  if (analysis.error || !analysis.data) {
    stop(
      `Account ${who.name} could not write to analyses: ${analysis.error?.message ?? "no row came back"}.`,
    );
  }
  who.wrote.analyses = String(analysis.data.id);

  const redLine = await who.client
    .from("red_lines")
    .insert({
      owner_id: who.userId,
      // Unique per run and per account, so this never collides with a real
      // entry or with the other account's.
      clause_type: `${stamp}-${who.name}`,
      label: `Row-level security check ${who.name}`,
      description: `Written by account ${who.name} to check row-level security.`,
      severity: "Worth knowing",
    })
    .select("id")
    .single();

  if (redLine.error || !redLine.data) {
    stop(
      `Account ${who.name} could not write to red_lines: ${redLine.error?.message ?? "no row came back"}.`,
    );
  }
  who.wrote.red_lines = String(redLine.data.id);
}

// ------------------------------------------------------------ the check

interface Finding {
  table: string;
  reader: string;
  owner: string;
  passed: boolean;
  detail: string;
}

async function cannotRead(
  reader: SignedIn,
  owner: SignedIn,
  table: string,
): Promise<Finding> {
  const rowId = owner.wrote[table];

  const { data, error } = await reader.client
    .from(table)
    .select("id")
    .eq("id", rowId);

  // Row-level security does not refuse — it hides. A select for a row the
  // reader does not own comes back with no error and no rows, which is why
  // this asserts on what came back rather than on whether it failed.
  if (error) {
    return {
      table,
      reader: reader.name,
      owner: owner.name,
      passed: false,
      detail: `the read errored instead of returning nothing: ${error.message}`,
    };
  }

  const found = data?.length ?? 0;
  return {
    table,
    reader: reader.name,
    owner: owner.name,
    passed: found === 0,
    detail:
      found === 0
        ? "returned nothing"
        : `RETURNED ${found} ROW${found === 1 ? "" : "S"} belonging to account ${owner.name}`,
  };
}

async function ownRowIsVisible(who: SignedIn, table: string): Promise<Finding> {
  const { data, error } = await who.client
    .from(table)
    .select("id")
    .eq("id", who.wrote[table]);

  const found = data?.length ?? 0;
  return {
    table,
    reader: who.name,
    owner: who.name,
    passed: !error && found === 1,
    detail: error
      ? `could not read its own row: ${error.message}`
      : found === 1
        ? "read its own row"
        : `found ${found} of its own rows, expected 1`,
  };
}

// ------------------------------------------------------------ clearing up

async function removeRows(who: SignedIn): Promise<void> {
  for (const table of TABLES) {
    const rowId = who.wrote[table];
    if (!rowId) continue;
    const { error } = await who.client.from(table).delete().eq("id", rowId);
    if (error) {
      console.warn(
        `  left behind: ${table} ${rowId} written by account ${who.name} (${error.message})`,
      );
    }
  }
}

// ------------------------------------------------------------ the run

const rule = (ch = "-") => console.log(ch.repeat(78));

console.log(`\nRedline — row-level security, against the running database`);
rule("=");
console.log(`project          ${config.url}`);
console.log(`key              anon, the same one a browser uses`);
console.log(`accounts         ${accounts[0].email}, ${accounts[1].email}`);
console.log(`tables           ${TABLES.join(", ")}`);
rule();

const a = await signIn(accounts[0]);
const b = await signIn(accounts[1]);

if (a.userId === b.userId) {
  stop(
    `Both sign-ins landed on the same account (${a.userId}).`,
    `There is nothing to check. Use two different accounts.`,
  );
}

console.log(`signed in        A ${a.userId}`);
console.log(`                 B ${b.userId}`);

await writeRows(a);
await writeRows(b);
console.log(`wrote            one row per table, per account`);
rule();

const findings: Finding[] = [];
for (const table of TABLES) {
  findings.push(await ownRowIsVisible(a, table));
  findings.push(await ownRowIsVisible(b, table));
  findings.push(await cannotRead(a, b, table));
  findings.push(await cannotRead(b, a, table));
}

for (const f of findings) {
  const what =
    f.reader === f.owner
      ? `${f.table}: account ${f.reader}, own row`
      : `${f.table}: account ${f.reader} reading account ${f.owner}'s row`;
  console.log(`${f.passed ? "ok  " : "FAIL"}  ${what.padEnd(52)} ${f.detail}`);
}

rule();
await removeRows(a);
await removeRows(b);
console.log(`cleared up       the rows this run wrote`);

const failed = findings.filter((f) => !f.passed);

if (failed.length === 0) {
  console.log(
    `\nRow-level security holds. ${findings.length} checks across ${TABLES.length} tables: ` +
      `each account read its own rows and none of the other's.\n`,
  );
  process.exit(0);
}

stop(
  `ROW-LEVEL SECURITY IS NOT HOLDING. ${failed.length} of ${findings.length} checks failed.`,
  ...failed.map((f) => `  ${f.table}: account ${f.reader} ${f.detail}`),
  `Do not put real documents in this project until this passes.`,
);
