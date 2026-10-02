"use client";

import { useEffect, useId, useRef } from "react";
import { SEED_RED_LINES } from "@/lib/analysis/red-lines.ts";
import type { Flag, Severity } from "@/lib/analysis/types.ts";
import styles from "./read.module.css";

/**
 * The parts two surfaces share: the document with one sentence marked in it,
 * and the statement whose lines do the marking.
 *
 * They live here rather than in either surface because a reading taken out of
 * the library has to show exactly what it showed on the day — the same tier
 * marks, the same quoted sentences, the same sentence lit up where it sits in
 * the reader's own paragraph. Two copies of this would drift, and the thing they
 * would drift on is the one property the product exists to prove.
 *
 * Nothing here calls anything. A flag arrives carrying its source sentence and
 * the character range that sentence occupies, and that is all the marking needs.
 */

const TIER_WORD: Record<Severity, string> = {
  Critical: styles.tierCritical,
  Serious: styles.tierSerious,
  "Worth knowing": styles.tierWorth,
};

const QUOTE_RULE: Record<Severity, string> = {
  Critical: styles.quoteCritical,
  Serious: styles.quoteSerious,
  "Worth knowing": styles.quoteWorth,
};

/** The wash behind the sentence where it sits in the document itself. */
const MARK_FIELD: Record<Severity, string> = {
  Critical: styles.markCritical,
  Serious: styles.markSerious,
  "Worth knowing": styles.markWorth,
};

/**
 * A sentence to mark in the document column, and the wash to mark it with. An
 * open entry and a quoted sentence under an answer both arrive as one of
 * these, so the marking runs once and one thing is marked at a time.
 */
export interface Mark {
  start: number;
  end: number;
  field: string;
}

/** The mark an open line item asks for: its own range, in its own tier's wash. */
export function markFor(flag: Flag): Mark {
  return { ...flag.location, field: MARK_FIELD[flag.severity] };
}

/** The wash a quoted sentence under an answer takes. No tier to name. */
export const ANSWER_MARK_FIELD = styles.markAnswer;

/**
 * The tier word's own colour and its own accounting rule. Exported because the
 * tier is shown in two places — on a line item and in the list of red lines a
 * reading ran against — and both have to carry the rule, so the tier survives
 * with the colour taken away.
 */
export function tierClass(severity: Severity): string {
  return `${styles.tier} ${TIER_WORD[severity]}`;
}

const SEEDED_LABELS = new Map(
  SEED_RED_LINES.map((r) => [r.clauseType, r.label]),
);

/** Enough of a red line to name a clause type. */
export interface ClauseLabel {
  clauseType: string;
  label: string;
}

/**
 * The words a clause type is shown under.
 *
 * A reading out of the library passes the list it ran against, so an entry is
 * named the way it was named that day. Without one it falls back to the seeded
 * list, and failing that to the clause type itself — a line is never shown with
 * no name at all.
 */
export function clauseLabel(
  flag: Flag,
  redLines?: readonly ClauseLabel[],
): string {
  const own = redLines?.find((r) => r.clauseType === flag.clauseType);
  return own?.label ?? SEEDED_LABELS.get(flag.clauseType) ?? flag.clauseType;
}

/**
 * The whole parse, as set type, with the open sentence marked where it sits in
 * the reader's own paragraph — whether it came from an entry on the statement
 * or from an answer's citation.
 *
 * The marked span is sliced out of this text with the character range the
 * citation check worked out when the flag or the citation was made. The model's
 * copy of the sentence is never rendered here and the text is never searched
 * for it: what the reader is looking at is their document.
 */
