# Redline

A web app that reads a contract, lease, freelance agreement, or ToS and tells the
reader what they are actually signing.

## Read first

- `research/summary.md` — the user research. Read before deciding what to build.
- `PRD.md` — the brief. Does not exist yet. Read before building once it does.

## Settled decisions — do not reinterpret

- Next.js, Supabase (auth + database), deployed on Vercel.
- The uploaded file is parsed **in the browser**. Only extracted text leaves the
  client. Never add a server-side upload or file-storage path.
- The model is called through **OpenRouter**, never a provider SDK directly.
- Package manager is **pnpm**.
- No Supabase project exists yet. Schema is designed from scratch. Ask before
  running anything that drops or alters existing tables.

## The invariant

Every risk flag cites the exact sentence it came from. **A flag whose source
sentence cannot be shown is a bug**, not a cosmetic gap — fix it rather than
shipping the flag. This is the one property the product exists to prove.

## Scope — build these, then stop

1. Plain-English summary
2. Risky clauses ranked by severity, each showing its exact source sentence
3. A drafted counter-offer for each flagged clause
4. A question box that answers only from the document
5. An editable list of the user's own red lines, which drives the analysis
6. A saved library of past documents

When something looks like the obvious next step and is not on that list, ask
before building it.

## Excluded on purpose

Payments, billing, OCR for scanned documents, and document sharing between
users. This version exists to prove the analysis can be trusted, and none of
these make it more trustworthy. OCR would actively undermine it: a citation is
worthless when the text it points at was misread.

## Standing rules

- Keep credentials in `.env.local`, which is gitignored. Never commit a secret —
  a key is public the moment it is pushed and has to be rotated.
- State only what the document says. Where the text does not support a claim,
  the product does not make it — in summaries, severity, and the question box.
- The OpenRouter model is set via env var. Do not hardcode a model id; ask before
  choosing one.
- Ask before adding a dependency.

## Gotchas

- The default branch is `master`, not `main`.
- The repo is **public**. Assume anything committed is world-readable.
- This folder is inside OneDrive. Expect sync-conflict files; do not commit them.
