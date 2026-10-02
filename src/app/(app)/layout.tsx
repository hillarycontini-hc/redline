import Link from "next/link";
import styles from "./app.module.css";

/**
 * The working frame. One sheet on the ledger ground, opened by an account head
 * across the top, with the surface's own columns beneath it.
 *
 * Direction contract: .impeccable/surfaces/src-app-app-layout-tsx.md. The head
 * runs across the top because the arrangement this refuses is the dashboard —
 * a sidebar of icons, a grid of tiles, a chart of severity over time, none of
 * which can be checked against the document.
 */

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className={styles.page}>
      <article className={styles.sheet}>
        <div className={styles.account}>
          <span className={styles.accountName}>Redline</span>
          <span className={styles.accountRule} aria-hidden="true" />
          <span className={styles.accountKind}>Statement of account</span>
          <Link className={styles.accountLink} href="/">
            Back to the entry
          </Link>
        </div>

        {children}
      </article>
    </main>
  );
}
