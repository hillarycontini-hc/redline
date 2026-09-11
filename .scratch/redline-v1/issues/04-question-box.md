# 04 — Question box

**What to build:** The reader can ask a question about the document and get an answer
drawn only from it, with the sentences it relied on quoted back. When the document does
not address the question, it says so rather than inventing an answer. Each question is
answered on its own, so a wrong turn in one does not poison the next.

**Demo:** Ask whether the other side can end the agreement without paying, and get an
answer quoting the termination clause. Ask about something the document never covers,
and get told the document does not address it, with nothing quoted.

**Blocked by:** 02.

**Gated on a decision:** whether the question box may answer from the summary or only
from the source text. The spec recommends source text only, or citations become
circular.

**Status:** ready-for-agent

- [ ] Asking a question returns an answer together with one or more citations, each
      quoted verbatim from the document.
- [ ] Every citation is locatable in the document text under the same normalisation the
      citation check uses.
- [ ] A question the document does not address returns the fixed response saying so,
      with no citations.
- [ ] An answer with no citations is never rendered as though it were grounded.
- [ ] Asking a second question produces an answer independent of the first. No prior
      question or answer is sent with it.
- [ ] An answer never states whether a clause is enforceable, and never offers advice.
