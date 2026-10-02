-- 0002 — analyses
--
-- One reading of one document: the plain-English summary, the flags as
-- structured data, and the red lines that were in force when it ran. The last
-- of those is why the analysis is stored rather than recomputed — reopening a
-- saved document shows what it showed then, including the list it was read
-- against (spec, "Library and schema"). The model is never called again.
--
-- Row-level security is on and every policy is keyed to auth.uid(). The table
-- carries its own owner_id rather than reaching through documents: a policy
-- that joins is a policy that can be got round, and this way a row is checked
-- against the account on its own terms.
--
-- Requires 0001. Safe to run once against an empty project.

create table public.analyses (
  id uuid primary key default gen_random_uuid(),

  owner_id uuid not null references auth.users (id) on delete cascade,

  -- The document this reading is of. Deleting the document deletes its
  -- readings: an analysis whose source text is gone cannot show the sentence
  -- each flag came from, and a flag that cannot show its sentence is a bug
  -- (ADR 0001), so it must not outlive the text.
  document_id uuid not null references public.documents (id) on delete cascade,

  summary text not null check (length(btrim(summary)) > 0),

  -- The flags as they were shown, each carrying its clause type, its severity
  -- word, its source sentence, that sentence's character range in the
  -- document's extracted_text, its consequence and its counter-offer. An empty
  -- array is a real and correct result: a fair document earns no flags.
  flags jsonb not null check (jsonb_typeof(flags) = 'array'),

  -- The reader's red lines as at the moment the reading ran. A copy on purpose:
  -- it must not change when the live list in red_lines changes.
  red_lines_in_force jsonb not null
    check (jsonb_typeof(red_lines_in_force) = 'array'),

  created_at timestamptz not null default now()
);

comment on table public.analyses is
  'One reading of one document, kept as it was shown, with the red lines it ran against.';
comment on column public.analyses.red_lines_in_force is
  'A copy taken at read time. Never updated when the live red_lines change.';

create index analyses_owner_created_idx
  on public.analyses (owner_id, created_at desc);

create index analyses_document_idx
  on public.analyses (document_id);

alter table public.analyses enable row level security;

create policy "analyses are read by the account that owns them"
  on public.analyses
  for select
  to authenticated
  using (owner_id = (select auth.uid()));

-- The row must be owned by the writer *and* point at a document the writer
-- owns. The second half is not redundant: without it an account could hang a
-- reading of its own off somebody else's document id.
create policy "analyses are written under the account that owns them"
  on public.analyses
  for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1
      from public.documents d
      where d.id = document_id
        and d.owner_id = (select auth.uid())
    )
  );

create policy "analyses are changed only by the account that owns them"
  on public.analyses
  for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "analyses are deleted only by the account that owns them"
  on public.analyses
  for delete
  to authenticated
  using (owner_id = (select auth.uid()));
