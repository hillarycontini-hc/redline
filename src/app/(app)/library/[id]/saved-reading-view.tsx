"use client";

import { useState } from "react";
import type { Flag, RedLine } from "@/lib/analysis/types.ts";
import {
  DocumentBody,
  StatementBody,
  markFor,
  tierClass,
} from "../../read/statement.tsx";
import styles from "../../read/read.module.css";

/**
 * A reading out of the library, shown as it was shown on the day.
 *
 * It renders what was stored and nothing else. There is no model call behind
 * any of this and no path to one: the flags arrived carrying their source
 * sentences and the character ranges those sentences occupy in the text beside
 * them, which is everything the marking needs. That is the point of storing the
 * text with the reading — the ranges stay valid, so opening a line still lights
 * the sentence up in the reader's own paragraph months later.
 *
 * The document column, the line items and the marking are the same components
 * the live reading surface uses, so the two cannot drift.
 */
export function SavedReadingView({
  filename,
  documentText,
  summary,
  flags,
  redLinesInForce,
  readAt,
}: {
  filename: string;
  documentText: string;
  summary: string;
  flags: Flag[];
  redLinesInForce: RedLine[];
  readAt: string;
}) {
  const [openEntry, setOpenEntry] = useState<number | null>(
    flags.length > 0 ? 0 : null,
  );

  const openFlag = openEntry !== null ? (flags[openEntry] ?? null) : null;

  return (
    <>
      <header className={styles.head}>
        <div className={styles.headCell}>
          <span className={styles.label}>The document</span>
          <h1 className={styles.headName}>{filename}</h1>
        </div>
        <div className={styles.headCell}>
          <span className={styles.label}>Date read</span>
          <p className={styles.headValue}>{readAt}</p>
        </div>
      </header>

      <div className={styles.columns}>
        <section className={styles.documentColumn}>
          <div className={styles.documentHead}>
            <span className={styles.label}>The text, as you confirmed it</span>
          </div>

          <p className={styles.documentNote}>
            <span className={styles.figure}>
              {documentText.length.toLocaleString("en-GB")} characters
            </span>
            , kept as you read them. Every line on the statement points into
            this text.
          </p>

          <DocumentBody
            text={documentText}
            marked={openFlag ? markFor(openFlag) : null}
          />
        </section>

        <section className={styles.statementColumn}>
          <span className={styles.label}>The statement</span>

          <StatementBody
            summary={summary}
            flags={flags}
            droppedCount={null}
            redLinesCount={redLinesInForce.length}
            clauseLabels={redLinesInForce}
            openEntry={openEntry}
            onOpen={setOpenEntry}
          />
        </section>
      </div>

      {/* What the reading was held to. It is here because a reading months old
          is only readable if the reader can see what they cared about then. */}
      <aside className={styles.notes}>
        <span className={styles.notesHead}>Your red lines, that day</span>

        <p className={styles.notesNote}>
          This document was read against the list below. Changing your red lines
          now leaves this statement as it is.
        </p>

        <ul className={styles.redLines}>
          {redLinesInForce.map((redLine) => (
            <li className={styles.redLine} key={redLine.clauseType}>
              <span className={styles.redLineLabel}>{redLine.label}</span>
              <span className={tierClass(redLine.severity)}>
                {redLine.severity}
              </span>
            </li>
          ))}
        </ul>
      </aside>
    </>
  );
}
