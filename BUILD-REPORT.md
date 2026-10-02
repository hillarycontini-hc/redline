# Build report — Redline v1

**Run started 2026-10-02.** Orchestrated build of `.scratch/redline-v1/spec.md` and the nine
tickets beside it, run unattended. This file is the record of what was built, what was decided
in the product owner's absence, and what could not be verified.

Status is rewritten as the run proceeds. If the run died, the ticket Status lines in
`.scratch/redline-v1/issues/` are authoritative.

---

## Where to start when you sit down

```
corepack pnpm install          # pnpm is not on PATH; see decision D1
corepack pnpm run typecheck
corepack pnpm test
corepack pnpm run build
corepack pnpm run smoke        # fixture contract through the real pipeline
```

---

## Ticket status

| # | Ticket | Status |
|---|---|---|
| 01 | CI keeps every flag honest | **done**, except branch protection (needs you) |
| 02 | Analyse a plain-text document and show cited flags | **done**, verified against the live model |
| 03 | Open a flag and see what it owes you | **done**, verified against the live model |
| 04 | Question box | in progress |
| 05 | PDF and DOCX, with a clear refusal for scanned PDFs | not started |
| 06 | Release gates run against a full gold set | not started |
| 07 | Sign in and see your library | not started |
| 08 | Analyses save and reopen | not started |
| 09 | Editable red lines drive the analysis | not started |

---

## Decisions taken in your absence

### D1 — pnpm is reached through `corepack pnpm`, not `pnpm`

`pnpm` is not on this machine's PATH. `corepack enable pnpm` fails with `EPERM` because it
writes into `C:\Program Files\nodejs`, which needs an administrator. `corepack prepare
pnpm@12.4.1 --activate` succeeded, so `corepack pnpm` runs the exact version
`package.json` pins.

**Why this rather than npm:** installing with npm would write a `package-lock.json` beside the
committed `pnpm-lock.yaml` and the two would drift. CLAUDE.md settles pnpm, so the lockfile stays
pnpm's. Running scripts is the one place either works — `npm run build` and `corepack pnpm run
build` both just invoke the local binary — so the commands in the ticket brief still hold.

**What you may want to do:** install pnpm properly (`npm i -g pnpm@12.4.1`, or run
`corepack enable pnpm` from an elevated shell) and the `corepack` prefix stops being needed.

### D2 — The question box answers from the document's own text only

Ticket 04 and the spec both left this open: may the question box answer from the summary, or
only from the source text? **Source text only.**

**Why:** the summary is itself model output. A citation into the summary proves nothing about the
document, so the chain of evidence closes on itself and the reader is back to trusting us — the
exact thing ADR 0001 exists to prevent. The spec's own recommendation says the same, and the app
shell brief already assumes it. Nothing is lost: the summary is derived from the document, so any
claim the summary supports is a claim the document supports, and the citation can point at the
document instead.

### D3 — Two browser parsing dependencies approved: `pdfjs-dist` and `mammoth`

Ticket 05 is gated on approval of a browser parsing dependency. Both are approved.

- **`pdfjs-dist`** — Mozilla's PDF.js, the parser Firefox itself ships. It reads a PDF's text
  layer in the browser and has no OCR path to switch on by accident, which matters here: OCR is
  excluded on principle, not cost.
- **`mammoth`** — DOCX to text, pure JavaScript, runs in the browser.

**Why these rather than something server-side:** the settled decision in CLAUDE.md is that the
file is parsed in the browser and only extracted text leaves the client. Every server-side parser
would need the file itself, so none of them were candidates.

**The risk I am accepting on your behalf:** PDF text extraction is not perfectly faithful. Word
spacing and line breaks come out of the text layer differently from how they look on the page, so
a sentence the model quotes may not match exactly. This does not produce a wrong citation — it
produces a dropped flag, because the locatability rule removes anything it cannot find. Silence
is the correct failure mode (ADR 0001), so the failure lands on the right side. Watch the drop
log on real PDFs; if good flags are being dropped, the fix is in normalisation, not in loosening
the rule.

### D4 — Two Supabase client dependencies approved: `@supabase/supabase-js` and `@supabase/ssr`

Tickets 07, 08 and 09 need a Supabase client. `@supabase/ssr` is the supported way to carry a
Supabase session through Next.js App Router cookies; doing it by hand means reimplementing cookie
refresh, which is where auth bugs live.

**Why this is a dependency decision and not a product one:** CLAUDE.md already settles Supabase
for auth and database. These are the client libraries for a choice you already made.

### D5 — The working surface is `/read`, and it does not require an account

The app shell brief names `src/app/(app)/layout.tsx` as its target but does not name a URL, and
phase 1 of the spec has no auth at all. So two things had to be decided.

**Where it lives:** `/` stays the landing page, with the design the impeccable round approved,
untouched. The working surface is a new route group at `src/app/(app)/` serving `/read`. "Read"
is the verb `CONTEXT.md` allows — the product reads a document; it does not review or scan one.

**Who can reach it:** anyone. The analysis itself needs no account, because the spec requires the
app to analyse a pasted document with both Supabase variables absent. Signing in adds the library
and the red lines and nothing else.

**How a paste on the landing page reaches it:** the landing entry hands the confirmed text to
`/read` through `sessionStorage` under one key, which `/read` reads once and clears. That keeps
the handoff inside the browser, where the document already is. The alternative — a query
parameter — would put forty pages of someone's contract in a URL, and URLs get logged.

### D6 — The analysis route takes JSON text and refuses a file body

`POST /api/analyze` with `{ documentText }` and no other field, returning the analysis. It
rejects any request whose content type is not JSON, which is how "no route accepts a file body"
is enforced rather than merely intended. There is no upload route and no storage bucket, and
nothing in the build creates one.

Phase 1 analyses against the seeded red lines held on the server. Ticket 09 is what lets a
signed-in reader's own list replace them.

### Verified live: the model call shape you specified works

Before building on it, I sent one minimal request with the exact shape from your answer —
`provider: { order: ["fireworks"], allow_fallbacks: false, require_parameters: true }`,
`reasoning: { effort: "low" }`, `response_format: { type: "json_object" }`.

`HTTP 200`. The response came back with `"provider":"Fireworks"`, so the pin holds rather than
falling through to another host, and JSON mode returned clean JSON. The model id resolved from
`OPENROUTER_MODEL` (`z-ai/glm-5.3-flash`) and is nowhere in the code. Cost of the probe:
$0.0000070.

This matters because `require_parameters: true` makes OpenRouter refuse any provider that cannot
honour every parameter sent. Had Fireworks not supported `reasoning` on this model, the call
would have failed rather than quietly degraded, and the whole build would have been standing on
it.

---

## Blocked, and needs you

### Ticket 01, criterion 4 — a pull request cannot merge while CI is failing

**Everything else in ticket 01 is done and verified green on GitHub.** The workflow runs, the
check is named `Gates`, and run `37055714812` passed on master.

What is missing is branch protection, which is a repository setting rather than code. I tried to
set it and the permission layer blocked the call, which is the right outcome — changing the
settings of a public repository is not something a build should do unattended. I did not look for
a way around it.

**Run this when you sit down** (one command, and it is reversible):

```bash
gh api -X PUT repos/hillarycontini-hc/redline/branches/master/protection \
  -H "Accept: application/vnd.github+json" \
  -f 'required_status_checks[strict]=false' \
  -f 'required_status_checks[contexts][]=Gates' \
  -F 'enforce_admins=false' \
  -F 'required_pull_request_reviews=null' \
  -F 'restrictions=null'
