# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary user: a freelancer or independent contractor about to sign a client
agreement, who has been burned by one before.** They already lost money or time to
a contract they did not read closely enough. Now they read everything — slowly,
anxiously, and without knowing which clauses matter. The signing deadline is
usually days away and their negotiating position is weak.

Not first-time signers, and not people who have already signed. Renters are
accepted users — Redline will read a lease — but nothing is designed for them: not
the seeded red lines, not the counter-offers, not the price (PRD §6.1).

What they do instead today: read it themselves; sign it anyway; paste it into a
general-purpose chatbot, which is the real competitor and was never examined in
research; or pay a lawyer $200–$600 for a freelance contract review, which is
priced out of a $3,000 engagement.

## Product Purpose

Redline reads a document — a contract, lease, freelance agreement, or terms of
service — before signature and tells the reader what they are actually agreeing
to. It exists to prevent the moment the research kept finding: discovering what
you agreed to a month later, when the document is signed and you are locked.

Success is defined by four gates (PRD §4): every flag cites real text, 100%,
enforced in CI; every Critical clause in the gold set is caught; severity is
defensible to a qualified reviewer on 80%+ of flags; and on a clean document
Redline stays quiet.

## Positioning

**Every flag quotes the exact sentence it came from, verbatim and locatable in the
reader's own copy.** The reader can check the claim without trusting the tool and
without a lawyer. That makes Redline falsifiable: a wrong flag pointing at a real
sentence is a disagreement the reader can settle, while a wrong flag pointing at
nothing is not. A tool that describes risks in its own words cannot offer this,
and that is the property a neighboring product cannot truthfully copy.

No existing product serves one person with one document. The cheapest credible
tool found in research was Genie AI at $75/mo; LegalOn is $550/mo for an
individual. Everything else is seat- or enterprise-priced.

## Operating Context

Pre-signature only, under deadline pressure — the client wants it signed by
Friday. The document is one the reader already holds, as a PDF, a Word file, or
text they paste. Parsing happens in the reader's own browser; only extracted text
leaves the client, and no file is ever uploaded or stored server-side.

A reader may return to a saved analysis later, before a renewal conversation, and
expects to see what it showed at the time, including the red lines in force when
it ran.

## Capabilities and Constraints

**In scope, and nothing beyond it:** a plain-English summary; flags ranked by
severity, each showing its source sentence; a counter-offer for each Critical and
Serious flag; a question box answering only from the document; an editable list of
the reader's red lines that drives the analysis; and a library of past documents.

**Severity is exactly three tiers** — Critical, Serious, Worth knowing — as words,
never a number. A clause earns a tier on four factors: irreversibility, magnitude,
asymmetry, and surprise. A clause scoring high on surprise alone is unusual, not
dangerous, and unusual is not a flag.

**Technical constraints:** Next.js on Vercel, Supabase for auth and database,
pnpm. The model is called through OpenRouter only, with the model id from an env
var, never hardcoded. Row-level security keys every table to the authenticated
user. One analysis seam: `(documentText, redLines)` in, `(summary, flags[])` out.

**Terminology is binding.** `CONTEXT.md` governs the words used in code, tests,
and copy — including the hazard that "Redline" is the product while "a red line"
is one entry in the reader's own list.

**Excluded on purpose:** payments, billing, document sharing, OCR, legal advice,
enforceability opinions, server-side upload or storage, lease- and ToS-specific
red lines, and any judgment about which clauses are worth fighting for. OCR is
excluded on principle, not cost: a citation into misread text is worse than none
because it looks verifiable.

**Explicitly undecided — do not invent these:** pricing and packaging; and whether
the question box may answer from the summary or only from the document's own text.

The OpenRouter model was decided on 2026-10-02: `z-ai/glm-5.3-flash`, carried in
`OPENROUTER_MODEL` and never hardcoded.

## Brand Commitments

The product is named **Redline**.

Words the product never uses: "legal advice", "review", "counsel", "enforceable",
"unenforceable", "scan", "risk score", "chat". DoNotPay drew an FTC action and a
$193K settlement for overclaiming here, and that is the cautionary case on record.

Voice rules that are product truth, not taste:

- State the clause and its consequence plainly. Hedge on enforceability and
  outcome, never on what the document says.
- Uncertainty changes severity, not tone. An unsure model lowers the tier rather
  than adding hedging language, so every flag reads with equal confidence and the
  reader can compare them.
- All copy a reader sees — landing page, UI labels, error messages, empty states —
  must pass the humanizer skill before it is committed. Copy that reads as though
  a model wrote it is a defect, not a matter of taste.

## Evidence on Hand

Real, and usable: the user research in `research/`, carrying verbatim quotes from
r/PetPeeves, r/TimeshareOwners, and Blind, plus competitor pricing and the
Freelancers Union non-payment figures. The gold set at `gold-set/` holds one
synthetic fixture against a v1 target of ten dangerous documents plus five clean
ones.

**Absences future work must not fill with invention:**

- Zero freelancer testimony, across two research runs, for the segment this
  product commits to. Both failures were mechanical.
- Zero primary willingness-to-pay data. Nobody said they would pay anything. The
  $10–$40/document band is inferred, not observed.
- A general-purpose chatbot was never examined, though it is the most likely
  reason a prospect declines to pay.
- No frequency data for liability caps, indemnity, exclusivity, or fee
  escalators. Uncapped indemnity is Critical on structural reasoning alone.

No customers, testimonials, benchmarks, or press exist. The sample contractor
agreement in the gold set is synthetic and is not evidence of anything.

## Product Principles

1. **Silence is the correct failure mode.** A risk that cannot be sourced is not
   shown, even when the model is confident and probably right.
2. **Dangerous, not unusual.** An odd-but-harmless clause must not crowd out a
   real one.
3. **Uncertainty changes severity, not tone.**
4. **Stay quiet on a clean document.** A tool that always finds problems stops
   being believed, and that failure is invisible — nobody reports inflated flags,
   they just leave.
5. **Only what the document says.** Where the text does not support a claim, the
   product does not make it — in summaries, severity, or the question box.

## Accessibility & Inclusion

No product-specific accessibility standard is established. Asked and answered
during init on 2026-10-02: the product owner set no conformance target. Future
work must not claim a conformance level the product has not committed to, and
must not infer one from this absence.
