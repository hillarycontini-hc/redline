# Build report — Redline v1

**All nine tickets are built. 190 tests pass, the build is clean, and the fixture contract goes
through the real model end to end with 8 of 8 source sentences verified.**

**Four things need you**, in the order I would do them: run the Supabase migrations, supply ten
real gold-set documents, switch on branch protection, and look at the desktop layout once.

---

## The four things that need you

| | What | Why it is yours | Where |
|---|---|---|---|
| 1 | **Run the Supabase migrations** | No project exists. Nine criteria across tickets 07–09 cannot be demonstrated without one. | `supabase/migrations/README.md` |
| 2 | **Ten real gold-set documents** | A synthetic document tests Redline against whoever wrote it. `pnpm gates` exits non-zero until they arrive, by design. | `gold-set/README.md` |
| 3 | **Switch on branch protection** | A repo setting, not code. My attempt was blocked, correctly, for an unattended build. | one `gh` command, below |
| 4 | **Look at `/read` at desktop width** | Chrome would not resize on this machine, so I verified the layout at 390px and 500px only. | 30 seconds |

[CONFIRM] One open question I could not answer: **is email confirmation on for the Supabase
project?** If it is, sign-up ends on "open the link we emailed you" rather than landing in the
library. The code handles both; which one a reader meets is a project setting.

---

## Where to start when you sit down

```
corepack pnpm install          # pnpm is not on PATH; see decision D1
corepack pnpm test             # 190 tests
corepack pnpm run build
corepack pnpm run smoke        # the fixture contract through the real model
```

Then, once the Supabase project exists:

```
corepack pnpm verify:rls       # proves no account can read another's rows
```

---

## Ticket status

| # | Ticket | Status |
|---|---|---|
| 01 | CI keeps every flag honest | **done**, except branch protection (needs you) |
| 02 | Analyse a plain-text document and show cited flags | **done**, verified against the live model |
| 03 | Open a flag and see what it owes you | **done**, verified against the live model |
| 04 | Question box | **done**, verified against the live model |
| 05 | PDF and DOCX, with a clear refusal for scanned PDFs | **done**, verified in a browser on a real PDF |
| 06 | Release gates run against a full gold set | **mechanism done**; the set needs real documents |
| 07 | Sign in and see your library | **built**; sign-up and RLS need your project |
| 08 | Analyses save and reopen | **built**; saving, listing, deleting need your project |
| 09 | Editable red lines drive the analysis | **built**; the demo needs your project |

Nothing was blocked twice. Nothing was abandoned.

---

## The invariant, end to end

ADR 0001 says a flag whose source sentence cannot be shown is a bug. Four things now enforce it,
at four different depths:

1. **The seam** drops an unlocatable flag before anything sees it, and records the refusal.
2. **CI** fails the build if a recorded source sentence is not in its document, naming the quote.
3. **Storage** re-checks every flag's range on the way in and on the way out, so a citation cannot
   stop being checkable by being saved.
4. **`pnpm smoke`** exits non-zero if a live reading cites a sentence that is not there.

Latest live run: **8 planted, 8 caught, 8 of 8 verified, 0 refused**, and both question-box answers
quoting real sentences.

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

### The shared provider pool rate-limits this model, hard

Three of my live checks came back `429` from Fireworks:

> `z-ai/glm-5.3-flash is temporarily rate-limited upstream ... limit_source: upstream_provider_shared_pool`

Because the provider is pinned with `allow_fallbacks: false` — which you asked for, and which is
right, since a fallback host would quietly give the same document a different reading — there is
no second provider to absorb this. The call fails instead.

The build handles it correctly: a `429` is now its own error with its own words, so a reader is
told the service is busy rather than being sent to look for a fault in their document. But this
will reach real readers under deadline pressure.

**The remedy OpenRouter itself suggests is a bring-your-own-key integration** — add a Fireworks
key at `https://openrouter.ai/settings/integrations` and the limits become yours rather than the
shared pool's. That is an account change with a cost attached, so it is yours to make, not mine.

### D7 — PDF.js's `legacy` build, and why the extra 1.2 MB is right

The PDF path imports `pdfjs-dist/legacy/build/pdf.mjs` rather than the generic build. That carries
about 1.2 MB of polyfill, so it needs a reason.

The generic build calls `Uint8Array.prototype.toHex`, which Node 24 does not have — it throws on
every document under `node --test` — and which only reached browsers in late 2025. Two
consequences, and the second is the one that decided it:

1. The test suite could not run the real parser at all. It would have had to mock `pdfjs-dist`,
   which is mocking the thing under test, and would have proved nothing.
2. Any reader a year behind on their browser would get a failure rather than a reading.

The cost is paid only by someone who actually opens a PDF — `pdf.ts` is a dynamic import, so a
reader who pastes their agreement never downloads a byte of it. **If you later decide to require
a 2026-or-newer browser, switching to the generic build is a one-line change and saves 1.2 MB.**

