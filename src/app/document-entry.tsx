"use client";

import { useId, useRef, useState } from "react";
import styles from "./page.module.css";
import { checkUsable, extractText } from "@/lib/parse/extract.ts";

/**
 * The one action: put a document in. The file is read in the browser and never
 * leaves it, which is the product's own constraint rather than a feature of
 * this page. Nothing is sent from here.
 */

type State =
  | { kind: "idle" }
  | { kind: "reading" }
  | { kind: "ok"; chars: number; preview: string }
  | { kind: "error"; message: string };

const PREVIEW_CHARS = 700;

export function DocumentEntry() {
  const fieldId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [dropping, setDropping] = useState(false);
  const [state, setState] = useState<State>({ kind: "idle" });

  function show(result: ReturnType<typeof checkUsable>) {
    if (!result.ok) {
      setState({ kind: "error", message: result.message });
      return;
    }
    setState({
      kind: "ok",
      chars: result.text.length,
      preview: result.text.slice(0, PREVIEW_CHARS),
    });
  }

  async function readFile(file: File) {
    setState({ kind: "reading" });
    const result = await extractText(file);
    if (result.ok) setText(result.text);
    show(result);
  }

  return (
    <div className={styles.entry}>
      <label className={styles.entryHead} htmlFor={fieldId}>
        The document
      </label>

      <textarea
        id={fieldId}
        className={`${styles.entryField} ${dropping ? styles.entryDrop : ""}`}
        placeholder="Paste the text of the agreement here."
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setState({ kind: "idle" });
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

      <div className={styles.entryActions}>
        <button
          type="button"
          className={styles.submit}
          disabled={text.trim().length === 0 || state.kind === "reading"}
          onClick={() => show(checkUsable(text))}
        >
          {state.kind === "reading" ? "Reading" : "Show the text"}
        </button>

        <label className={styles.fileLabel} htmlFor={`${fieldId}-file`}>
          or drop a plain text file
        </label>
        <input
          ref={fileRef}
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

      {state.kind === "error" && (
        <p className={styles.entryError} role="alert">
          {state.message}
        </p>
      )}

      {state.kind === "ok" && (
        <div className={styles.entryOk}>
          <p>
            <span className={styles.entryOkFigure}>
              {state.chars.toLocaleString("en-GB")} characters
            </span>{" "}
            read in this browser. Nothing has been sent anywhere.
          </p>
          <p className={`${styles.entryPreview} docType`}>{state.preview}</p>
        </div>
      )}

      <p className={styles.entryNote}>
        Redline reads the file here, in your browser. Only the text you confirm
        is ever sent on, and the file itself is never stored.
      </p>
    </div>
  );
}
