# 09 — Editable red lines drive the analysis

**What to build:** The reader keeps their own list of what they refuse to accept, and
that list decides what gets flagged and how hard. Every account starts seeded with the
default list, so the first analysis is useful before anything is configured. From there
they can add an entry at a tier they choose, re-tier an entry, or delete one, and every
later analysis reflects it. A reader who lost an IP dispute can make that their own red
line. A reader who has decided not to care about a clause can make it stop appearing.

**Demo:** Promote arbitration to Critical, re-analyse a document containing an
arbitration clause, and see that flag come back Critical carrying a counter-offer.
Delete the auto-renewal red line, re-analyse, and see no auto-renewal flag.

**Blocked by:** 08.

**Status:** built; the demo needs a running Supabase project (see BUILD-REPORT.md)

- [ ] A new account's red lines are seeded with the default list, and that list is
      visible and editable.
- [x] Promoting arbitration to Critical and re-analysing a document containing an
      arbitration clause returns that flag as Critical, carrying a counter-offer.
- [x] Deleting the auto-renewal red line and re-analysing a document containing an
      auto-renewal clause returns no auto-renewal flag.
- [x] A red line the reader adds, at the tier they chose, produces flags at that tier.
- [x] The same list applies to every document type. Leases and terms of service get no
      separate list.
- [ ] Edits survive signing out and back in, and apply to every later analysis.
