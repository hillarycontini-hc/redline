# Gold set

The held-out documents the eval suite measures against. PRD §4, spec §Testing Decisions.

**Target for v1:** 10 real freelance agreements or leases with dangerous clauses identified
in advance, plus 5 clean documents. Reviewer is the product owner; a lawyer spot-checks the
Critical tier.

**Where it stands: 0 real documents of the 15.** Everything in here is synthetic, written by
the build to give the checks something to run against. A synthetic document tests Redline
against the imagination of whoever wrote it, not against how contracts are really drafted, so
synthetic entries never count toward the 10 or the 5. `pnpm gates` prints the real count
against the target at the top and the bottom of every run, and exits non-zero while the set is
short. Until real documents arrive, nothing in here clears a release.

## Layout

```
gold-set/
  <name>/
    manifest.json   required: where the document came from and what is in it
    document.txt    the document text, exactly as the browser parser would produce it
    analysis.json   the model's raw response for that document (summary + flags)
    expected.md     optional: a reviewer's notes in prose
```

### manifest.json

Every entry has one. An entry without a manifest fails to load, on purpose: a document that
does not say where it came from can be mistaken for evidence.

| Field | Required | What it holds |
|---|---|---|
| `provenance` | yes | `"real"` or `"synthetic"`. Only `real` counts toward the target. |
| `kind` | yes | `"dangerous"` or `"clean"`. |
| `identifiedClauses` | yes, unless `fixture` is set | What a reviewer found before Redline read the document: `clauseType` and the `severity` it should earn. `[]` on a clean document. |
| `fixture` | no | A sidecar filename in `tests/fixtures/`. Set it instead of keeping `document.txt` and `analysis.json` here. |
| `note` | no | Why the document is in the set, and what it is and is not evidence of. |

A dangerous entry has to identify at least one clause, and a clean entry has to identify none.
Both are checked on load.

`expected.md` is prose for a human. `manifest.json` is what the gates read, so a clause only
counts once it is in the manifest.

### Entries backed by a fixture

Two entries — `adhesion-contract` and `clean-agreement` — are the fixtures the unit suite
already runs on. They set `fixture` and hold no document of their own. Their text comes from
`tests/fixtures/<name>.txt`, their identified clauses from the sidecar's `plantedClauses`, and
their recorded reading is the payload a model that found every planted clause would return.
There is one copy of each document in the repo, so a fixture and its gold-set entry cannot
drift apart.

They are marked `synthetic`. The clauses in them were planted by the build, not identified by
a reviewer, so they prove the gates run — not that the gates were cleared.

## What runs in CI

`pnpm test:citations` reads every entry and checks that every `sourceSentence` in its recorded
reading is found verbatim in its document text, after normalising whitespace and quote
characters. One miss fails the build. This is PRD §4.1.

## What runs by hand before a release

```
pnpm gates              the real pipeline against the real model, one document at a time
pnpm gates -- --dry     the same gates against the readings recorded here, no model called
```

It reports a result per document, then a summary:

- **4.2 catches what matters** (gating). Every Critical clause in `identifiedClauses` appears
  in the analysis. A miss fails the run and names the clause.
- **4.4 clean document** (gating). Zero Critical flags, at most two flags of any tier, and a
  summary that says the document looks reasonable. A miss says which of the three it failed.
- **4.3 severity defensible** (reported, never gating). How often the tier returned matches the
  tier identified, and whether anything is off by two tiers. Spec D9.
- **Citations.** Every source sentence locatable. This cannot fail here, because the analysis
  seam drops a flag it cannot place and CI gates the same property. It is checked anyway.

A run exits non-zero when a gating measure fails, when a document never got a reading from the
provider, or while the set is short of 10 real dangerous documents and 5 real clean ones. The
provider rate-limits hard, so `pnpm gates` goes one document at a time and waits and asks again
on a 429. A rate limit is not a gate failure; a document that never got a reading is reported as
not run, and an unknown is not a pass.

## Adding a document

1. Strip anything that identifies a real party. These files are public.
2. Save the text as `document.txt`. Do not tidy it: the point is to test real extraction output.
3. Run the analysis once and save the raw model response as `analysis.json`.
4. Write `manifest.json`, with `provenance` set honestly. Record the clauses the reviewer
   identified in `identifiedClauses`, and their notes in `expected.md` if they wrote any.
