# 01 — CI keeps every flag honest

**What to build:** The Phase 1 work is on the branch, and continuous integration fails
any change that breaks the citation check. Nothing in the working tree is committed
today, so no automated check can see it. After this ticket, a source sentence that
cannot be located in its document is a red build rather than a silent defect.

This is prefactoring. It delivers no user-facing behaviour, and every later ticket
depends on it being red when the invariant breaks (ADR 0001).

**Demo:** Record a flag whose source sentence is not in its document, push the branch,
and watch the build fail and name the offending quote.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] The application scaffold, the analysis module, the parsing module, the gold set,
      and their tests are committed to master.
- [ ] A workflow runs on every push and pull request, running type checking, linting,
      the unit tests, and the citation check.
- [ ] A gold set entry whose recorded analysis contains a source sentence absent from
      its document text fails the workflow, and the output names that sentence.
- [ ] A pull request cannot merge while that workflow is failing.
- [ ] The workflow installs with pnpm and needs no credential to run — the citation
      check reads fixtures and calls no model.
