# Gold set

The held-out documents the eval suite measures against. PRD §4, spec §Testing Decisions.

**Target for v1:** 10 real freelance agreements or leases with dangerous clauses identified
in advance, plus 5 clean documents. Reviewer is the product owner; a lawyer spot-checks the
Critical tier.

## Layout

```
gold-set/
  <name>/
    document.txt    the document text, exactly as the browser parser would produce it
    analysis.json   the model's raw response for that document (summary + flags)
    expected.md     optional: which clauses a reviewer identified, and their tier
```

## What runs in CI

`pnpm test:citations` reads every `<name>/analysis.json` and checks that every
`sourceSentence` is found verbatim in `<name>/document.txt`, after normalising whitespace and
quote characters. One miss fails the build. This is PRD §4.1.

## What runs by hand before a release

- **4.2** Every Critical clause in `expected.md` appears in `analysis.json`.
- **4.4** On each clean document: zero Critical flags, at most two flags, summary says the
  document looks reasonable.
- **4.3** Reviewer agrees with the tier on 80%+ of flags, never off by two. Tracked, not gating.

## Adding a document

1. Strip anything that identifies a real party. These files are public.
2. Save the text as `document.txt`. Do not tidy it: the point is to test real extraction output.
3. Run the analysis once and save the raw model response as `analysis.json`.
4. If a reviewer has identified the clauses, record them in `expected.md`.

`sample-contractor-agreement` is a synthetic fixture so the check has something to run
against from day one. It is not evidence of anything. Replace it with real documents.
