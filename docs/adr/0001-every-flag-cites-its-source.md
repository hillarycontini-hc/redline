# 0001 — Every flag cites its source sentence

Status: Accepted · 2026-08-28

## Decision

Every risk flag carries the exact sentence from the uploaded document it came
from, quoted verbatim and locatable in the original text. A flag whose source
sentence cannot be shown is a **bug**, not a formatting gap. It does not ship.

## Alternatives

- **Let the model describe risks in its own words, unquoted.** Reads better and
  never fails to produce output — but nothing the user sees can be checked, so a
  hallucinated clause and a real one look identical.
- **Cite clause or section numbers only.** Cheaper, but sends the user back into
  the document to find what we meant — the work they came to avoid.
- **Quote when convenient, describe when not.** Worst of both: the user cannot
  tell which mode a flag is in, so the quoted ones inherit the doubt.

## Why

The reader can check us. Given a flag, they can find that sentence in their own
contract and confirm it says what we claim — without trusting us, and without a
lawyer. That property is what separates this from a chatbot guess.

It also makes us falsifiable. A wrong flag pointing at a real sentence is a
disagreement the user can settle; a wrong flag pointing at nothing is not.

## Consequences

- **A risk we cannot source is not shown**, even when the model is confident and
  probably right. Silence is the correct failure mode.
- Parsing must preserve text faithfully enough to locate a quote exactly. This is
  why OCR is excluded: a citation into misread text is worse than none.
- Testing becomes mechanical — does every quote appear verbatim in the source?
  That is automatable and belongs in CI.
- Counter-offers and question-box answers inherit the rule; both are claims about
  the document and both must point at text.
- Costs us fluency. Output reads more stilted than an unconstrained model's.
