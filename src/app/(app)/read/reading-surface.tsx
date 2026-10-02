"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { SEED_RED_LINES } from "@/lib/analysis/red-lines.ts";
import type { AnalyzeResponse, Flag, Severity } from "@/lib/analysis/types.ts";
import { takeHandoff, type Handoff } from "@/lib/handoff.ts";
import { checkUsable, extractText } from "@/lib/parse/extract.ts";
import styles from "./read.module.css";

/**
 * The reader's open account with one document. The document holds the left
 * two-thirds as set type; its entries hold the right third, ranked Critical,
 * Serious, Worth knowing, each quoting the sentence it came from.
 *
 * The file is read here, in the browser. Only the text the reader confirms is
 * posted onward, as JSON, and the route refuses anything else.
 */

const TIER_WORD: Record<Severity, string> = {
  Critical: styles.tierCritical,
  Serious: styles.tierSerious,
  "Worth knowing": styles.tierWorth,
};

const QUOTE_RULE: Record<Severity, string> = {
  Critical: styles.quoteCritical,
  Serious: styles.quoteSerious,
  "Worth knowing": styles.quoteWorth,
};

const LABELS = new Map(SEED_RED_LINES.map((r) => [r.clauseType, r.label]));

interface DocumentText {
  name: string;
  text: string;
}

type Status = "idle" | "running" | "done" | "failed";

const PASTED = "Pasted text";

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

  function clearStatement() {
    setStatus("idle");
    setResult(null);
    setFailure(null);
    setReadAt(null);
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
        body: JSON.stringify({ documentText: confirmed.text }),
      });
    } catch {
      setStatus("failed");
      setFailure(
        "Redline could not get through to the server. Check your connection and try it again.",
      );
      return;
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      setStatus("failed");
      setFailure(
        body?.message ??
          "Redline could not get through to the server. Check your connection and try it again.",
      );
      return;
    }

    const payload = (await response.json()) as AnalyzeResponse;
    setResult(payload);
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

              <div className={`${styles.documentText} docType`}>
                {doc.text}
              </div>

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
                  onClick={() => confirm(PASTED, draft)}
                >
                  {parsing ? "Reading the file" : "Show the text"}
                </button>

                <label className={styles.fileLabel} htmlFor={`${fieldId}-file`}>
                  or choose a plain text file
                </label>
                <input
                  id={`${fieldId}-file`}
                  type="file"
                  accept=".txt,.md,.text,text/plain,text/markdown"
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
          />
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
}: {
  hasDocument: boolean;
  status: Status;
  result: AnalyzeResponse | null;
  failure: string | null;
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
    <>
      <p className={styles.summary}>
        <span className={styles.summaryHead}>Summary</span>
        {result.summary}
      </p>

      {result.flags.length === 0 ? (
        <p className={styles.quiet}>
          None of the {SEED_RED_LINES.length} clauses on the list turned up in
          this document.
        </p>
      ) : (
        <ul className={styles.entries}>
          {result.flags.map((flag, index) => (
            <Entry key={`${flag.clauseType}-${index}`} flag={flag} />
          ))}
        </ul>
      )}

      <p className={styles.foot}>
        <span>
          <span className={styles.figure}>{result.flags.length}</span>{" "}
          {result.flags.length === 1 ? "line" : "lines"} on this statement
        </span>
        <span>
          <span className={styles.figure}>{result.droppedCount}</span> dropped
          for want of a source sentence
        </span>
      </p>
    </>
  );
}

function Entry({ flag }: { flag: Flag }) {
  return (
    <li className={styles.entry}>
      <span className={`${styles.tier} ${TIER_WORD[flag.severity]}`}>
        {flag.severity}
      </span>

      <h2 className={styles.clause}>
        {LABELS.get(flag.clauseType) ?? flag.clauseType}
      </h2>

      <p className={styles.consequence}>{flag.consequence}</p>

      <p className={`${styles.quoteBlock} ${QUOTE_RULE[flag.severity]}`}>
        <span className={styles.quoteMark}>The sentence it came from</span>
        <span className={`${styles.quote} docType`}>{flag.sourceSentence}</span>
      </p>
    </li>
  );
}
