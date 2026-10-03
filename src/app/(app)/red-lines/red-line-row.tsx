"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { SEVERITIES } from "@/lib/analysis/types.ts";
import type { RedLineEntry } from "@/lib/supabase/red-lines.ts";
import styles from "../account.module.css";
import { changeRedLineTier, takeRedLineOff } from "./red-lines-actions.ts";
import { NOTHING_TO_SAY } from "./red-lines-state.ts";

const TIER_FIELD: Record<string, string> = {
  Critical: styles.tierFieldCritical,
  Serious: styles.tierFieldSerious,
  "Worth knowing": styles.tierFieldWorth,
};

/**
 * One entry on the list: what it is, what Redline looks for, the tier it earns,
 * and the two things the reader can do to it.
 *
 * Taking an entry off is the one that needs saying out loud. It does not hide a
 * row — it stops that clause type being flagged at all, in every document after
 * it, which is a thing a reader can do on purpose and should not be able to do
 * by accident. So it takes two presses, and the second one is a question on the
 * row itself, where the entry they are about to lose is still in front of them.
 * Not a browser dialog: that would cover the row up, name nothing, and read as
 * the browser talking rather than Redline.
 */
export function RedLineRow({ redLine }: { redLine: RedLineEntry }) {
  const [asking, setAsking] = useState(false);
  const [tierState, changeTier] = useActionState(
    changeRedLineTier,
    NOTHING_TO_SAY,
  );
  const [offState, takeOff] = useActionState(takeRedLineOff, NOTHING_TO_SAY);

  return (
    <li className={styles.redLineRow}>
      <div className={styles.redLineMain}>
        <span className={styles.redLineLabel}>{redLine.label}</span>
        <span className={styles.redLineType}>{redLine.clauseType}</span>
        <p className={styles.redLineLook}>{redLine.description}</p>

        {asking ? (
          <form className={styles.confirm} action={takeOff}>
            <input type="hidden" name="clauseType" value={redLine.clauseType} />

            <span className={styles.confirmAsk}>
              Take {redLine.label} off your list? Redline stops looking for it,
              so it will not be flagged in anything you read from here on.
            </span>

            <span className={styles.confirmActions}>
              <TakeOffButton />
              <button
                type="button"
                className={styles.rowAction}
                onClick={() => setAsking(false)}
              >
                Keep it
              </button>
            </span>
          </form>
        ) : (
          <button
            type="button"
            className={styles.rowAction}
            onClick={() => setAsking(true)}
          >
            Take it off
          </button>
        )}

        {tierState.notice && (
          <span className={styles.redLineNotice} role="status">
            {tierState.notice}
          </span>
        )}

        {(tierState.problem ?? offState.problem) && (
          <span className={styles.rowProblem} role="alert">
            {tierState.problem ?? offState.problem}
          </span>
        )}
      </div>

      <form className={styles.tierForm} action={changeTier}>
        <input type="hidden" name="clauseType" value={redLine.clauseType} />
        <input type="hidden" name="label" value={redLine.label} />

        <label className={styles.tierFieldLabel}>
          <span className={styles.hidden}>Tier for {redLine.label}</span>
          <span className={styles.tierFieldWrap}>
            <select
              className={`${styles.tierField} ${TIER_FIELD[redLine.severity]}`}
              name="severity"
              defaultValue={redLine.severity}
            >
              {SEVERITIES.map((tier) => (
                <option key={tier} value={tier}>
                  {tier}
                </option>
              ))}
            </select>
          </span>
        </label>

        <ChangeTierButton />
      </form>
    </li>
  );
}

/** Its own component so it can read the form it sits in. */
function ChangeTierButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className={styles.rowAction} disabled={pending}>
      {pending ? "Setting" : "Set the tier"}
    </button>
  );
}

function TakeOffButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className={styles.confirmYes} disabled={pending}>
      {pending ? "Taking it off" : "Take it off"}
    </button>
  );
}
