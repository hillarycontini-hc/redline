import Link from "next/link";
import { READ_PATH } from "@/lib/supabase/access.ts";
import styles from "./account.module.css";

/**
 * What a reader sees where an account would go, on a copy of Redline that has
 * no account database behind it.
 *
 * This is the honest version of a missing configuration. Nothing here throws,
 * nothing spins, and nothing pretends somebody is signed in. The two features
 * that need an account are gone and the reader is told which ones and why; the
 * one the product exists for is not, so they are pointed at it.
 *
 * It is rendered by both account screens — signing in and the library — so the
 * words exist in one place and cannot drift apart.
 */
export function NoAccounts({ missing }: { missing: readonly string[] }) {
  return (
    <>
      <p className={styles.note}>
        This copy of Redline has no accounts set up, so there is nowhere to
        keep a library or a list of your own red lines. Nothing has gone wrong
        at your end.
      </p>

      <p className={styles.note}>
        Reading a document still works, because it never needed an account. Put
        an agreement in and you get the whole statement back, every line quoting
        the sentence it came from.
      </p>

      <p className={styles.panel}>
        <span className={styles.panelHead}>Read a document</span>
        <span className={styles.panelBody}>
          <Link href={READ_PATH}>Put a document in</Link>
        </span>
      </p>

      <p className={styles.quietNote}>
        For whoever runs this site:{" "}
        {missing.length === 1
          ? `${missing[0]} is not set.`
          : `${missing.join(" and ")} are not set.`}{" "}
        Accounts come on once both are set and the tables in{" "}
        <code>supabase/migrations/</code> have been run.
      </p>
    </>
  );
}
