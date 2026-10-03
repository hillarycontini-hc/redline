"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { SEVERITIES } from "@/lib/analysis/types.ts";
import {
  LONGEST_DESCRIPTION,
  LONGEST_LABEL,
} from "@/lib/supabase/red-lines.ts";
import styles from "../account.module.css";
import { addOwnRedLine } from "./red-lines-actions.ts";
import { NOTHING_TO_SAY } from "./red-lines-state.ts";

/**
 * Adding a red line of the reader's own.
 *
 * Three things, because the analysis needs all three: the name the entry is
 * shown under, the words Redline looks for in a document, and the tier a match
 * earns. The middle one is the one readers will not expect to be asked for, so
 * the field says what it is for — those words go to the model as the
 * description of what to find, and a vague one finds vague things.
 */
export function AddRedLine() {
  const [state, act] = useActionState(addOwnRedLine, NOTHING_TO_SAY);

  return (
    <form className={styles.form} action={act}>
      <div className={styles.formRow}>
        <label className={styles.label} htmlFor="red-line-label">
          What you will not accept
        </label>
        <input
          id="red-line-label"
          className={styles.field}
          name="label"
          type="text"
          maxLength={LONGEST_LABEL}
          placeholder="Late delivery penalty on me alone"
          required
        />
      </div>

      <div className={styles.formRow}>
        <label className={styles.label} htmlFor="red-line-description">
          What it looks like in a document
        </label>
        <textarea
          id="red-line-description"
          className={`${styles.field} ${styles.fieldTall}`}
          name="description"
          maxLength={LONGEST_DESCRIPTION}
          placeholder="The agreement charges me a daily sum for a late deliverable, and the client owes nothing for being late with feedback or payment."
          required
        />
        <p className={styles.fieldNote}>
          Redline reads these words to find the clause, so say what it does
          rather than what you call it.
        </p>
      </div>

      <div className={styles.formRow}>
        <label className={styles.label} htmlFor="red-line-severity">
          How hard it should land
        </label>
        <select
          id="red-line-severity"
          className={styles.field}
          name="severity"
          defaultValue="Serious"
        >
          {SEVERITIES.map((tier) => (
            <option key={tier} value={tier}>
              {tier}
            </option>
          ))}
        </select>
        <p className={styles.fieldNote}>
          Critical and Serious come back with wording you can send the other
          side. Worth knowing is there to be seen, not fought.
        </p>
      </div>

      <div className={styles.actions}>
        <AddButton />
      </div>

      {state.problem && (
        <p className={styles.problem} role="alert">
          {state.problem}
        </p>
      )}

      {state.notice && (
        <p className={styles.notice} role="status">
          {state.notice}
        </p>
      )}
    </form>
  );
}

/** Its own component so it can read the form it sits in. */
function AddButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className={styles.submit} disabled={pending}>
      {pending ? "Adding it" : "Add it to the list"}
    </button>
  );
}
