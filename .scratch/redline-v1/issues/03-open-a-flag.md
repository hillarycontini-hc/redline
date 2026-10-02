# 03 — Open a flag and see what it owes you

**What to build:** From a flag, the reader can reach both the sentence in its context
and the wording to send back. Selecting a flag highlights its source sentence inside the
surrounding document text, so the reader can read the paragraph around it rather than a
sentence in isolation. Every Critical and Serious flag carries a counter-offer,
replacement language tied to the same source sentence as the flag it belongs to. Worth
knowing flags carry none, so the output stays short and nobody is encouraged to fight
over nothing.

Closes a gap in the current analysis module: a Critical flag whose counter-offer the
model omitted is presently shown without one.

**Demo:** Click a Critical flag. Its sentence highlights in the document text and
replacement wording appears beneath it. Click a Worth knowing flag. It highlights, and
no wording appears.

**Blocked by:** 02.

**Status:** done

- [x] Selecting a flag scrolls to and visibly highlights its source sentence within the
      rendered document text.
- [x] The highlighted span is the document's own characters, not the model's copy of
      them.
- [x] Every Critical and Serious flag on screen shows a counter-offer.
- [x] Given a model response where a Critical or Serious flag carries no counter-offer,
      the analysis obtains one before returning. The flag is never shown without one,
      and is never dropped merely for lacking one.
- [x] No Worth knowing flag shows a counter-offer.
- [x] A counter-offer points at the same source sentence as its flag, and that sentence
      is locatable in the document.
