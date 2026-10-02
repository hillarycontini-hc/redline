"use client";

import Link from "next/link";
import { useId, useState, useSyncExternalStore } from "react";
import { PASTED_DOCUMENT } from "@/app/api/analyze/validate.ts";
import { MAX_QUESTION_CHARS } from "@/app/api/ask/validate.ts";
import { SEED_RED_LINES } from "@/lib/analysis/red-lines.ts";
import type {
  AnalyzeResponse,
  AskResponse,
  SavedTo,
} from "@/lib/analysis/types.ts";
import { takeHandoff, type Handoff } from "@/lib/handoff.ts";
import {
  FILE_PICKER_ACCEPT,
  checkUsable,
  extractText,
} from "@/lib/parse/extract.ts";
import { SIGN_IN_PATH, savedReadingPath } from "@/lib/supabase/access.ts";
import styles from "./read.module.css";
import {
  ANSWER_MARK_FIELD,
  DocumentBody,
  StatementBody,
  markFor,
  type Mark,
} from "./statement.tsx";

/**
 * The reader's open account with one document. The document holds the left
 * two-thirds as set type; its entries hold the right third, ranked Critical,
 * Serious, Worth knowing, each quoting the sentence it came from.
 *
 * The file is read here, in the browser. Only the text the reader confirms is
 * posted onward, as JSON, and the route refuses anything else.
 */

interface DocumentText {
  name: string;
  text: string;
}

type Status = "idle" | "running" | "done" | "failed";

const NO_SERVER =
  "Redline could not get through to the server. Check your connection and try it again.";

/**
 * The landing page's entry leaves the text it confirmed in sessionStorage.
 * Storage is an external store, so it is read the way React reads one: once,
 * cached here, and cleared on the way out, so a reload starts clean. The
 * server snapshot is empty, which is what the prerendered surface shows.
 */
let handedOver: Handoff | null | undefined;

function readHandoff(): Handoff | null {
  if (handedOver === undefined) handedOver = takeHandoff();
  return handedOver;
}

const noHandoffOnTheServer = () => null;
const handoffNeverChanges = () => () => {};

