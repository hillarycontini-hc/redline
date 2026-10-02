import styles from "./page.module.css";
import { DocumentEntry } from "./document-entry";
import { StatementEntries } from "./statement-entries";
import { readWorkedExample } from "./worked-example";

export default function Home() {
  const example = readWorkedExample();

  return (
    <main className={styles.page}>
      <article className={styles.sheet}>
        <header className={styles.head} id="top">
          <div className={styles.headLeft}>
            <p className={styles.account}>
              <span>Redline</span>
              <span className={styles.accountRule} aria-hidden="true" />
              <span>Statement of account</span>
            </p>

            <h1 className={styles.hook}>
              What this contract commits you to, line by line.
            </h1>

            <p className={styles.hookSub}>
              Redline reads the agreement you have been handed and returns a
              statement of what it costs you. Every line quotes the sentence it
              came from, so you can find that sentence in your own copy and
              check it. It reads contracts, leases, freelance agreements, and
              terms of service, as text.
            </p>
          </div>

          <DocumentEntry />
        </header>

        <section className={styles.statement}>
          <div className={styles.statementHead}>
            <div>
              <h2 className={styles.statementTitle}>
                A worked example, on a synthetic agreement.
              </h2>
              <p className={styles.statementSub}>
                The document below was written for testing and belongs to no
                one. Everything on this statement comes out of it, unedited.
                Select any line to bring its sentence into alignment.
              </p>
            </div>

            <p className={styles.summary}>
              <span className={styles.summaryHead}>Summary</span>
              {example.summary}
            </p>
          </div>

          <div className={styles.columns}>
            <span>What you are agreeing to</span>
            <span>The sentence it came from</span>
            <span className={styles.columnTier}>Tier</span>
          </div>

          <StatementEntries entries={example.entries} />

          <p className={styles.foot}>
            <span>
              <span className={styles.footFigure}>
                {example.entries.length}
              </span>{" "}
              lines on this statement
            </span>
            <span>
              <span className={styles.footFigure}>{example.droppedCount}</span>{" "}
              dropped for want of a source sentence
            </span>
          </p>
        </section>

        <section className={styles.notes}>
          <h2 className={styles.notesTitle}>What this statement does not say.</h2>
          <ul className={styles.notesList}>
            <li className={styles.notesItem}>
              Redline does not tell you whether to sign. It tells you what the
              document says, and the decision stays yours.
            </li>
            <li className={styles.notesItem}>
              It does not tell you how a court would treat a clause. It flags
              the clause for what it commits you to.
            </li>
            <li className={styles.notesItem}>
              If Redline cannot find a flag&rsquo;s sentence in your document,
              it does not show the flag.
            </li>
            <li className={styles.notesItem}>
              Redline reads text. It cannot read a photograph or an image of a
              document, and it will not quote text it might have misread.
            </li>
          </ul>
        </section>

        <footer className={styles.close}>
          <p className={styles.closeText}>
            Put the agreement you are holding through it, before you sign.
          </p>
          <a className={styles.closeLink} href="#top">
            Back to the entry
          </a>
        </footer>
      </article>
    </main>
  );
}
