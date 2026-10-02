# Redline v1 — Spec

**Status: agreed 2026-09-11.** Synthesized from `PRD.md`, `CONTEXT.md`, and ADR 0001 with the
`to-spec` skill. Not published to an issue tracker; the repo has none configured. Adds nothing
the PRD did not decide. The seven grilling decisions listed under Further Notes were accepted
by the product owner and are reflected in `PRD.md`.

Uses `CONTEXT.md` vocabulary throughout: document, source sentence, flag, severity, counter-offer,
question box, library, red lines, gold set, clean document, citation check.

---

## Problem Statement

I am a freelancer who has been burned by a contract before. Now I read everything, slowly and
anxiously, and I still do not know which clauses matter. The client wants it signed by Friday.
A lawyer costs more than the engagement is worth, and pasting it into a chatbot gives me an
answer I cannot check against the document. So I sign it, and I find out what I agreed to a
month later, when the document is signed and I am locked.

## Solution

Redline reads the document before I sign it and tells me what I am actually agreeing to. It
gives me a plain-English summary, flags the risky clauses in three severity tiers, and puts
the exact sentence each flag came from next to it so I can check the claim in my own copy
without trusting the tool. For each serious clause it drafts replacement wording I can send
back. I can ask it questions and get answers that quote the document. I keep my own list of
red lines, the clauses I refuse after being burned, and the analysis respects that list. Past
documents stay in a library so I can come back to them.

The one property the whole product rests on: **every flag cites a source sentence that is
verbatim in the document.** A flag that cannot is a bug and does not ship (ADR 0001).

## User Stories

### Getting a document in

1. As a freelancer, I want to drop a PDF, DOCX, or text file into Redline, so that I do not
   have to copy-paste forty pages.
2. As a freelancer, I want the file parsed in my browser with only the text sent onward, so
   that my signed-name, addressed contract is never stored on someone's server.
3. As a freelancer with a scanned PDF, I want a clear message that Redline cannot read it and
   why, so that I do not get a garbled analysis I might trust.
4. As a freelancer, I want to see the extracted text before analysis runs, so that I can tell
   the parse is faithful to the document I uploaded.

### Understanding what I am signing

5. As a freelancer, I want a plain-English summary of what the document commits me to, so
   that I know what I am agreeing to in one screen.
6. As a freelancer, I want the summary to say only what the document says, so that I am not
   given an opinion dressed as a reading.
7. As a freelancer with a fair contract, I want the summary to say it looks reasonable, so
   that I learn to trust silence and not just flags.

### Flags

8. As a freelancer, I want risky clauses ranked Critical, Serious, and Worth knowing, so that
   I fight the right ones and ignore the rest.
9. As a freelancer, I want each flag to show the exact sentence it came from, quoted verbatim,
   so that I can find it in my own copy and confirm it says what Redline claims.
10. As a freelancer, I want to click a flag and see its source sentence highlighted in the
    document text, so that I can read the surrounding paragraph.
11. As a freelancer, I want each flag to state its consequence plainly, so that I understand
    what happens to me if I sign it as written.
12. As a freelancer, I want severity as a word, not a number, so that I am not shown a
    precision the tool cannot defend.
13. As a freelancer, I want the tool to lower a flag's tier when it is unsure rather than
    hedge the wording, so that every flag reads with the same confidence and I can compare
    them.
14. As a freelancer, I want flags for clauses that are dangerous and not merely unusual, so
    that an odd-but-harmless clause does not crowd out a real one.
15. As a freelancer, I want a flag the tool cannot source to be dropped rather than shown, so
    that everything I see is checkable.

### Counter-offers

16. As a freelancer, I want replacement wording for every Critical and Serious flag, so that I
    have something concrete to send instead of "I don't like this."
17. As a freelancer, I want each counter-offer tied to the same source sentence as its flag, so
    that I know exactly which text I am proposing to replace.
18. As a freelancer, I do not want counter-offers on Worth-knowing flags, so that the output
    stays short and I am not encouraged to fight over nothing.

### Question box

19. As a freelancer, I want to ask a question about the document and get an answer that quotes
    the document, so that I am not guessing which paragraph governs my situation.
20. As a freelancer, I want the tool to say "the document does not address this" when it does
    not, so that I am never given an invented answer.
21. As a freelancer, I want each question answered on its own, so that a wrong turn in one
    question does not poison the next.

### Red lines

22. As a freelancer, I want to start with a sensible default list of red lines, so that the
    first analysis is useful before I have configured anything.
