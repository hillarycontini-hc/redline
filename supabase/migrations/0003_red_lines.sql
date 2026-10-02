-- 0003 — red lines
--
-- The reader's own list of what they refuse to accept. One row per clause type,
-- carrying the tier a match earns. The vocabulary is CONTEXT.md's: "a red line"
-- is an entry in this list, never the product.
--
-- The spec names the stored shape as (clause type, tier). Two further columns
-- are here because the analysis needs them: `description` is what the model is
-- told to look for, so a red line a reader adds themselves is useless without
-- it, and `label` is the words the entry is shown under. The seeded eight carry
-- both in src/lib/analysis/red-lines.ts; a reader's own entry has to carry its
-- own.
--
-- Severity is constrained to the three words and nothing else. There is no
-- numeric column here and there is not going to be one — severity is a word,
-- never a score (CONTEXT.md).
--
-- Row-level security is on and every policy is keyed to auth.uid().
-- Safe to run once against an empty project.

create table public.red_lines (
  id uuid primary key default gen_random_uuid(),

  owner_id uuid not null references auth.users (id) on delete cascade,

  -- Stable identifier, e.g. 'personal-guarantee'. One entry per clause type per
  -- account: a reader's entry replaces the seeded tier rather than joining it
  -- (spec D3), and the unique constraint is what makes that true in the data
  -- rather than only in the code.
  clause_type text not null check (length(btrim(clause_type)) > 0),

  label text not null check (length(btrim(label)) > 0),

  -- Sent to the model verbatim. What this clause looks like in a document.
  description text not null check (length(btrim(description)) > 0),

  -- The three tiers, exactly as CONTEXT.md sets them down.
  severity text not null
    check (severity in ('Critical', 'Serious', 'Worth knowing')),

  created_at timestamptz not null default now(),

  unique (owner_id, clause_type)
);

comment on table public.red_lines is
  'The account''s own list of what it refuses to accept. One entry per clause type.';
comment on column public.red_lines.severity is
  'One of three words. Never a number: severity is a word, not a score.';

create index red_lines_owner_idx on public.red_lines (owner_id);

alter table public.red_lines enable row level security;

create policy "red lines are read by the account that owns them"
  on public.red_lines
  for select
  to authenticated
  using (owner_id = (select auth.uid()));

create policy "red lines are written under the account that owns them"
  on public.red_lines
  for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

-- Re-tiering an entry is an update, and it is the thing this table exists to
-- allow. with check() keeps the row on the account it started on.
create policy "red lines are changed only by the account that owns them"
  on public.red_lines
  for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- A reader may delete a seeded entry outright: the seeded list is a starting
-- value, not a floor (spec D2). Nothing re-seeds it afterwards.
create policy "red lines are deleted only by the account that owns them"
  on public.red_lines
  for delete
  to authenticated
  using (owner_id = (select auth.uid()));
