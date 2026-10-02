# 05 — PDF and DOCX, with a clear refusal for scanned PDFs

**What to build:** The reader can drop the file they actually hold rather than
copy-pasting forty pages. PDF and Word documents are parsed in the browser into text
faithful enough that a quoted sentence can still be located in it exactly. A PDF whose
pages carry no extractable text is refused with a clear explanation, because a citation
into text that was misread is worse than no citation at all.

**Demo:** Drop a forty-page PDF contract and get flags with source sentences you can
find in your own copy. Drop a scanned PDF and get told Redline cannot read it and why,
with no analysis produced.

**Blocked by:** 02.

**Decision taken 2026-10-02:** two browser parsing dependencies approved, `pdfjs-dist`
and `mammoth`. Both run in the browser, and `pdfjs-dist` reads a PDF's text layer with no
path to character recognition to switch on by accident. Recorded as D3 in
`BUILD-REPORT.md`. This ticket is no longer gated.

**Status:** done

- [x] A text-bearing PDF and a DOCX each produce extracted text shown before analysis
      runs.
- [x] Flags on a document parsed from PDF show source sentences locatable in that
      extracted text.
- [x] A PDF whose pages carry no extractable text is refused with a message saying
      Redline cannot read it and why, and no analysis runs.
- [x] The file itself is never sent anywhere. Parsing happens in the browser and only
      extracted text leaves it.
- [x] Any parsing dependency added runs in the browser, and approval was obtained before
      it was added.
- [x] No optical character recognition is added, and no code path attempts it.