23. As a freelancer who lost a client's IP dispute, I want to add my own red line and set its
    tier, so that the analysis reflects my history and not only the default.
24. As a freelancer, I want my red line to override the default tier for that clause type, so
    that promoting arbitration to Critical actually changes what I see.
25. As a freelancer, I want to delete a default red line, so that a clause I have decided not
    to care about stops appearing.
26. As a freelancer, I want my red lines applied to every document I analyse from then on, so
    that I set them once.

### Library

27. As a freelancer, I want every analysed document saved to my account, so that I can return
    to it before a renewal conversation.
28. As a freelancer, I want a saved document to show the analysis as it was, including the red
    lines in force at the time, so that I can see what I decided on then.
29. As a freelancer, I want to delete a document from my library, so that a contract I no
    longer hold is not lying around.
30. As a freelancer, I want to see only my own documents and red lines, so that nobody else's
    contracts are visible to me and mine are not visible to them.

### Trust

31. As a freelancer, I want Redline never to tell me a clause is enforceable or unenforceable,
    so that I am not misled into treating a reading as legal advice.
32. As a freelancer, I want the product to describe itself as reading the document and not
    as reviewing, scanning, or advising, so that I know what I am and am not getting.

## Implementation Decisions

**Architecture (settled in `CLAUDE.md`, restated here so the spec is self-contained)**

- Next.js on Vercel. Supabase for auth and database. pnpm.
- The file is parsed in the browser. Only extracted text crosses to the server. No route
  accepts a file body. No storage bucket exists.
- The model is called through OpenRouter only. The model id comes from an env var and is never
  hardcoded. Which model is an open question for the product owner.
- Credentials live in `.env.local`. The repo is public.

**The analysis module**

- One module takes `(documentText, redLines)` and returns `(summary, flags[])`. It is the
  single place the model is called for analysis, and the single place the citation check
  runs.
- Each flag carries: clause type, severity tier, source sentence, consequence, and an optional
  counter-offer. Nothing else is shown to the user.
- After the model responds, every source sentence is located in `documentText` after
  normalising whitespace and quote characters. A flag that cannot be located is removed before
  the result is returned. The removal is logged. This is the enforcement point for ADR 0001.
- Counter-offers are generated for Critical and Serious flags only, and carry the same source
  sentence as their flag. They pass through the same locatability rule.
- Severity is one of three strings. No numeric score exists anywhere in the returned shape.

**Red lines**

- A red line is `(clauseType, severityTier)`. The seeded default is the table in PRD §5 with
  unlimited revisions removed (Further Notes, D1). Stored per account. The user may add,
  delete, or change the tier of any entry.
- A user's entry for a clause type replaces the seeded tier for that type. The seeded list is
  a starting value, not a floor.
- The same list applies to every document type. Leases and ToS receive no separate list in v1.

**Question box**

- One module takes `(documentText, question)` and returns `(answer, citations[])`. No
  conversation state. Each citation passes the same locatability rule as a flag.
- When the model cannot ground an answer, the module returns a fixed "the document does not
  address this" response with zero citations. The UI never renders an answer with an empty
  citation list as though it were grounded.

**Library and schema**

- Tables, all with row-level security keyed to the authenticated user: documents (extracted
  text, filename, created time), analyses (summary, flags as structured data, the red lines
  in force at analysis time), red lines (clause type, tier). Schema is designed from scratch;
  no Supabase project exists yet. Ask before anything that alters an existing table.
- Reopening a saved document renders the stored analysis. The model is not called again.

**Copy**

- `CONTEXT.md` is binding. The UI never uses "review," "scan," "risk score," "enforceable,"
  "unenforceable," "legal advice," or "chat."

## Testing Decisions

**What makes a good test here.** A test asserts on what the user could observe: the flags
returned, the sentences they cite, the tier they carry, the answer the question box gives.
It never asserts on prompt text, model internals, or the shape of an intermediate object.

**The seam.** One seam, at the analysis module boundary: `(documentText, redLines)` in,
`(summary, flags[])` out. The question box shares it in shape: `(documentText, question)` in,
`(answer, citations[])` out. Everything above the seam is UI and can be tested by rendering
a fixed result. Everything below it is the model call and is tested only through the gold set.

*Seam confirmed by the product owner, 2026-09-11. It is the highest point in the system where
the invariant can be checked and the only place the model is called.*

**Tests at the seam**

