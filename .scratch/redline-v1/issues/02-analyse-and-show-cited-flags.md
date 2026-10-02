# 02 — Analyse a plain-text document and show cited flags

**What to build:** A freelancer opens Redline, drops in a plain-text document, and sees
what it commits them to. The file is parsed in their own browser and only the extracted
text is sent onward. Before analysis runs they can read the extracted text and satisfy
themselves the parse is faithful to the document they hold. What comes back is a
plain-English summary and a list of flags ranked Critical, then Serious, then Worth
knowing, each showing the exact sentence it came from, quoted verbatim.

This is the tracer bullet for the whole product: browser parse, extracted text across
the wire, the analysis seam, rendered flags. It replaces the starter content on the
entry page.

**Demo:** Drop a freelance agreement in as plain text, confirm the extracted text
matches your copy, run the analysis, and read the summary and the ranked flags with
their source sentences.

**Blocked by:** 01.

**Decision taken 2026-10-02:** the model is `z-ai/glm-5.3-flash`, set as
`OPENROUTER_MODEL`. The id is read from the environment and is never hardcoded.
This ticket is no longer gated.

**Status:** done

- [x] Dropping or selecting a plain-text file shows its extracted text on screen before
      any analysis runs.
- [x] No request carries the file itself. Only extracted text leaves the browser, and
      no route accepts a file body.
- [x] Running the analysis returns a summary and flags, reaching the model only through
      OpenRouter with the model id read from the environment.
- [x] Each flag shows its severity as one of the three words, its consequence in plain
      language, and its source sentence quoted from the document.
- [x] Flags appear Critical first, then Serious, then Worth knowing, and within a tier
      in the order they appear in the document.
- [x] A flag whose source sentence could not be located in the document does not appear
      on screen, and the refusal is recorded rather than discarded.
- [x] No severity is shown as a number, and the page avoids the words listed as not ours
      in the domain vocabulary.
- [x] The framework starter content is gone from the entry page.
