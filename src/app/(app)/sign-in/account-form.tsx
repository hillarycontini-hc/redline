"use client";

import { useActionState, useId } from "react";
import { submitAccount } from "../account-actions.ts";
import { NOTHING_SAID } from "../account-form-state.ts";
import styles from "../account.module.css";

/**
 * One form, two ways out of it: into an account that exists, or into a new one.
 * Which, is whichever button the reader pressed — the button carries its own
 * value into the form data, so this works with the browser's own form handling
 * and does not depend on our JavaScript having loaded.
 *
 * Everything that decides anything runs on the server, in account-actions.ts.
 * Nothing here holds a session, and nothing here can produce one.
 */
export function AccountForm({ next }: { next: string }) {
  const emailId = useId();
  const passwordId = useId();

  const [said, act, working] = useActionState(submitAccount, NOTHING_SAID);

  return (
    <form className={styles.form} action={act}>
      <input type="hidden" name="next" value={next} />

      <div className={styles.formRow}>
        <label className={styles.label} htmlFor={emailId}>
          Email
        </label>
        <input
          id={emailId}
          className={styles.field}
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={working}
        />
      </div>

      <div className={styles.formRow}>
        <label className={styles.label} htmlFor={passwordId}>
          Password
        </label>
        <input
          id={passwordId}
          className={styles.field}
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={working}
        />
      </div>

      <div className={styles.actions}>
        <button
          type="submit"
          name="intent"
          value="sign-in"
          className={styles.submit}
          disabled={working}
        >
          {working ? "Signing in" : "Sign in"}
        </button>

        <button
          type="submit"
          name="intent"
          value="create"
          className={styles.secondary}
          disabled={working}
        >
          or make an account with this email
        </button>
      </div>

      {said.problem && (
        <p className={styles.problem} role="alert">
          {said.problem}
        </p>
      )}

      {said.notice && (
        <p className={styles.notice} role="status">
          {said.notice}
        </p>
      )}
    </form>
  );
}