export function ReadingSurface() {
  const fieldId = useId();

  const [draft, setDraft] = useState("");
  const [dropping, setDropping] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);

  const handoff = useSyncExternalStore(
    handoffNeverChanges,
    readHandoff,
    noHandoffOnTheServer,
  );

  const [chosen, setChosen] = useState<DocumentText | null>(null);
  const [putAside, setPutAside] = useState(false);

  // Whatever the reader last put in, or else what the landing page handed over.
  const doc: DocumentText | null = chosen ?? (putAside ? null : handoff);

  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [readAt, setReadAt] = useState<string | null>(null);

  // Whether this reading was kept, and where. Said quietly, under the statement
  // the reader came for, and never in front of it.
  const [saved, setSaved] = useState<SavedTo | null>(null);

  // Which entry is open. One at a time, the way a reader works down a
  // statement, and the open entry is the one marked in the document column.
  const [openEntry, setOpenEntry] = useState<number | null>(null);

  // The query line at the foot of the statement. One question at a time: a
  // second one replaces the first, here and in the module behind it, so there
  // is no transcript to carry a wrong turn forward.
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<AskResponse | null>(null);
  const [askFailure, setAskFailure] = useState<string | null>(null);
  const [openCitation, setOpenCitation] = useState<number | null>(null);

  function clearQuery() {
    setAsking(false);
    setAnswer(null);
    setAskFailure(null);
    setOpenCitation(null);
  }

  function clearStatement() {
    setStatus("idle");
    setResult(null);
    setFailure(null);
    setReadAt(null);
    setSaved(null);
    setOpenEntry(null);
    // The answer belonged to the document that is going away with it.
    clearQuery();
  }

  // One sentence is marked at a time, so opening either side closes the other.
  function openEntryAt(index: number | null) {
    setOpenEntry(index);
    setOpenCitation(null);
  }

  function openCitationAt(index: number | null) {
    setOpenCitation(index);
    if (index !== null) setOpenEntry(null);
  }

  function confirm(name: string, text: string) {
    const usable = checkUsable(text);
    if (!usable.ok) {
      setEntryError(usable.message);
      return;
    }
    setEntryError(null);
    clearStatement();
    setChosen({ name, text: usable.text });
  }

  async function readFile(file: File) {
    setParsing(true);
    setEntryError(null);
    const extracted = await extractText(file);
    setParsing(false);

    if (!extracted.ok) {
      setEntryError(extracted.message);
      return;
    }
    setDraft(extracted.text);
    confirm(file.name, extracted.text);
  }

  function startAgain() {
    setChosen(null);
    setPutAside(true);
    setDraft("");
    setEntryError(null);
    clearStatement();
  }

  async function run(confirmed: DocumentText) {
    setStatus("running");
    setFailure(null);

    let response: Response;
    try {
      response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The name goes with the text so a reading kept in the library can be
        // found again under the name the reader knows it by. The file itself
        // stays in this browser, as it always has.
        body: JSON.stringify({
          documentText: confirmed.text,
          filename: confirmed.name,
        }),
      });
    } catch {
      setStatus("failed");
      setFailure(NO_SERVER);
      return;
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      setStatus("failed");
      setFailure(body?.message ?? NO_SERVER);
      return;
    }

    const payload = (await response.json()) as AnalyzeResponse;
    setResult(payload);
    setSaved(payload.saved);
    // The first line opens itself, so the marked sentence and the wording to
    // send back are both on screen without a click.
    openEntryAt(payload.flags.length > 0 ? 0 : null);
    setReadAt(
      new Date().toLocaleString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
    setStatus("done");
  }

  /**
   * One question, sent with the document and with nothing else: no summary, no
   * flags, no earlier question or answer. The answer is grounded in the
   * document's own text, and anything that came out of the model before would
   * close that chain of evidence on itself.
   */
  async function askQuestion(confirmed: DocumentText, question: string) {
    setAsking(true);
    setAskFailure(null);
    // A second question replaces the first rather than joining it.
    setAnswer(null);
    setOpenCitation(null);

    let response: Response;
    try {
      response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentText: confirmed.text, question }),
      });
    } catch {
      setAsking(false);
      setAskFailure(NO_SERVER);
      return;
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      setAsking(false);
      setAskFailure(body?.message ?? NO_SERVER);
      return;
    }

    const payload = (await response.json()) as AskResponse;
    setAnswer(payload);
    // The first sentence quoted opens itself, so the reader can see it where
    // it sits in their own document without a further click. An answer with
    // nothing quoted marks nothing, because there is nothing to point at.
    if (payload.citations.length > 0) openCitationAt(0);
    setAsking(false);
  }

  // The open entry decides which sentence is marked in the document, and so
  // does a quoted sentence the reader has selected under an answer. One or the
  // other: opening either closes the other.
  const openFlag =
    status === "done" && result && openEntry !== null
      ? (result.flags[openEntry] ?? null)
      : null;
  const openQuote =
    answer && openCitation !== null
      ? (answer.citations[openCitation] ?? null)
      : null;

  const marked: Mark | null = openFlag
    ? markFor(openFlag)
    : openQuote
      ? { ...openQuote.location, field: ANSWER_MARK_FIELD }
      : null;

  return (
    <>
      <header className={styles.head}>
        <div className={styles.headCell}>
          <span className={styles.label}>The document</span>
          <h1 className={styles.headName}>
            {doc ? doc.name : "Nothing in yet"}
          </h1>
        </div>
        <div className={styles.headCell}>
          <span className={styles.label}>Date read</span>
          <p className={styles.headValue}>{readAt ?? "Not read yet"}</p>
        </div>
      </header>

      <div className={styles.columns}>
        <section className={styles.documentColumn}>
          {doc ? (
            <>
              <div className={styles.documentHead}>
                <span className={styles.label}>The text, in full</span>
                <button
                  type="button"
                  className={styles.plainLink}
                  onClick={startAgain}
                >
                  Put a different one in
                </button>
              </div>

              <p className={styles.documentNote}>
                <span className={styles.figure}>
                  {doc.text.length.toLocaleString("en-GB")} characters
                </span>{" "}
                read in this browser. Check it against the copy in your hand.
              </p>

              <DocumentBody text={doc.text} marked={marked} />

              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.submit}
                  disabled={status === "running"}
                  onClick={() => void run(doc)}
                >
                  {status === "running"
                    ? "Reading"
                    : status === "idle"
                      ? "Read it line by line"
                      : "Read it again"}
                </button>
              </div>
            </>
          ) : (
            <>
              <label className={styles.label} htmlFor={fieldId}>
                Paste the agreement
              </label>

              <textarea
                id={fieldId}
                className={`${styles.field} ${dropping ? styles.fieldDrop : ""}`}
                placeholder="Paste the text of the agreement here."
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  setEntryError(null);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDropping(true);
                }}
                onDragLeave={() => setDropping(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDropping(false);
                  const file = event.dataTransfer.files[0];
                  if (file) void readFile(file);
                }}
              />

              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.submit}
                  disabled={draft.trim().length === 0 || parsing}
                  onClick={() => confirm(PASTED_DOCUMENT, draft)}
                >
                  {parsing ? "Reading the file" : "Show the text"}
                </button>

                <label className={styles.fileLabel} htmlFor={`${fieldId}-file`}>
                  or choose a PDF, a Word file or plain text
                </label>
                <input
                  id={`${fieldId}-file`}
                  type="file"
                  accept={FILE_PICKER_ACCEPT}
                  className={styles.fileInput}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void readFile(file);
                  }}
                />
              </div>

              {entryError && (
                <p className={styles.error} role="alert">
                  {entryError}
                </p>
              )}

              <p className={styles.documentNote}>
                Redline reads the file here, in your browser. Only the text you
                confirm is sent on, and the file itself is never stored.
              </p>
            </>
          )}
        </section>

        <section className={styles.statementColumn} aria-live="polite">
          <span className={styles.label}>The statement</span>
          <Statement
            hasDocument={doc !== null}
            status={status}
            result={result}
            failure={failure}
            openEntry={openEntry}
            onOpen={openEntryAt}
          />

          {/* Said after the statement is on screen, never before it. */}
          {status === "done" && saved && <KeptNote saved={saved} />}

          {/* The query line, at the foot of the statement. It is here as soon
              as there is a document to ask about: the reader does not have to
              run the reading first to ask a question of their own. */}
          {doc && (
            <QueryLine
              asking={asking}
              answer={answer}
              failure={askFailure}
              openCitation={openCitation}
              onAsk={(question) => void askQuestion(doc, question)}
              onOpen={openCitationAt}
            />
          )}
        </section>
      </div>
    </>
  );
}

