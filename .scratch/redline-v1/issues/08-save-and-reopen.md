# 08 — Analyses save and reopen

**What to build:** Every analysis a signed-in reader runs is saved, and can be reopened
later showing exactly what it showed at the time, including the red lines that were in
force when it ran, so they can see what they decided on then. A document they no longer
hold can be deleted.

**Demo:** Analyse a document, reload the page, open it from the library, and see the
same summary and the same flags with their source sentences, produced without calling
the model again. Delete it, and it stays gone.

**Blocked by:** 02, 07.

**Status:** ready-for-agent

- [ ] Analysing a document while signed in saves its extracted text, filename, summary,
      flags, and the red lines in force at that moment.
- [ ] The library lists saved documents with filename and when they were analysed.
- [ ] Reopening a saved document renders the stored analysis and makes no model call.
- [ ] Flags on a reopened document still show their source sentences, and still
      highlight within the stored text.
- [ ] Deleting a document removes it from the library, and it does not return on reload.
- [ ] Editing red lines afterwards does not change an analysis already saved.
