"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { MAX_QUESTION_CHARS } from "@/app/api/ask/validate.ts";
import { SEED_RED_LINES } from "@/lib/analysis/red-lines.ts";
import type {
  AnalyzeResponse,
  AskResponse,
  Flag,
  Severity,
} from "@/lib/analysis/types.ts";
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

/** The wash behind the sentence where it sits in the document itself. */
const MARK_FIELD: Record<Severity, string> = {
  Critical: styles.markCritical,
  Serious: styles.markSerious,
  "Worth knowing": styles.markWorth,
};

/**
 * A sentence to mark in the document column, and the wash to mark it with. An
 * open entry and a quoted sentence under an answer both arrive as one of
 * these, so the marking runs once and one thing is marked at a time.
 */
interface Mark {
  start: number;
  end: number;
  field: string;
}

const LABELS = new Map(SEED_RED_LINES.map((r) => [r.clauseType, r.label]));

interface DocumentText {
  name: string;
  text: string;
}

type Status = "idle" | "running" | "done" | "failed";

const PASTED = "Pasted text";

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
        body: JSON.stringify({ documentText: confirmed.text }),
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
    ? { ...openFlag.location, field: MARK_FIELD[openFlag.severity] }
    : openQuote
      ? { ...openQuote.location, field: styles.markAnswer }
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
            openEntry={openEntry}
            onOpen={openEntryAt}
          />

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

/**
 * The whole parse, as set type, with the open sentence marked where it sits in
 * the reader's own paragraph — whether it came from an entry on the statement
 * or from an answer's citation.
 *
 * The marked span is sliced out of this text with the character range the
 * citation check worked out when the flag or the citation was made. The model's
 * copy of the sentence is never rendered here and the text is never searched
 * for it: what the reader is looking at is their document.
 */
function DocumentBody({ text, marked }: { text: string; marked: Mark | null }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLElement>(null);

  const start = marked?.start ?? -1;
  const end = marked?.end ?? -1;

  useEffect(() => {
    const box = boxRef.current;
    const mark = markRef.current;
    if (!box || !mark) return;

    // Scroll the document's own box and nothing else. The reader's place on
    // the page is theirs to keep.
    const boxTop = box.getBoundingClientRect().top;
    const markBox = mark.getBoundingClientRect();
    const centred =
      box.scrollTop +
      (markBox.top - boxTop) -
      (box.clientHeight - markBox.height) / 2;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    box.scrollTo({
      top: Math.max(0, centred),
      behavior: still ? "auto" : "smooth",
    });
  }, [start, end, text]);

  return (
    <div className={`${styles.documentText} docType`} ref={boxRef}>
      {marked ? (
        <>
          {text.slice(0, start)}
          <mark
            ref={markRef}
            className={`${styles.documentMark} ${marked.field}`}
          >
            {text.slice(start, end)}
          </mark>
          {text.slice(end)}
        </>
      ) : (
        text
      )}
    </div>
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
            <Entry
              key={`${flag.clauseType}-${index}`}
              flag={flag}
              isOpen={index === openEntry}
              onOpen={() => onOpen(index === openEntry ? null : index)}
            />
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

/**
 * One line item. The whole row is the control, so selecting it needs a mouse
 * no more than it needs a keyboard, and opening it does two things at once:
 * the sentence in the document column is marked, and the wording to send back
 * appears beneath the row.
 */
function Entry({
  flag,
  isOpen,
  onOpen,
}: {
  flag: Flag;
  isOpen: boolean;
  onOpen: () => void;
}) {
  const panelId = useId();
  const owesWording = flag.severity !== "Worth knowing";

  return (
    <li className={styles.entry}>
      <button
        type="button"
        className={styles.entryButton}
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        onClick={onOpen}
      >
        <span className={`${styles.tier} ${TIER_WORD[flag.severity]}`}>
          {flag.severity}
        </span>

        <span className={styles.clause}>
          {LABELS.get(flag.clauseType) ?? flag.clauseType}
        </span>

        <span className={styles.consequence}>{flag.consequence}</span>

        <span
          className={`${styles.quoteBlock} ${QUOTE_RULE[flag.severity]} ${
            isOpen ? styles.quoteOpen : ""
          }`}
        >
          <span className={styles.quoteMark}>The sentence it came from</span>
          <span className={`${styles.quote} docType`}>
            {flag.sourceSentence}
          </span>
        </span>
      </button>

      {isOpen &&
        (flag.counterOffer ? (
          <div className={styles.counter} id={panelId}>
            <span className={styles.counterHead}>Counter-offer</span>
            <p className={`${styles.counterBody} docType`}>
              {flag.counterOffer}
            </p>
          </div>
        ) : (
          <p className={styles.noCounter} id={panelId}>
            {owesWording
              ? "No replacement wording came back for this one. You still have the sentence above to put to the other side."
              : "No counter-offer. Redline flags this one so you know it is there."}
          </p>
        ))}
    </li>
  );
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