```

Or in the browser: **Settings → Branches → Add branch ruleset** on `master`, tick **Require
status checks to pass**, and add **`Gates`**.

`enforce_admins=false` is deliberate: it lets you still push a hotfix to master directly. Set it
to `true` if you would rather the gate bind you as well.

---

## The smoke run, against the real model

`pnpm smoke` was run against `z-ai/glm-5.3-flash` on the adhesion fixture, which plants one clause
of each of the eight types in `PRD.md` §5.

```
planted      8
caught       8
missed       0
shown        8
verified     8 of 8 source sentences found in the document
refused      0
```

Every Critical and Serious flag came back carrying replacement wording; neither Worth-knowing flag
did. The summary was accurate to the document and made no claim about enforceability.

`pnpm smoke:clean` was run on the fair agreement: **zero flags**, and a summary that correctly
describes a balanced contract. That is the gate that matters most for being believed — a tool
that always finds problems stops being trusted, and nobody reports the failure, they just leave.

### One thing worth watching

On one of four live calls the model returned something the parser refused, and the screen showed
"The reading did not come back in one piece. Try it again." The same document succeeded on retry.

The failure lands on the right side — no fabricated output reached the reader — but a reader
under deadline pressure should not have to guess. **A single automatic retry on a parse failure
is the obvious fast follow**, and it is not in any ticket, so I have not built it. I would not add
it silently: retrying a model call has a cost, and that is your call to make.

### What I could not verify, and why — the desktop layout

Chrome on this machine refuses to resize its window below or above roughly 500px wide; every
`resize_window` call reports success and the viewport does not move. So **I checked the reading
surface at 500px and at 390px, but never at a real desktop width in a browser.**

What I did verify instead, and what still stands:

- Every highlighted span is **verbatim in the document** — checked against all eight flags on a
  live reading, by comparing the rendered mark to the fixture file. That is the invariant, and it
  holds.
- Critical and Serious entries show replacement wording; both Worth-knowing entries say
  "No counter-offer" and show none.
- No horizontal overflow at 390px, and nothing wider than the viewport.
- The sticky document column and the red underline with `box-decoration-break: clone` are in the
  stylesheet and match what `DESIGN.md` specifies.

**Worth half a minute when you sit down:** open `/read` at full width, put the fixture in, and
click a flag near the bottom of the list. The thing to watch is whether the document column holds
its place and the marked sentence is actually on screen. That is the one behaviour I specified and
could not see with my own eyes.
