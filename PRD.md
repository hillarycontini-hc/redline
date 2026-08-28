# Redline — Product Brief

**Status: draft, pending sign-off.** The three segment decisions in §6 were recommended by
the grilling session and adopted by default — they were not explicitly chosen. Rounds two and
three of that session never ran, so **§5 (red lines) and the confidence rules in §4 are derived
from the research, not from lived experience.** They are the sections most likely to be wrong,
and the ones to argue with first.

---

## 1. Who this is for

**A freelancer or independent contractor about to sign a client agreement, who has been burned
before.**

Not first-time signers. The buyer is someone who already lost money or time to a contract they
didn't read closely enough, and now reads everything — slowly, anxiously, and without knowing
what they're looking for. The research found exactly one person who caught a problem *before*
signing, and they did it by reading carefully and being socially penalized for the delay:

> "The lease they gave us initially said no pets. It was an administrative error but if I had
> signed without reading we would have technically been in violation of our lease..."
>
> — [r/PetPeeves](https://www.reddit.com/r/PetPeeves/comments/1kcepqw/when_someone_gets_annoyed_when_i_actually_read/mq82enx/)

That is the behaviour Redline automates. Someone already paying the cost in time.

### What they do today instead

- **Read it themselves.** Free, slow, and unreliable — they don't know which clauses matter.
- **Sign it anyway.** The most common option. Deadline pressure, weak negotiating position.
- **Paste it into ChatGPT.** Three of Redline's four features, at $0 marginal cost on a
  subscription they already have. **This is the real competitor** and the research never
  examined it (§8).
- **Pay a lawyer.** $200–$600 typical for a freelance contract review
  ([ContractsCounsel](https://www.contractscounsel.com/b/freelance-contract-review-cost)),
  $150–$325/hr. Correct, and priced out of a $3,000 engagement.

No existing product serves one person with one document. The cheapest credible tool found was
Genie AI at $75/mo; LegalOn is $550/mo for an individual. Everything else is seat- or
enterprise-priced (`research/what-already-exists.md`).

---

## 2. The problem

Contracts are readable. People still get hurt by them, because length and density defeat the
reader before deception ever needs to.

> "Buried in the contract (45 pages of a mortgage) was the process for having the contract
> canceled."
>
> — [r/TimeshareOwners](https://www.reddit.com/r/TimeshareOwners/comments/1jizrbs/hilton_grand_vacation_timeshare/mjo724v/)

The information was *there*. Nothing was hidden in a legal sense. Forty-five pages was enough.

The consequence lands after signature, when nothing can be done:

> "After a month when I checked my apartment portal account i see the lease term is 1 year"
> / "the doc is signed so am locked"
>
> — [Blind](https://www.teamblind.com/post/incorrect-lease-agreement-ywopcisv)

**"The doc is signed so am locked" is the sentence this product exists to prevent.** It is a
pre-signature detection problem, and therefore a summarization and retrieval problem — which is
solvable — rather than a legal one.

---

## 3. What the first version does

1. **Accepts a contract, lease, freelance agreement, or ToS**, parsed in the browser. Only
   extracted text leaves the client.
2. **Returns a plain-English summary** of what the document commits the reader to.
3. **Flags risky clauses ranked by severity**, each showing the exact source sentence it came
   from, quoted verbatim.
4. **Drafts a counter-offer for each flagged clause** — replacement language the reader can
   send.
5. **Answers questions about the document**, from the document only, with a citation.
6. **Lets the reader edit their own red lines**, which changes what gets flagged and how
   severely.
7. **Saves past documents** to a library the reader can return to.

Nothing beyond this list. When something looks like the obvious next step and is not here, ask
before building it.

---

## 4. What good looks like

Four tests. The first is mechanical and belongs in CI; the rest need a gold set.

### 4.1 Every flag cites real text — automated, must pass 100%

Every quoted source sentence appears verbatim in the parsed document. A flag whose quote cannot
be located is a build failure, not a warning. This is
[ADR 0001](docs/adr/0001-every-flag-cites-its-source.md) and it is the one property that makes
everything else checkable.

### 4.2 It catches what matters — measured against planted clauses

Build a set of ~30 real freelance agreements and leases with known dangerous clauses,
independently identified by someone qualified. Redline should flag **every Critical-tier clause
in the set.** A missed Critical is a product failure; a missed "Worth knowing" is acceptable.

### 4.3 Severity is defensible, not just present

For each flag, a reviewer should be able to say *why* it earned its tier using the four factors
in §5. Target: a qualified reviewer agrees with the tier on **80%+ of flags**, and disagrees by
at most one tier on the rest. Two-tier disagreements are bugs.

### 4.4 It stays quiet on a clean document

Include in the gold set at least **5 genuinely fair agreements.** On those, Redline must return
few or no flags and say the document looks reasonable. **A tool that always finds problems stops
being believed**, and the failure mode is invisible — users don't report inflated flags, they
just stop trusting the output and leave.

*(§4.4's threshold is unset because the round-three discussion never happened. It needs a number
before it's testable.)*

---

## 5. Red lines — which clauses get flagged, and how hard

**Derived from the research, not from experience. Needs your sign-off.**

### What makes a clause dangerous rather than merely unusual

Four factors. A clause is dangerous when it scores high on several, not just one:

1. **Irreversibility** — can the reader get out, and at what cost?
2. **Magnitude** — is exposure bounded, and bounded relative to what the deal is worth?
3. **Asymmetry** — does it bind one party only?
4. **Surprise** — does it deviate from what's normal for this document type?

An unusual-but-harmless clause scores high on surprise alone. That distinction is the whole
severity model.

### Critical — flag prominently, always draft a counter-offer

| Clause | Why it matters |
|---|---|
| **Personal guarantee** | Survives the business. The guarantor stays liable for the full remaining balance after closure or bankruptcy ([LeaseLens](https://leaselens.org/blog/personal-guarantee-explained)). Irreversible, unbounded, asymmetric. |
| **IP assignment effective before full payment** | The client owns the work whether or not they pay. Standard in "most client contracts" ([Work Contract Review](https://www.workcontractreview.com/blog/freelance-contract-red-flags)) — high surprise for the freelancer, near-zero for the client. |
| **Uncapped indemnity** | Unbounded magnitude by construction. **No frequency data was found for this clause type** (§8) — it is here on structure, not evidence. |

### Serious — flag, draft a counter-offer

| Clause | Why it matters |
|---|---|
| **Non-compete / exclusivity** | Restricts future earning, not just this engagement. 18–20% of the US workforce is bound by one ([FTC](https://www.ftc.gov/news-events/news/press-releases/2024/04/fact-sheet-ftcs-proposed-final-noncompete-rule)). Enforceability varies by state — Redline flags, it does not opine on enforceability. |
| **Payment terms worse than net-30, with no late fee** | 71% of freelancers have struggled to collect at least once; 59% were owed $50k+ ([Freelancers Union](https://www.onlabor.org/wp-content/uploads/2017/05/FU_NonpaymentReport_r3.pdf)). The hardest number in the research. |
| **Unilateral termination with no kill fee** | Client can walk; freelancer absorbs the scheduled time. Asymmetric by construction. |
| **Unlimited revisions / undefined scope** | Converts a fixed fee into unbounded work. **No research data** — included on structure. |

### Worth knowing — mention, no counter-offer required

| Clause | Why it matters |
|---|---|
| **Auto-renewal** | Highest complaint volume of any clause type — ~70 FTC complaints/day in 2024 ([FTC](https://www.ftc.gov/news-events/news/press-releases/2024/10/federal-trade-commission-announces-final-click-cancel-rule-making-it-easier-consumers-end-recurring)). Demoted anyway: high frequency, low stakes, and increasingly handled by regulation. |
| **Arbitration / class-action waiver** | Near-universal in consumer contracts. Flagging it as Serious would fire on nearly every document and train users to ignore flags. |

### How confident the output should sound

State the clause and its consequence plainly. Hedge on **enforceability and outcome**, never on
what the document says. "This clause assigns ownership on delivery, not on payment" is a
reading. "This is unenforceable in California" is legal advice Redline does not give.

Where the model is genuinely unsure a clause is risky, it lowers the tier rather than adding
hedging language. **Uncertainty changes severity, not tone.**

---

## 6. The calls made, and what was given up

### 6.1 Freelancers, not renters

**Chose against:** renters, who supplied 4 of 9 verbatim quotes and the most vivid pain in the
study — including the person who spent their savings on a house to escape renting.

**Why:** low-income renters' binding constraint is cash for rent, not access to legal review
(Stanford Law Review, via `research/who-would-pay.md`). Near-zero willingness to pay despite
acute pain.

**Who is worse off:** renters — the only segment with proof of suffering. Redline will still
read a lease, but nothing is designed for them: not the red lines, not the counter-offers, not
the price.

**The cost of this call:** we build on an inference and abandon our best evidence. Freelancers
produced **zero verbatim quotes across two research runs.**

### 6.2 High-stakes documents, not high-frequency ones

**Chose against:** auto-renewal and late fees — the top two clause types by complaint volume,
backed by the strongest data in the study (FTC ~70/day; CFPB $14.5B, 52M Americans).

**Why:** those complaints are high-volume and low-stakes, and are increasingly addressed by
regulation rather than by a product. Frequency of complaint is not willingness to act.

**Who is worse off:** the 52M Americans a year paying a late fee, and everyone stuck in a gym or
SaaS auto-renewal. Numerically this is most people with this problem.

**The cost of this call:** we overrule the only clause-frequency evidence we have.

### 6.3 Pre-signature, not already-stuck

**Chose against:** the person who already signed — every acute-pain quote in the research.

**Why:** Redline reads documents before signature. Helping the already-stuck is a different
product, with different liability and no counter-offer story.

**Who is worse off:** everyone quoted in §2. *"The doc is signed so am locked"* describes
someone Redline cannot help.

**The cost of this call:** our most sympathetic users are unservable, and our actual buyer feels
no pain at the moment of purchase. Prevention products are hard to sell to people who have not
yet been burned — which is why §1 targets the *previously* burned specifically.

---

## 7. What we are not building

- **Payments and billing.** Not needed to prove the analysis can be trusted.
- **Document sharing between users.** Same.
- **OCR for scanned documents.** Excluded on principle, not cost. A citation into misread text
  is worse than no citation, because it *looks* verifiable — it would break
  [ADR 0001](docs/adr/0001-every-flag-cites-its-source.md), the one thing this version exists to
  establish.
- **Legal advice, or claims of legal substitution.** DoNotPay drew an FTC action and a $193K
  settlement for overstating "robot lawyer" capability. Redline reports what a document says.
- **Enforceability opinions.** Redline flags a non-compete; it does not tell you whether a court
  would uphold it.

This version exists to prove the analysis can be trusted. Nothing above makes it more
trustworthy.

---

## 8. What the research could not tell us

Five gaps. Each is a place this brief is guessing.

1. **Nobody said they would pay anything.** Zero primary willingness-to-pay data, zero "too
   expensive" quotes. Every price anchor in the research is a proxy — what a lawyer charges,
   what LegalShield charges. The $10–$40/document band is inferred, not observed.

2. **Zero freelancer testimony**, across two research runs, for the segment §6.1 commits to.
   Both failures were mechanical (blocked search, then PullPush rate-limiting), so this is
   absence of evidence — but the hole is exactly where the business case is load-bearing.

3. **ChatGPT was never examined.** A user pasting a lease into a chatbot they already pay $20/mo
   for gets three of the four features free. This is the most likely reason a prospect declines
   to pay, and there is no evidence on how well it actually works.

4. **No frequency data for liability caps, indemnity, exclusivity, or fee escalators** — four
   clause types from the original hypothesis. Two of them appear in §5 on structural reasoning
   alone.

5. **The clause types with the best statistics have the worst stories.** Searches for
   first-person non-compete, indemnity, auto-renewal, and arbitration accounts returned only
   law-firm explainer content. Regulators count these complaints; individuals may not experience
   them as "I wish I'd read that first."

**One thing not yet considered at all:** *what Redline does when the counter-offer gets rejected.*
The product drafts replacement language and stops. But the freelancer's real constraint is
leverage, not wording — they mostly cannot walk away. A counter-offer they're afraid to send is
a feature that changes nothing. Whether Redline should say which clauses are worth fighting for
versus which are normal-and-survivable is unresolved, and it may matter more than the drafting
itself.
