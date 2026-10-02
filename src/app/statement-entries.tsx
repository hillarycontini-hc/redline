"use client";

import { useState } from "react";
import styles from "./page.module.css";
import type { StatementEntry } from "./worked-example";
import type { Severity } from "@/lib/analysis/types.ts";

/**
 * The statement's line items: clause, the sentence it came from, tier.
 * Selecting a line locks its sentence into alignment with the entry, which is
 * the found-it state. One entry is open at a time, the way a reader works down
 * a statement.
 */

const TIER_CLASS: Record<Severity, string> = {
  Critical: styles.tierCritical,
  Serious: styles.tierSerious,
  "Worth knowing": styles.tierWorth,
};

export function StatementEntries({ entries }: { entries: StatementEntry[] }) {
  const [openType, setOpenType] = useState<string | null>(
    entries[0]?.clauseType ?? null,
  );

  return (
    <ul className={styles.entries}>
      {entries.map((entry) => {
        const isOpen = entry.clauseType === openType;

        return (
          <li className={styles.row} key={entry.clauseType}>
            <button
              type="button"
              className={styles.rowButton}
              aria-expanded={isOpen}
              onClick={() => setOpenType(isOpen ? null : entry.clauseType)}
            >
              <span className={styles.rowClause}>
                <span className={styles.clause}>{entry.label}</span>
                <span className={styles.consequence}>{entry.consequence}</span>
              </span>

              <span
                className={`${styles.reference} ${isOpen ? styles.referenceOpen : ""} docType`}
              >
                <span className={styles.referenceMark}>
                  The sentence it came from
                </span>
                <span className={styles.quote}>{entry.sourceSentence}</span>
              </span>

              <span className={`${styles.tier} ${TIER_CLASS[entry.severity]}`}>
                {entry.severity}
              </span>
            </button>

            {isOpen &&
              (entry.counterOffer ? (
                <div className={styles.counter}>
                  <span className={styles.counterHead}>Counter-offer</span>
                  <p className={`${styles.counterBody} docType`}>
                    {entry.counterOffer}
                  </p>
                </div>
              ) : (
                <p className={styles.noCounter}>
                  No counter-offer. Redline flags this one so you know it is
                  there.
                </p>
              ))}
          </li>
        );
      })}
    </ul>
  );
}
