"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import styles from "../account.module.css";
import { removeDocument } from "./library-actions.ts";
import { NOTHING_WRONG } from "./remove-state.ts";

/**
 * Taking one document out of the library, with the asking done in the page.
 *
 * Removing is not reversible, so it takes two presses. The second one is a real
 * question on the row itself, where the reader can still see which document
 * they are about to lose — a browser dialog would cover that up, name nothing,
 * and read as the browser talking rather than Redline.
 */
export function RemoveDocument({
  documentId,
  filename,
}: {
  documentId: string;
  filename: string;
}) {
  const [asking, setAsking] = useState(false);
  const [state, act] = useActionState(removeDocument, NOTHING_WRONG);

  return (
    <>
      {asking ? (
        <form className={styles.confirm} action={act}>
          <input type="hidden" name="documentId" value={documentId} />

          <span className={styles.confirmAsk}>
            Take {filename} out? It goes for good, and the reading goes with it.
          </span>

          <span className={styles.confirmActions}>
            <ConfirmButton />
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
          Remove
        </button>
      )}

      {/* A failed removal has to be said. The row is still on the page, and a
          reader who pressed the button and saw nothing happen would be left
          guessing whether it worked. */}
      {state.problem && (
        <span className={styles.rowProblem} role="alert">
          {state.problem}
        </span>
      )}
    </>
  );
}

/** Its own component so it can read the form it sits in. */
function ConfirmButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className={styles.confirmYes} disabled={pending}>
      {pending ? "Taking it out" : "Take it out"}
    </button>
  );
}