function Statement({
  hasDocument,
  status,
  result,
  failure,
  openEntry,
  onOpen,
}: {
  hasDocument: boolean;
  status: Status;
  result: AnalyzeResponse | null;
  failure: string | null;
  openEntry: number | null;
  onOpen: (index: number | null) => void;
}) {
  if (status === "failed") {
    return (
      <p className={styles.error} role="alert">
        {failure}
      </p>
    );
  }

  if (status === "running") {
    return <p className={styles.waiting}>Reading the document.</p>;
  }

  if (status !== "done" || !result) {
    return (
      <p className={styles.waiting}>
        {hasDocument
          ? "Check the text against the copy you are holding, then read it line by line."
          : "Put the agreement in and Redline returns what it commits you to, each line quoting the sentence it came from."}
      </p>
    );
  }

  return (
    <StatementBody
      summary={result.summary}
      flags={result.flags}
      droppedCount={result.droppedCount}
      redLinesCount={SEED_RED_LINES.length}
      openEntry={openEntry}
      onOpen={onOpen}
    />
  );
}

/**
 * Whether this reading was kept, said once and quietly, under the statement.
 *
 * It is a line of text and not a prompt. A reader who came to find out what
 * they are signing is not interrupted to be sold an account, and a reader
 * looking at a copy of Redline with no accounts behind it is told nothing at
 * all, because there is nothing they could do about it.
 */
