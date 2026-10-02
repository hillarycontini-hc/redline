-- 0004 — a new account starts with the seeded red lines
--
-- The default list every account begins with, inserted once when the account is
-- created. PRD §5, signed off 2026-09-11, with unlimited revisions dropped
-- (spec D1).
--
-- **Ticket 09 owns what the reader can then do with the list.** This migration
-- only puts the starting value in place.
--
-- Why a trigger rather than the app seeding on first use: a reader may delete a
-- seeded entry outright, because the seeded list is a starting value and not a
-- floor (spec D2). An app that inserted the defaults whenever it found the list
-- empty would undo that — delete every entry and they would all come back.
-- Seeding once, at account creation, is the only version of this that lets a
-- deletion stick.
--
-- The eight entries below mirror src/lib/analysis/red-lines.ts, which is the
-- same list used for the no-account path on /read. The two copies have one job
-- each: this one is an account's opening balance, that one is what the analysis
-- falls back to when nobody is signed in. If the defaults are ever changed,
-- change red-lines.ts and add a new migration — do not edit this one, because
-- it has already run against the accounts that exist.
--
-- Requires 0003. Safe to run once against an empty project.

create function public.seed_red_lines_for_new_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.red_lines (owner_id, clause_type, label, description, severity)
  values
    (new.id, 'personal-guarantee', 'Personal guarantee',
     'The reader personally guarantees the obligations of a business, so liability survives the business closing or going bankrupt.',
     'Critical'),
    (new.id, 'ip-before-payment', 'IP assignment before full payment',
     'Ownership of the work product transfers to the client on creation or delivery rather than on full payment, so the client owns the work whether or not they pay.',
     'Critical'),
    (new.id, 'uncapped-indemnity', 'Uncapped indemnity',
     'The reader agrees to indemnify, defend, or hold harmless the other party with no cap on the amount, so exposure is unbounded.',
     'Critical'),
    (new.id, 'non-compete', 'Non-compete or exclusivity',
     'The reader is restricted from working with other clients, competitors, or in a field, during or after the engagement.',
     'Serious'),
    (new.id, 'slow-payment-no-late-fee', 'Payment terms worse than net-30 with no late fee',
     'Payment is due more than 30 days after invoice, or on an undefined trigger, and there is no late fee or interest for non-payment.',
     'Serious'),
    (new.id, 'unilateral-termination', 'Unilateral termination with no kill fee',
     'The client can terminate at will, with little or no notice, and owes nothing for work scheduled or in progress.',
     'Serious'),
    (new.id, 'auto-renewal', 'Auto-renewal',
     'The agreement renews automatically unless cancelled within a window, especially a short or unusual one.',
     'Worth knowing'),
    (new.id, 'arbitration', 'Arbitration or class-action waiver',
     'Disputes must go to binding arbitration, or the reader waives the right to join a class action.',
     'Worth knowing')
  -- If an entry for this clause type somehow exists already, leave it alone.
  -- The reader's own tier is never overwritten by a seed.
  on conflict (owner_id, clause_type) do nothing;

  return new;
end;
$$;

comment on function public.seed_red_lines_for_new_account() is
  'Gives a new account the seeded red lines from PRD §5. Mirrors src/lib/analysis/red-lines.ts.';

create trigger seed_red_lines_on_new_account
  after insert on auth.users
  for each row
  execute function public.seed_red_lines_for_new_account();
