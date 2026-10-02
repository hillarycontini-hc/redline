---
version: 1
slug: "src-app-app-layout-tsx"
primary_target: "src/app/(app)/layout.tsx"
related_targets: []
---

# App shell, behind sign-in

**Scope:** the authenticated frame at `/app` and everything it holds. Visitor
mode: **Operate**. Brief only — no app screen is built today.

**Audience and task.** The same freelancer, now signed in, with a document in
hand and a deadline. The task is: get a document in, read what it commits them
to, check each claim against the document's own words, take wording back to the
client, and return to it later.

**What the frame holds.** Six things, and nothing beyond them: paste or upload a
document; the result, carrying its plain-English summary, its ranked flags, and
its clean verdict when the document is fair; the question box; the reader's red
lines; and the library of past documents.

**Important states.** Empty library, which says it is empty. Extracted text
shown for the reader to confirm the parse is faithful, before analysis runs. A
clean document, where the right outcome is few or no flags and a summary saying
the document looks reasonable — silence has to read as a result, not a failure.
A scanned PDF, refused with the reason. A flag whose source sentence cannot be
located is never rendered at all.

**Constraints.** `CONTEXT.md` vocabulary is binding. Severity is three words and
there is no score anywhere in the frame. Counter-offers belong to Critical and
Serious entries only. The question box answers from the document and quotes it,
or says the document does not address the question and quotes nothing — the UI
never renders an ungrounded answer as though it were grounded. Parsing happens
in the browser; no screen may imply a file was uploaded or stored. All
reader-facing copy passes the humanizer skill before it is committed.

**Memorable moment.** The same lock as the landing page: selecting a flag draws
its sentence into alignment and highlights it inside the document column, so the
reader can read the paragraph around it.

**Unresolved.** Whether the question box may answer from the summary or only
from the document's own text. Until that is settled, the brief assumes source
text only.

## Direction contract

**THESIS.** The signed-in frame is the reader's open account with one document:
a permanent two-column ledger where the document holds the left and its entries
hold the right, and every entry is answerable to a sentence on the left. It
refuses the dashboard arrangement — a sidebar of icons, a grid of summary tiles,
a chart of risk over time — because none of those can be checked against the
document.

**OWN-WORLD.** The landing page's world, carried intact: pale columnar ledger
ground, lighter statement sheet, ledger green owning rules and column heads, red
reserved for Critical, carbon violet for copies and secondary notes, condensed
grotesk caps for heads, tabular figures, Times-metric serif for the document
itself. Operate tightens it rather than softening it: denser rules, smaller
type, the same three tier marks.

**STORY.** The reader understands what the document commits them to, checks any
line against the text, takes wording back to the client, and finds the document
again months later showing what it showed then.

**FIRST VIEWPORT.** Account head across the top carrying the document's name and
the date analysed. The document column holds the left two-thirds as set type;
the entries column holds the right third, ranked Critical, Serious, Worth
knowing, each with its sentence reference. The question box sits at the foot of
the entries column as the statement's query line. Red lines and the library are
reached from the account head, not from a sidebar of icons.

**FORM.** Statement of Account, inherited from the landing page round rather
than re-rolled; one world owns both surfaces. Seed key ed6ffbb5.

**FINISH.** unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance
