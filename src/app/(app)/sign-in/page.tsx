import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { onwardPath } from "@/lib/supabase/access.ts";
import { readViewer } from "@/lib/supabase/server.ts";
import styles from "../account.module.css";
import { NoAccounts } from "../no-accounts.tsx";
import { AccountForm } from "./account-form.tsx";

export const metadata: Metadata = {
  title: "Redline — your account",
  description:
    "An account keeps the documents you have read, and the red lines that decide what gets flagged.",
};

/**
 * The way in and the way back in. An account buys two things and nothing else:
 * the library, and the reader's own red lines. Reading a document has never
 * needed one and still does not, which is why this page says so rather than
 * standing in front of the product.
 *
 * `searchParams` is a Promise in Next 16 and is awaited.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const onward = onwardPath(Array.isArray(next) ? next[0] : next);

  const viewer = await readViewer();
  if (viewer.state === "signed-in") redirect(onward);

  return (
    <>
      <header className={styles.head}>
        <div className={styles.headCell}>
          <span className={styles.label}>Account</span>
          <h1 className={styles.headName}>Your account</h1>
        </div>
        <div className={styles.headCell}>
          <span className={styles.label}>What it adds</span>
          <p className={styles.headValue}>
            Somewhere to keep the documents you have read, and your own red
            lines.
          </p>
        </div>
      </header>

      <div className={styles.body}>
        {viewer.state === "no-accounts" ? (
          <NoAccounts missing={viewer.missing} />
        ) : (
          <>
            <p className={styles.note}>
              Reading a document needs no account. Signing in adds somewhere to
              keep what you have read, and a list of the clauses you refuse. You
              set that list once, and every document after it is read against
              it.
            </p>

            <AccountForm next={onward} />

            <p className={styles.quietNote}>
              Redline keeps the text of the documents you save. The file itself
              never leaves your browser.
            </p>
          </>
        )}
      </div>
    </>
  );
}
