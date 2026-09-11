# 06 — Release gates run against a full gold set

**What to build:** Before a release, someone can run the gates and get a verdict rather
than an impression. The gold set holds ten real freelance agreements or leases whose
dangerous clauses were identified in advance, plus five clean documents included
deliberately. The catches-what-matters gate and the clean-document gate run against it
and report pass or fail per document.

The clean documents matter as much as the dangerous ones. A tool that always finds
problems stops being believed, and the failure mode is invisible: nobody reports
inflated flags, they just stop trusting the output and leave.

**Demo:** Run the gates and read the report. Every Critical clause caught across the
ten, and each clean document inside its threshold.

**Blocked by:** 02.

**Status:** ready-for-agent

- [ ] The gold set holds ten documents with dangerous clauses identified in advance and
      five clean documents, with nothing identifying a real party in any of them.
- [ ] One command runs both release gates and reports a result per document.
- [ ] The catches-what-matters gate fails when any Critical clause recorded for a
      document is missing from its analysis.
- [ ] The clean-document gate fails when a clean document returns any Critical flag,
      more than two flags of any tier, or a summary that does not say the document looks
      reasonable.
- [ ] The synthetic fixture is replaced, or marked as not counting toward the ten.
- [ ] The severity-defensible measure is reported and does not fail the run.