function KeptNote({ saved }: { saved: SavedTo }) {
  if (saved.kept) {
    return (
      <p className={styles.keptNote}>
        This one is in your library now.{" "}
        <Link href={savedReadingPath(saved.documentId)}>Open it there</Link> and
        it comes back just as it is here.
      </p>
    );
  }

  if (saved.why === "not-signed-in") {
    return (
      <p className={styles.keptNote}>
        Nothing is kept while you are signed out.{" "}
        <Link href={SIGN_IN_PATH}>Sign in</Link> and the next one stays in your
        library.
      </p>
    );
  }

  if (saved.why === "would-not-keep") {
    return (
      <p className={styles.keptNote}>
        This reading did not reach your library. It is all still on screen. Put
        the document in again later if you want it kept.
      </p>
    );
  }

  return null;
}

/**
 * The query line, at the foot of the statement. One question at a time, and
 * the answer that comes back either quotes the document or says the document
 * does not say.
 *
 * There is no transcript. A second question replaces the first, which is what
 * the module behind it does too: each question is answered on its own, so a
 * wrong turn in one cannot reach the next.
 */
function QueryLine({
  asking,
  answer,
  failure,
  openCitation,
  onAsk,
  onOpen,
}: {
  asking: boolean;
  answer: AskResponse | null;
  failure: string | null;
  openCitation: number | null;
  onAsk: (question: string) => void;
  onOpen: (index: number | null) => void;
}) {
  const fieldId = useId();
  const [question, setQuestion] = useState("");

  const ready = question.trim().length > 0 && !asking;

  return (
    <section className={styles.query}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (ready) onAsk(question.trim());
        }}
      >
        <label className={styles.label} htmlFor={fieldId}>
          Ask about this document
        </label>

        <p className={styles.queryNote}>
          Answers come out of this document and quote the sentences they rest
          on. One question at a time: a new one replaces the last.
        </p>

        <div className={styles.queryRow}>
          <input
            id={fieldId}
            type="text"
            className={styles.queryField}
            placeholder="Can the Client end this without paying me?"
            maxLength={MAX_QUESTION_CHARS}
            value={question}
            disabled={asking}
            onChange={(event) => setQuestion(event.target.value)}
          />
          <button type="submit" className={styles.submit} disabled={!ready}>
            {asking ? "Asking" : "Ask"}
          </button>
        </div>
      </form>

      {failure && (
        <p className={styles.error} role="alert">
          {failure}
        </p>
      )}

      {asking && <p className={styles.waiting}>Looking through the document.</p>}

      {!asking && answer && (
        <Answer answer={answer} openCitation={openCitation} onOpen={onOpen} />
      )}
    </section>
  );
}

/**
 * What came back. Two different things, and they do not look alike.
 *
 * An answer the document supports arrives on its own panel with the sentences
 * it rests on beneath it, each selectable and each marked in the document
 * column. An answer with nothing quoted is not an answer at all — it is the
 * fixed response saying the document does not say, and it is set as a plain
 * note with no panel and no quotes, so it can never be read as grounded.
 */
function Answer({
  answer,
  openCitation,
  onOpen,
}: {
  answer: AskResponse;
  openCitation: number | null;
  onOpen: (index: number | null) => void;
}) {
  if (answer.citations.length === 0) {
    return <p className={styles.unanswered}>{answer.answer}</p>;
  }

  return (
    <>
      <p className={styles.answer}>
        <span className={styles.answerHead}>Answer</span>
        {answer.answer}
      </p>

      <span className={styles.citationsHead}>
        {answer.citations.length === 1
          ? "The sentence it rests on"
          : "The sentences it rests on"}
      </span>

      <ul className={styles.citations}>
        {answer.citations.map((citation, index) => {
          const isOpen = index === openCitation;
          return (
            <li key={citation.location.start}>
              <button
                type="button"
                className={`${styles.citation} ${isOpen ? styles.citationOpen : ""}`}
                aria-pressed={isOpen}
                onClick={() => onOpen(isOpen ? null : index)}
              >
                <span className={`${styles.citationQuote} docType`}>
                  {citation.sourceSentence}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
