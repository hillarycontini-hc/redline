import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  READ_PATH,
  gateLibrary,
  savedReadingPath,
} from "@/lib/supabase/access.ts";
import { listSavedDocuments } from "@/lib/supabase/library.ts";
import type { SavedDocument } from "@/lib/supabase/library.ts";
import { readSession } from "@/lib/supabase/server.ts";
import styles from "../account.module.css";
import { NoAccounts } from "../no-accounts.tsx";
import { RemoveDocument } from "./remove-document.tsx";

export const metadata: Metadata = {
  title: "Redline — your library",
  description:
    "The documents you have read, kept as you read them, so you can come back to one before a renewal conversation.",
};

/**
 * The reader's own library. Nobody else's documents are here and theirs are
 * nowhere else.
 *
 * Who gets in is decided on the server, by the gate in lib/supabase/access.ts,
 * before anything is rendered or queried — a signed-out visitor is sent to sign
 * in and told where they were going. Hiding the link would not be a guard, and
 * the database holds the same line again underneath: every row carries
 * row-level security keyed to the account that owns it.
 */
export default async function LibraryPage() {
  const { viewer, access } = await readSession();
  const gate = gateLibrary(viewer);

  if (gate.show === "sign-in-first") redirect(gate.goTo);

  if (gate.show === "no-accounts") {
    return (
      <>
        <LibraryHead count={null} />
        <div className={styles.body}>
          <NoAccounts missing={gate.missing} />
        </div>
      </>
    );
  }

  const saved = await listSavedDocuments(access, gate.userId);

  return (
    <>
      <LibraryHead count={saved.ok ? saved.documents.length : null} />

      <div className={styles.body}>
        {!saved.ok ? (
          <p className={styles.problem} role="alert">
            Your library would not open just now. Nothing of yours has gone.
            Give it a minute and come back.
          </p>
        ) : saved.documents.length === 0 ? (
          <>
            <p className={styles.empty}>
              There is nothing in your library yet. A document you read and
              save turns up here, holding the statement as it stood the day you
              read it, so you can come back to it before a renewal
              conversation.
            </p>

            <p className={styles.panel}>
              <span className={styles.panelHead}>Start one</span>
              <span className={styles.panelBody}>
                <Link href={READ_PATH}>Put a document in</Link>
              </span>
            </p>
          </>
        ) : (
          <>
            <div className={styles.ledgerHead}>
              <span className={styles.label}>Document</span>
              <span className={styles.label}>Date read</span>
            </div>

            <ul className={styles.rows}>
              {saved.documents.map((document) => (
                <li className={styles.row} key={document.id}>
                  <div className={styles.rowMain}>
                    <Link
                      className={styles.rowName}
                      href={savedReadingPath(document.id)}
                    >
                      {document.filename}
                    </Link>
                    <RemoveDocument
                      documentId={document.id}
                      filename={document.filename}
                    />
                  </div>
                  <span className={styles.rowDate}>{dateRead(document)}</span>
                </li>
              ))}
            </ul>

            <p className={styles.foot}>
              <span>
                <span className={styles.figure}>
                  {saved.documents.length.toLocaleString("en-GB")}
                </span>{" "}
                {saved.documents.length === 1 ? "document" : "documents"} in
                your library
              </span>
            </p>
          </>
        )}
      </div>
    </>
  );
}

function LibraryHead({ count }: { count: number | null }) {
  return (
    <header className={styles.head}>
      <div className={styles.headCell}>
        <span className={styles.label}>The library</span>
        <h1 className={styles.headName}>Your library</h1>
      </div>
      <div className={styles.headCell}>
        <span className={styles.label}>Held here</span>
        <p className={styles.headValue}>
          {count === null
            ? "Not known"
            : count === 0
              ? "Nothing yet"
              : `${count.toLocaleString("en-GB")} ${count === 1 ? "document" : "documents"}`}
        </p>
      </div>
    </header>
  );
}

function dateRead({ createdAt }: SavedDocument): string {
  const when = new Date(createdAt);
  if (Number.isNaN(when.getTime())) return "Date unknown";
  return when.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
