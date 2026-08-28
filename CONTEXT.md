# Redline — Domain Vocabulary

The words this project uses, and what they mean. Use these terms in code, tests, issues, and
UI copy. Where a synonym is listed as avoided, don't drift to it.

**Status: proposed, not agreed.** Extracted from `PRD.md`. The grilling round that would have
settled this vocabulary went unanswered, so these are working definitions. Change them freely —
but change them *here*, so the rest of the project follows.

---

## Naming hazard: "Redline" vs "red lines"

Two different things, one word apart. Keep them apart in code and copy.

- **Redline** — the product.
- **A red line** — one entry in the user's own editable list of what they refuse to accept.
  Always plural-able, always possessive in prose ("their red lines"). In code, prefer
  `userRedLine` / `redLines` and never bare `redline` for this concept.

---

## Core terms

**Document** — the file the user uploads: a contract, lease, freelance agreement, or terms of
service. Parsed in the browser; only the extracted text is stored. "Document" always means the
user's own uploaded thing, never a published policy we fetched.

**Source sentence** — the exact, verbatim sentence from the document that a flag came from.
Must be locatable in the parsed text. A flag without one is a bug, not a formatting gap
(ADR 0001).

**Flag** — one identified risk, tied to exactly one source sentence, carrying a severity tier
and usually a counter-offer. Prefer "flag" over "issue", "finding", or "risk item".

**Severity** — which of three tiers a flag carries. Not a number, not a score. Avoid "risk
score" — a numeric score implies a precision we cannot defend.

**Counter-offer** — drafted replacement language the user can send to the other side. Not a
"suggestion" and not "advice".

**Question box** — the feature that answers questions using only the document, with a citation.
Avoid "chat" — it implies open-ended conversation, and this is document-grounded only.

**Library** — the user's saved past documents.

---

## Severity tiers

Exactly three. Use these strings.

| Tier | Meaning | Counter-offer |
|---|---|---|
| **Critical** | Irreversible, unbounded, or survives the engagement | Always |
| **Serious** | Materially one-sided, bounded but costly | Always |
| **Worth knowing** | Present and worth seeing, not worth fighting | Not required |

**Uncertainty changes severity, not tone.** When the model is unsure a clause is risky, it
lowers the tier. It does not hedge the language.

---

## What makes a clause dangerous

Four factors. A clause is **dangerous** when it scores high on several; a clause scoring high on
**surprise alone** is merely **unusual**, and unusual is not a flag.

1. **Irreversibility** — can the user get out, and at what cost?
2. **Magnitude** — is exposure bounded, and bounded relative to the deal's value?
3. **Asymmetry** — does it bind one party only?
4. **Surprise** — does it deviate from what's normal for this document type?

"Dangerous" and "unusual" are not interchangeable. The distinction is the whole severity model.

---

## Evaluation terms

**Gold set** — the held-out collection of real documents with known dangerous clauses,
independently identified, that the eval suite measures against.

**Clean document** — a genuinely fair agreement included in the gold set deliberately. Redline
must stay quiet on these. A tool that always finds problems stops being believed.

**Citation check** — the automated test that every source sentence appears verbatim in the
parsed document. Must pass 100%.

---

## Terms we do not use

- **"Legal advice", "review", "counsel"** — Redline reports what a document says. It does not
  advise. DoNotPay drew an FTC action and a $193K settlement for overclaiming here.
- **"Enforceable" / "unenforceable"** — Redline flags a clause; it does not opine on whether a
  court would uphold it.
- **"Scan"** — implies OCR, which is excluded on principle (ADR 0001).
- **"Risk score"** — see Severity.