- **Citation check (CI, blocks merge, must be 100%).** For every document in the gold set,
  every source sentence in every flag and every question-box citation is located in the
  document text after normalisation. One miss fails the build.
- **Unlocatable-quote handling (CI).** Given a stubbed model response containing a quote not
  in the document, the flag is absent from the result and the remaining flags are present.
- **Red-line override (CI).** Given a user red line promoting arbitration to Critical and a
  document containing an arbitration clause, the returned flag is Critical and carries a
  counter-offer. Given the auto-renewal red line deleted, no auto-renewal flag is returned.
- **Counter-offer presence (CI).** No Critical or Serious flag without a counter-offer. No
  Worth-knowing flag with one.
- **Ungrounded question (CI).** Given a question the document does not address, the answer is
  the fixed response and citations are empty.

**Tests against the gold set (manual, before each release)**

- **Catches what matters.** Every Critical-tier clause in the gold set is flagged. A miss
  blocks release.
- **Clean documents.** On each of the five clean documents: zero Critical flags, at most two
  flags of any tier, and the summary says the document looks reasonable. A miss blocks
  release.
- **Severity defensible.** Reviewer agrees with the tier on 80% or more of flags and never
  disagrees by two tiers. Tracked per release, not gating.

**Gold set, v1.** Ten real freelance agreements or leases with dangerous clauses identified
in advance, plus five clean documents. Reviewer is the product owner. A lawyer spot-checks the
Critical tier only. Grow the set once the method is proven.

**Prior art.** None. This is the first code in the repo.

## Out of Scope

- **Payments and billing.** Do not make the analysis more trustworthy.
- **Document sharing between users.** Same.
- **OCR.** A citation into misread text is worse than none. Excluded on principle.
- **Legal advice, enforceability opinions.** Redline reports what a document says.
- **Server-side file upload or storage.** Only text leaves the browser.
- **Lease- or ToS-specific red lines.** Accepted and analysed with the same list; nothing is
  designed for them (PRD §6.1, confirmed 2026-09-11).
- **Telling the user which clauses are worth fighting for versus survivable** (PRD §8). Keep
  the four-factor reasoning available per flag so a later version can build on it.
- **Re-running a saved analysis after red lines change, export, copy-to-clipboard.** Fast
  follows, not v1.

## Further Notes

**Phasing.** Three phases, each shippable alone.

1. **Prove the invariant.** Upload and parse, the analysis module with the seeded red lines,
   flags with source sentences, and the CI citation check. No auth, no library. If the
   citation check cannot be held at 100% here, nothing after it is worth building.
2. **Make it usable.** Summary, counter-offers, question box.
3. **Make it personal.** Auth, editable red lines, library.

**Decisions taken 2026-09-11 by the product owner.** The three segment calls in PRD §6 are
confirmed. The confidence rule, "uncertainty changes severity, not tone," is signed off. The
test seam above is confirmed. The grilling round on PRD §4 and §5 was answered "all
recommended," which settles the following:

| # | Decision | Where |
|---|---|---|
| D1 | Uncapped indemnity stays Critical. Unlimited revisions is dropped from the seeded list. Dropping indemnity would leave Redline silent on the clearest unbounded-magnitude clause, which contradicts the four-factor model. | Red lines |
| D2 | PRD §5 is the seeded default, fully editable | Red lines |
| D3 | A user red line overrides the seeded tier | Red lines |
| D4 | Leases and ToS use the same seeded list | Out of Scope |
| D5 | Worth-knowing flags never get a counter-offer | Analysis module |
| D6 | Clean-document threshold: 0 Critical, at most 2 flags, summary says reasonable | Testing |
| D7 | Gold set of 10 plus 5; reviewer is product owner; lawyer spot-checks Critical | Testing |
| D8 | Verbatim means matching after normalising whitespace and quote characters, nothing looser | Analysis module, Testing |
| D9 | Citation check gates CI. Catches-what-matters and clean-documents gate release by hand. Severity-defensible is tracked, not gating | Testing |

**Still open.**

- ~~Which OpenRouter model.~~ Decided 2026-10-02 by the product owner:
  `z-ai/glm-5.3-flash`. It is set in `.env.local` as `OPENROUTER_MODEL` and read
  from the environment; it is never hardcoded, so changing it is a config change
  rather than a code change.
- Whether the question box may answer from the summary or only from the source text.
  Recommendation: source text only, or citations become circular.
- Whether to publish this spec as a GitHub issue. The repo is public and no tracker or triage
  labels are configured.
