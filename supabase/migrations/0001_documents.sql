-- 0001 — documents
--
-- The text of one agreement a reader put in, kept so they can come back to it
-- before a renewal conversation. The file itself is never here: it is parsed in
-- the browser and only the extracted text crosses to the server (CLAUDE.md),
-- so this table holds text and a filename and nothing else.
--
-- Row-level security is on and every policy is keyed to auth.uid(), so a row is
-- reachable only by the account that owns it. RLS with no policy denies
-- everything, so all four verbs are written out deliberately below.
--
-- Safe to run once against an empty project. Nothing here drops or alters an
-- existing table.

create table public.documents (
  id uuid primary key default gen_random_uuid(),

  -- The account the row belongs to. Every policy on this table turns on it.
  -- Deleting the account takes its documents with it.
  owner_id uuid not null references auth.users (id) on delete cascade,

  -- What the reader's file was called, or the words standing in for a paste.
  filename text not null check (length(btrim(filename)) > 0),

  -- The parse, as the reader confirmed it. The character offsets a flag cites
  -- are offsets into this exact string, so it is stored verbatim and never
  -- trimmed, re-wrapped or normalised: edit it and every citation moves.
  extracted_text text not null check (length(extracted_text) > 0),

  created_at timestamptz not null default now()
);

comment on table public.documents is
  'One agreement a reader put in, as extracted text. The file itself is never stored.';
comment on column public.documents.extracted_text is
  'Stored verbatim. Flag and citation offsets point into this string.';

-- The library lists an account's documents newest first. This is the index
-- that read serves, and it is also the shape every policy filters on.
create index documents_owner_created_idx
  on public.documents (owner_id, created_at desc);

alter table public.documents enable row level security;

-- Four policies, one per verb, all saying the same thing: the row is yours or
-- it does not exist for you. `to authenticated` is deliberate — a signed-out
-- request matches no policy here and so reads nothing.
--
-- auth.uid() is wrapped in a select so Postgres evaluates it once per
-- statement rather than once per row.

create policy "documents are read by the account that owns them"
  on public.documents
  for select
  to authenticated
  using (owner_id = (select auth.uid()));

create policy "documents are written under the account that owns them"
  on public.documents
  for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

-- using() decides which rows may be changed; with check() decides what they may
-- become. Both are needed, or a row can be handed to another account.
create policy "documents are changed only by the account that owns them"
  on public.documents
  for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "documents are deleted only by the account that owns them"
  on public.documents
  for delete
  to authenticated
  using (owner_id = (select auth.uid()));