export function DocumentBody({
  text,
  marked,
}: {
  text: string;
  marked: Mark | null;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLElement>(null);

  const start = marked?.start ?? -1;
  const end = marked?.end ?? -1;

  useEffect(() => {
    const box = boxRef.current;
    const mark = markRef.current;
    if (!box || !mark) return;

    // Scroll the document's own box and nothing else. The reader's place on
    // the page is theirs to keep.
    const boxTop = box.getBoundingClientRect().top;
    const markBox = mark.getBoundingClientRect();
    const centred =
      box.scrollTop +
      (markBox.top - boxTop) -
      (box.clientHeight - markBox.height) / 2;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    box.scrollTo({
      top: Math.max(0, centred),
      behavior: still ? "auto" : "smooth",
    });
  }, [start, end, text]);

  return (
    <div className={`${styles.documentText} docType`} ref={boxRef}>
      {marked ? (
        <>
          {text.slice(0, start)}
          <mark
            ref={markRef}
            className={`${styles.documentMark} ${marked.field}`}
          >
            {text.slice(start, end)}
          </mark>
          {text.slice(end)}
        </>
      ) : (
        text
      )}
    </div>
  );
}

/**
 * The statement itself: the summary, the line items in tier order, and the
 * foot that counts them.
 *
 * `clauseLabels` is the list the reading ran against, when it is known. A
 * reading out of the library carries its own, so an entry is shown under the
 * words that were on the list the day it ran rather than under today's.
 */
export function StatementBody({
  summary,
  flags,
  droppedCount,
  redLinesCount,
  clauseLabels,
  openEntry,
  onOpen,
}: {
  summary: string;
  flags: Flag[];
  droppedCount: number | null;
  redLinesCount: number;
  clauseLabels?: readonly ClauseLabel[];
  openEntry: number | null;
  onOpen: (index: number | null) => void;
}) {
  return (
    <>
      <p className={styles.summary}>
        <span className={styles.summaryHead}>Summary</span>
        {summary}
      </p>

      {flags.length === 0 ? (
        <p className={styles.quiet}>
          None of the {redLinesCount} clauses on the list turned up in this
          document.
        </p>
      ) : (
        <ul className={styles.entries}>
          {flags.map((flag, index) => (
            <Entry
              key={`${flag.clauseType}-${index}`}
              flag={flag}
              label={clauseLabel(flag, clauseLabels)}
              isOpen={index === openEntry}
              onOpen={() => onOpen(index === openEntry ? null : index)}
            />
          ))}
        </ul>
      )}

      <p className={styles.foot}>
        <span>
          <span className={styles.figure}>{flags.length}</span>{" "}
          {flags.length === 1 ? "line" : "lines"} on this statement
        </span>
        {droppedCount !== null && (
          <span>
            <span className={styles.figure}>{droppedCount}</span> dropped for
            want of a source sentence
          </span>
        )}
      </p>
    </>
  );
}

/**
 * One line item. The whole row is the control, so selecting it needs a mouse
 * no more than it needs a keyboard, and opening it does two things at once:
 * the sentence in the document column is marked, and the wording to send back
 * appears beneath the row.
 */
function Entry({
  flag,
  label,
  isOpen,
  onOpen,
}: {
  flag: Flag;
  label: string;
  isOpen: boolean;
  onOpen: () => void;
}) {
  const panelId = useId();
  const owesWording = flag.severity !== "Worth knowing";

  return (
    <li className={styles.entry}>
      <button
        type="button"
        className={styles.entryButton}
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        onClick={onOpen}
      >
        <span className={`${styles.tier} ${TIER_WORD[flag.severity]}`}>
          {flag.severity}
        </span>

        <span className={styles.clause}>{label}</span>

        <span className={styles.consequence}>{flag.consequence}</span>

        <span
          className={`${styles.quoteBlock} ${QUOTE_RULE[flag.severity]} ${
            isOpen ? styles.quoteOpen : ""
          }`}
        >
          <span className={styles.quoteMark}>The sentence it came from</span>
          <span className={`${styles.quote} docType`}>
            {flag.sourceSentence}
          </span>
        </span>
      </button>

      {isOpen &&
        (flag.counterOffer ? (
          <div className={styles.counter} id={panelId}>
            <span className={styles.counterHead}>Counter-offer</span>
            <p className={`${styles.counterBody} docType`}>
              {flag.counterOffer}
            </p>
          </div>
        ) : (
          <p className={styles.noCounter} id={panelId}>
            {owesWording
              ? "No replacement wording came back for this one. You still have the sentence above to put to the other side."
              : "No counter-offer. Redline flags this one so you know it is there."}
          </p>
        ))}
    </li>
  );
}
