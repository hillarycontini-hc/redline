import Link from "next/link";
import { LIBRARY_PATH, SIGN_IN_PATH } from "@/lib/supabase/access.ts";
import { readViewer } from "@/lib/supabase/server.ts";
import { signOut } from "./account-actions.ts";
import styles from "./app.module.css";

/**
 * The working frame. One sheet on the ledger ground, opened by an account head
 * across the top, with the surface's own columns beneath it.
 *
 * Direction contract: .impeccable/surfaces/src-app-app-layout-tsx.md. The head
 * runs across the top because the arrangement this refuses is the dashboard —
 * a sidebar of icons, a grid of tiles, a chart of severity over time, none of
 * which can be checked against the document. The library and the way in and out
 * of an account are reached from this head for the same reason: the brief gives
 * them no sidebar to live in.
 */

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const viewer = await readViewer();

  return (
    <main className={styles.page}>
      <article className={styles.sheet}>
        <div className={styles.account}>
          <span className={styles.accountName}>Redline</span>
          <span className={styles.accountRule} aria-hidden="true" />
          <span className={styles.accountKind}>Statement of account</span>

          <nav className={styles.accountNav} aria-label="Your account">
            {viewer.state === "signed-in" ? (
              <>
                <span className={styles.accountWho}>
                  {viewer.email ?? "Signed in"}
                </span>
                <Link className={styles.accountLink} href={LIBRARY_PATH}>
                  Library
                </Link>
                {/* A form, not a link: signing out changes something, and a
                    link that changes something gets followed by anything that
                    crawls the page. */}
                <form className={styles.accountForm} action={signOut}>
                  <button type="submit" className={styles.accountAction}>
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <Link className={styles.accountLink} href={SIGN_IN_PATH}>
                Sign in
              </Link>
            )}

            <Link className={styles.accountLink} href="/">
              Back to the entry
            </Link>
          </nav>
        </div>

        {children}
      </article>
    </main>
  );
}
