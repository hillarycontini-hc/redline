import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { READ_PATH, gateRedLines } from "@/lib/supabase/access.ts";
import { listRedLines } from "@/lib/supabase/red-lines.ts";
import { readSession } from "@/lib/supabase/server.ts";
import styles from "../account.module.css";
import { NoAccounts } from "../no-accounts.tsx";
import { AddRedLine } from "./add-red-line.tsx";
import { RedLineRow } from "./red-line-row.tsx";

export const metadata: Metadata = {
  title: "Redline — your red lines",
  description:
    "The clauses you will not accept, and how hard each one lands. Every document you read is read against this list.",
};

/**
 * The reader's own red lines.
 *
 * This is not a settings screen. The list on it is an input to the analysis:
 * a clause type on it is flagged at the tier set here, and one that is not on
 * it is not flagged at all. So the screen says that plainly at the top, and
 * says it again at the point where an entry is taken off, which is the one
 * action here with a consequence the reader cannot see from the row.
 *
 * Who gets in is decided on the server, before anything is rendered or
 * queried. A signed-out visitor is sent to sign in and told where they were
 * going, and the database holds the same line again underneath: every row
 * carries row-level security keyed to the account that owns it.
 */
export default async function RedLinesPage() {
  const { viewer, access } = await readSession();
  const gate = gateRedLines(viewer);

  if (gate.show === "sign-in-first") redirect(gate.goTo);

  if (gate.show === "no-accounts") {
    return (
      <>
        <RedLinesHead count={null} />
        <div className={styles.body}>
          <NoAccounts missing={gate.missing} />
        </div>
      </>
    );
  }

  const list = await listRedLines(access, gate.userId);

  return (
    <>
      <RedLinesHead count={list.ok ? list.redLines.length : null} />

      <div className={styles.body}>
        {!list.ok ? (
          <p className={styles.problem} role="alert">
            Your red lines would not open just now. Nothing of yours has
            changed. Give it a minute and come back.
          </p>
        ) : (
          <>
            <p className={styles.note}>
              Every document you put in is read against this list. A clause on
              it comes back flagged at the tier you set here. A clause that is
              not on it is not flagged at all.
            </p>

            <p className={styles.note}>
              The same list covers everything: a freelance agreement, a lease
              and a terms of service are all read against it. Documents you have
              already read stay as they were — a saved statement holds the list
              it was read against that day.
            </p>

            {list.redLines.length === 0 ? (
              <p className={styles.empty}>
                There is nothing on your list, so a document you put in now
                comes back with nothing flagged. Write down one clause you will
                not accept and every reading after it is read against it.
              </p>
            ) : (
              <>
                <div className={styles.redLinesHead}>
                  <span className={styles.label}>What you will not accept</span>
                  <span className={styles.label}>Tier</span>
                </div>

                <ul className={styles.rows}>
                  {list.redLines.map((redLine) => (
                    <RedLineRow key={redLine.clauseType} redLine={redLine} />
                  ))}
                </ul>

                <p className={styles.foot}>
                  <span>
                    <span className={styles.figure}>
                      {list.redLines.length.toLocaleString("en-GB")}
                    </span>{" "}
                    {list.redLines.length === 1 ? "clause" : "clauses"} on your
                    list
                  </span>
                  <span>
                    <Link href={READ_PATH}>Read a document against it</Link>
                  </span>
                </p>
              </>
            )}

            <div className={styles.addRedLine}>
              <h2 className={styles.addHead}>Add one of your own</h2>
              <p className={styles.note}>
                Something you have been burned by, in your own words. Redline
                looks for it in every document from here on.
              </p>

              <AddRedLine />
            </div>
          </>
        )}
      </div>
    </>
  );
}

function RedLinesHead({ count }: { count: number | null }) {
  return (
    <header className={styles.head}>
      <div className={styles.headCell}>
        <span className={styles.label}>Your red lines</span>
        <h1 className={styles.headName}>What you will not sign</h1>
      </div>
      <div className={styles.headCell}>
        <span className={styles.label}>On the list</span>
        <p className={styles.headValue}>
          {count === null
            ? "Not known"
            : count === 0
              ? "Nothing yet"
              : `${count.toLocaleString("en-GB")} ${count === 1 ? "clause" : "clauses"}`}
        </p>
      </div>
    </header>
  );
}