### D8 — A third refusal: the file that will not open

A damaged or password-locked PDF was going to be reported as a scan. Those are different problems
with different things to do about them, and telling someone their contract is a photograph when it
is actually password-locked sends them looking in the wrong place. There are now three outcomes: a
kind we do not read, a PDF whose pages are pictures, and a file that would not open at all.

### A latent bug caught on the way through ticket 05

Git was corrupting the hand-built PDF fixture. `text=auto` reads a file as text when it is mostly
ASCII and carries no NUL byte, which a small PDF is, so it was converting line endings on
checkout. A PDF's cross-reference table is a list of byte offsets into the file, so one converted
line ending shifts every offset after it and the document stops opening.

A fresh checkout already differed from the working tree at byte 9. The parse tests passed here and
would have failed on your machine. `.gitattributes` now says `*.pdf binary` and `*.docx binary`
explicitly, and all four binary fixtures were verified byte-identical across a fresh checkout.

Worth knowing because it is the same class of problem as the LF pinning at the start of this run:
**the thing that breaks a build like this is rarely the code, it is the bytes arriving different
on the next machine.**

---
## A defect the release gate caught, and the fix

**The gate earned its keep on its first live run.** It failed `clean-agreement` on the one
condition that matters most for being believed: the summary did not say the document looks
reasonable.

`PRD.md` §4.4, spec decision D6 and `PRODUCT.md` principle 4 all require it. A reader who sees an
empty flag list and a neutral description cannot tell "we found nothing" from "it did not work",
and the research is explicit that the second reading is the one that loses trust silently.

### What was actually wrong

The analysis prompt had asked for this all along, as rule 6, in a single clause at the end of a
seven-rule list. The model was dropping it. Measured over live readings of the fair fixture:

| Prompt | Readings that said it |
|---|---|
| Original rule 6 | 0 of 2 |
| Rule 6 made explicit — the sentence must come first | 5 of 7 |
| Rule 6 demanding the exact sentence, word for word | **5 of 5** |

The middle row is the interesting one. Every reading did open with a verdict, but two of seven
phrased it as "this freelance agreement is **favorable to the contractor** on the points checked."

### Why I did not widen the gate to accept that

It would have been the easy fix and it would have been wrong. "Favourable to the contractor" reads
as a pass only because the contractor happens to be the reader here. The same phrase shaped
"favourable to the client" is the **opposite** verdict, and a gate that accepted both would pass a
document it should fail. The phrase list in `gates.ts` is deliberately narrow, and it stays narrow.

So the fix went into the prompt rather than the gate: rule 6 now names the exact sentence and
tells the model not to reword it or say which party it favours.

**`pnpm gates` now passes all three documents against the live model.** The run still exits
non-zero, correctly, because the gold set holds no real documents — see below.

### The durable fix, which is still yours to make

Matching prose is a weak mechanism even when it works. If you want this to stop depending on
wording, have the analysis return a structured verdict alongside the summary and let the gate read
that. I did not do it: it changes the shape the analysis returns, and every screen and stored
analysis downstream, which is more than a gate deserves to drive on its own.

---

## The gold set is the one thing this build could not supply

`pnpm gates` runs, reports per document, and gates correctly. **It has nothing real to run
against.**

The target is ten real freelance agreements or leases with their dangerous clauses identified in
advance, plus five clean documents. The set holds three synthetic documents and zero real ones. A
synthetic document tests Redline against the imagination of whoever wrote it, not against how
contracts are really drafted, so it proves the gates run — not that they were cleared.

I did not invent documents, relabel the synthetic ones, or lower the target. Every entry declares
its own provenance, synthetic never counts, and the runner prints the shortfall twice per run:

```
real documents   0 of 10 dangerous, 0 of 5 clean. 15 short of what a release needs (PRD 4.5).
```

A short set exits non-zero by design, and there is no flag to silence it. A release gate that
printed "pass" against zero real documents would be the exact failure the ticket warns about.

**This is why `pnpm gates` must stay out of CI for now** — it would fail every build. Put it in
once the real documents land.

### What I need from you

Ten real agreements or leases, stripped of anything identifying a real party, with their dangerous
clauses identified before Redline reads them. `gold-set/README.md` documents the layout and the
manifest. Five fair ones matter just as much: the clean-document gate is the one that catches
Redline becoming a tool that always finds something.

---

## What Supabase being absent means for tickets 07, 08 and 09

There is no Supabase project, so there was no database to build against at any point in this run.
Everything below is written, typechecked, and reasoned about, and **none of it has been run against
a real Postgres.** Treat that as the known risk in this part of the build.

### What I did verify, with the variables absent

- `pnpm build`, `pnpm test` and `pnpm dev` all work. `/`, `/read`, `/sign-in` and `/library` each
  return 200.
- **`POST /api/analyze` still returns a full reading** — 8 flags, 0 dropped, 8 of 8 source
  sentences verbatim in the document. Adding accounts did not touch the path that works without
  one, which was the thing most likely to break.
