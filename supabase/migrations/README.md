# Migrations — run these by hand, in this order

Four files. They create the three tables ticket 07 designed, turn row-level
security on, and give a new account its opening list of red lines. They are
written to be run once, by you, against an empty project. Nothing in the build
assumes they have been run, and nothing in them drops or alters a table that
already exists.

The app does not need them to start. Redline reads a document with no Supabase
configuration at all; these are what the library and the red lines need.

---

## The order

| # | File | What it makes |
|---|---|---|
| 1 | `0001_documents.sql` | `documents` — the extracted text, the filename, the time |
| 2 | `0002_analyses.sql` | `analyses` — the summary, the flags, the red lines in force |
| 3 | `0003_red_lines.sql` | `red_lines` — one entry per clause type, with its tier |
| 4 | `0004_seed_red_lines_for_a_new_account.sql` | the trigger that gives a new account the seeded eight |

`0002` references `documents`, and `0004` references `red_lines`, so the order
is not a suggestion.

---

## Running them

Easiest, and what I would do: the **SQL editor** in the Supabase dashboard.
Open each file, paste it in whole, run it, and check it says success before
moving to the next.

Or, with the Supabase CLI linked to the project:

```bash
supabase db push
```

Or straight at Postgres, with the connection string from
**Project settings → Database**:

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0001_documents.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0002_analyses.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0003_red_lines.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0004_seed_red_lines_for_a_new_account.sql
```

`0004` creates a trigger on `auth.users`, which needs an owner-level role. The
dashboard's SQL editor and the connection string both have one; a connection as
`anon` does not.

---

## Then: prove row-level security actually holds

Every table has RLS on and a policy per verb keyed to `auth.uid()`. That is the
intent. **The only way to know it is true is to ask the database**, and this is
the one thing ticket 07 could not verify for itself — there was no project to
verify against.

So there is a script. It signs in as two real accounts over the ordinary anon
key, has each write a row to all three tables, and then has each ask for the
other's rows. It fails loudly if anything comes back, and it refuses to run at
all if it is not fully configured, rather than passing with nothing to check.

**Make two accounts first.** In the dashboard, **Authentication → Users → Add
user**, twice. Tick *auto-confirm* on both, or confirm the emails, because the
script signs in with a password and an unconfirmed account cannot. Use addresses
you do not mind being in a password file — these exist for this check and
nothing else.

Put them in `.env.local`, which is gitignored:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<the anon key>

REDLINE_RLS_EMAIL_A=rls-a@example.com
REDLINE_RLS_PASSWORD_A=<password>
REDLINE_RLS_EMAIL_B=rls-b@example.com
REDLINE_RLS_PASSWORD_B=<password>
```

Then:

```bash
corepack pnpm run verify:rls
```

A clean run prints `ok` for each check and ends with row-level security holding.
It writes six rows and deletes them again; if a delete fails it says which row
it left behind. It never uses the service-role key — the whole point is to see
the database the way a browser sees it.

If any line says `FAIL`, stop. A failing check means one account can read
another's contracts, and no amount of application code fixes that.

---

## What the seeding trigger does, and what it does not

`0004` inserts the eight default red lines when an account is created. That is
the mechanism; **ticket 09 owns what the reader can then do with the list** —
adding an entry, re-tiering one, deleting one.

It is a trigger rather than the app seeding on first use because a reader is
allowed to delete a seeded entry outright. An app that inserted the defaults
whenever it found the list empty would quietly undo that: delete all eight and
all eight would come back. Seeding once, at account creation, is the only
version where a deletion sticks.

The eight entries mirror `src/lib/analysis/red-lines.ts`, which is the same list
the analysis falls back to when nobody is signed in. If you change the defaults,
change that file and add a **new** migration. Do not edit `0004` — it has
already run against the accounts that exist, and editing it changes nothing for
them.

---

## Accounts that existed before you ran `0004`

The trigger only fires on insert. Any account made before it existed has no red
lines, and will see an empty list. If that is you, re-run the body of `0004` as
a plain insert with that account's id in place of `new.id`.
