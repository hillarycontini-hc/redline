import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  LIBRARY_PATH,
  gateLibrary,
  savedReadingPath,
  signInPathFor,
} from "@/lib/supabase/access.ts";
import { openSavedReading } from "@/lib/supabase/saved-reading.ts";
import { readSession } from "@/lib/supabase/server.ts";
import accountStyles from "../../account.module.css";
import { NoAccounts } from "../../no-accounts.tsx";
import { SavedReadingView } from "./saved-reading-view.tsx";

export const metadata: Metadata = {
  title: "Redline — a document from your library",
  description:
    "A document you have read already, showing the statement as it stood the day you read it, every line quoting the sentence it came from.",
};

/**
 * One document out of the reader's library, showing the reading it was given.
 *
 * **Nothing here calls the model, and nothing here can.** The summary, the
 * flags, their source sentences and the ranges those sentences occupy are read
 * out of two rows, and the text they point into comes out of the same read. The
 * module graph behind this page does not reach the OpenRouter caller at all, and
 * src/app/(app)/library/[id]/reopen.test.ts holds that true.
 *
 * `params` is awaited. In Next 16 it is a Promise.
 */
export default async function SavedReadingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { viewer, access } = await readSession();
  const gate = gateLibrary(viewer);

  // Somebody else's contract is not shown to anybody, and the first line of
  // that is not rendering one for a reader with no account. The database holds
  // the same line again underneath, in row-level security.
  if (gate.show === "sign-in-first") redirect(signInPathFor(savedReadingPath(id)));

  if (gate.show === "no-accounts") {
    return (
      <>
        <Head name="A document" when="Not known" />
        <div className={accountStyles.body}>
          <NoAccounts missing={gate.missing} />
        </div>
      </>
    );
  }

  const opened = await openSavedReading(access, gate.userId, id);

  if (!opened.ok) {
    return (
      <>
        <Head name="Not in your library" when="Not known" />
        <div className={accountStyles.body}>
          <p
            className={
              opened.why === "not-found"
                ? accountStyles.note
                : accountStyles.problem
            }
            role={opened.why === "not-found" ? undefined : "alert"}
          >
            {WHY_NOT[opened.why]}
          </p>

          <p className={accountStyles.panel}>
            <span className={accountStyles.panelHead}>Your library</span>
            <span className={accountStyles.panelBody}>
              <Link href={LIBRARY_PATH}>See what is in it</Link>
            </span>
          </p>
        </div>
      </>
    );
  }

  const { reading } = opened;

  return (
    <SavedReadingView
      filename={reading.filename}
      documentText={reading.documentText}
      summary={reading.summary}
      flags={reading.flags}
      redLinesInForce={reading.redLinesInForce}
      readAt={dateRead(reading.readAt)}
    />
  );
}

/**
 * Four ways this can come to nothing, and the reader is owed different words
 * for each. The damaged one is the hard case: a reading whose flags no longer
 * point at the sentences they came from is not shown at all, because a line
 * that cannot show its sentence is the one thing this product must never put on
 * a screen (ADR 0001).
 */
const WHY_NOT: Record<"no-accounts" | "not-found" | "unreadable" | "damaged", string> = {
  "no-accounts":
    "This copy of Redline has no accounts set up, so there is no library to open.",
  "not-found":
    "That document is not in your library. You may have taken it out, or the link may be an old one.",
  unreadable:
    "Your library would not open just now. Nothing of yours has gone. Give it a minute and come back.",
  damaged:
    "This one did not come back whole. Its lines no longer point at sentences in your document, and Redline will not show you a statement it cannot hold to the text. Put the document in again to read it afresh.",
};

function Head({ name, when }: { name: string; when: string }) {
  return (
    <header className={accountStyles.head}>
      <div className={accountStyles.headCell}>
        <span className={accountStyles.label}>The document</span>
        <h1 className={accountStyles.headName}>{name}</h1>
      </div>
      <div className={accountStyles.headCell}>
        <span className={accountStyles.label}>Date read</span>
        <p className={accountStyles.headValue}>{when}</p>
      </div>
    </header>
  );
}

/** The day and the hour, because a reader who read it twice needs to tell them apart. */
function dateRead(createdAt: string): string {
  const when = new Date(createdAt);
  if (Number.isNaN(when.getTime())) return "Date unknown";
  return when.toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