- `/library` and `/sign-in` say, in plain words, that this copy has no accounts set up, that
  nothing has gone wrong at the reader's end, and that reading a document still works. A quiet last
  line names the two unset variables for whoever runs the site.
- `pnpm verify:rls` refuses to run and exits non-zero when the variables are missing, rather than
  passing vacuously.

### What I verified by pointing it at a fake project

With both variables set to values that are syntactically valid and resolve to nothing, a
signed-out request for `/library` returned **`307 → /sign-in?next=%2Flibrary`**. The guard is
server-side; it does not rely on hiding a link.

### What nobody can verify until you run the migrations

**Ticket 07, criterion 1** — sign up, sign out, sign back in, session survives a reload. The wiring
is `@supabase/ssr` with cookies plus `src/proxy.ts` for refresh, which is the supported shape for
Next 16. No account was ever created, so the demo is not claimed.

**Ticket 07, criterion 5** — a read for another user's row returns nothing, *verified against the
running database*. The criterion says explicitly that a test double does not count, and it is
right. I did not write one and call it verification.

**`pnpm verify:rls` is there to settle it in one command.** It signs in as two test accounts over
the anon key, has each write a row to all three tables, then has each ask for the other's rows,
and fails loudly if anything comes back. It never touches the service-role key, which would bypass
the very thing it is checking.

### The order to run things

```
1. Create the Supabase project.
2. Put NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.
3. Run supabase/migrations/0001 … 0004 in order. See supabase/migrations/README.md.
4. Create the two test accounts that README names.
5. corepack pnpm verify:rls      <- this is the one that proves the isolation
```

### One question the schema cannot answer for itself

**Is email confirmation on for the project?** If it is, sign-up ends on "open the link we emailed
you" rather than landing in the library, and ticket 07's demo reads differently. The code handles
both; which one a reader meets is a project setting, and it is yours.

---

## Ticket 09 — what the last ticket did

The screen is at `/red-lines`, reached from the account head. A signed-in reader is read against
their own list; everyone else against the seeded one. The list is read on the server, because a
list posted back from the browser is hearsay and this one decides what the reader is shown.

Three tests prove it against the fixture: arbitration promoted comes back **Critical carrying
wording to send**, auto-renewal removed comes back **not at all**, and an added entry flags at the
tier it was given.

**A drift guard I added that was not asked for in those words.** The seeded list existed twice —
once in TypeScript, once in the SQL that seeds a new account — with nothing holding them together.
A new account would have quietly got a list disagreeing with the code. A test now parses the
migration and holds it to the code on count, clause type, tier, and every word of every entry. I
verified it bites by changing one tier in the SQL and watching it fail by name.

---

## What I could not verify, gathered in one place

Nine criteria across three tickets need a running Supabase project. **I wrote no test double and
presented it as verification anywhere.** Where a criterion needed a database, it is unticked.

| Ticket | Criterion | Needs |
|---|---|---|
| 07 | Sign up, sign out, sign back in; session survives reload | a project |
| 07 | A read for another user's row returns nothing | a project — `pnpm verify:rls` settles it |
| 08 | Saving, listing, deleting a document | a project |
| 09 | A new account is seeded; edits survive signing out | a project |
| 06 | Ten real dangerous documents, five clean | real documents from you |

Everything that could be pulled below the database line **is** tested for real: serialisation,
validation, the gate, the id check, the round trip, and the import-graph walk proving a reopened
reading cannot reach the model.

Two things about the desktop layout and the provider rate limit are covered in their own sections
above.

---

## Branch protection, the exact command

```bash
gh api -X PUT repos/hillarycontini-hc/redline/branches/master/protection \
  -H "Accept: application/vnd.github+json" \
  -f 'required_status_checks[strict]=false' \
  -f 'required_status_checks[contexts][]=Gates' \
  -F 'enforce_admins=false' \
  -F 'required_pull_request_reviews=null' \
  -F 'restrictions=null'
```

Or: **Settings → Branches → Add branch ruleset** on `master`, tick **Require status checks**, add
**`Gates`**.

**Do not add `pnpm gates` to CI yet.** It exits non-zero by design while the gold set holds no real
documents, so it would fail every build. Add it once they land.

---

## Three things I would look at next, none of them built

I stopped at the ticket boundary rather than deciding these for you.

1. **One automatic retry on a model parse failure.** The reader currently sees "the reading did not
   come back in one piece" and retries by hand. Retrying costs money, so it is your call.
2. **A bring-your-own-key Fireworks integration.** The shared pool rate-limited me repeatedly, and
   with `allow_fallbacks: false` there is no second provider to absorb it. This moves the limits to
   your account.
3. **A structured verdict instead of matching prose.** The clean-document gate reads the summary
   for a sentence. Having the analysis return the verdict as a field would be sturdier, but it
   changes the shape every screen and every stored reading depends on.
