/**
 * The release gates. One command, both gates, a result per document.
 *
 *   pnpm gates              the real pipeline against the real model
 *   pnpm gates -- --dry     the same gates against the readings recorded on disk
 *
 * PRD §4.2 and §4.4 gate a release. PRD §4.3 is reported and never gates
 * (spec D9). Which documents it runs against, and which of them are real, is
 * gold-set/README.md's business; the gate logic is src/lib/gold-set/gates.ts.
 *
 * Without --dry this spends money and calls the model once or twice per
 * document. The provider rate-limits hard, so documents go one at a time and a
 * 429 waits and asks again rather than failing the document. A rate limit is
 * not a gate failure. If a document never gets a reading, the run says so and
 * exits non-zero: an unknown is not a pass.
 */
import { enforce, analyze } from "../src/lib/analysis/analyze.ts";
import { SEED_RED_LINES } from "../src/lib/analysis/red-lines.ts";
import type { Analysis, CallModel } from "../src/lib/analysis/types.ts";
import { coverage, coverageLine, listGoldSet } from "../src/lib/gold-set/entries.ts";
import type { GoldEntry } from "../src/lib/gold-set/entries.ts";
import {
  SEVERITY_AGREEMENT_TARGET,
  judge,
  failed,
} from "../src/lib/gold-set/gates.ts";
import type { DocumentVerdict } from "../src/lib/gold-set/gates.ts";
import {
  ConfigError,
  UpstreamBusyError,
  openRouterCaller,
} from "../src/lib/openrouter.ts";

const dry = process.argv.includes("--dry");

/** How long to wait after a 429, in seconds, and how many times to try. */
const BACKOFF_SECONDS = [20, 45, 90];
/** A pause between documents, so the run is not itself the thing that trips the limit. */
const BETWEEN_DOCUMENTS_SECONDS = 3;

const rule = (ch = "-") => console.log(ch.repeat(78));
const sleep = (seconds: number) =>
  new Promise((resolve) => setTimeout(resolve, seconds * 1000));

const entries = listGoldSet();
const cover = coverage(entries);

console.log(`\nRedline release gates`);
rule("=");
// The first thing anyone reads. A run against synthetic documents has to say
// so here, or it reads as a pass.
console.log(coverageLine(cover));
console.log(
  `gold set         ${entries.length} entr${entries.length === 1 ? "y" : "ies"} on disk: ` +
    `${cover.realDangerous + cover.realClean} real, ` +
    `${cover.syntheticDangerous + cover.syntheticClean} synthetic`,
);
console.log(
  dry
    ? `model            not called. --dry runs the gates against the readings recorded on disk.`
    : `model            ${process.env.OPENROUTER_MODEL ?? "(OPENROUTER_MODEL is not set)"}`,
);
console.log(`red lines        ${SEED_RED_LINES.length} seeded`);
rule("=");

if (entries.length === 0) {
  console.error(`\nThere is nothing in gold-set/ to run the gates against.\n`);
  process.exit(1);
}

// One path to the model for the whole run. Built here rather than per
// document so a missing key stops the run now, with the name of what is
// missing, instead of looking like fifteen documents the provider refused.
let callModel: CallModel | null = null;
if (!dry) {
  try {
    callModel = openRouterCaller();
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    console.error(`\n${error.message}. Set it in .env.local, or run with --dry.\n`);
    process.exit(1);
  }
}

const verdicts: DocumentVerdict[] = [];
/** Documents the provider never gave a reading for. Not a gate failure. */
const unreached: { name: string; why: string }[] = [];

for (const [index, entry] of entries.entries()) {
  if (!dry && index > 0) await sleep(BETWEEN_DOCUMENTS_SECONDS);

  console.log(`\n${entry.name}  (${entry.provenance}, ${entry.kind})`);
  rule();
  console.log(`  document   ${entry.documentPath}  (${entry.documentText.length} characters)`);
  console.log(`  identified ${entry.identified.length} clause(s) in advance`);

  let analysis: Analysis;
  try {
    analysis =
      callModel === null ? readRecorded(entry) : await readLive(entry, callModel);
  } catch (error) {
    const why =
      error instanceof UpstreamBusyError
        ? `the provider stayed busy through ${BACKOFF_SECONDS.length + 1} attempts`
        : (error as Error).message;
    unreached.push({ name: entry.name, why });
    console.log(`  NOT RUN    ${why}`);
    continue;
  }

  const verdict = judge(entry, analysis);
  verdicts.push(verdict);
  report(verdict);
}

rule("=");
console.log(`\nSUMMARY`);
rule();

const passed = verdicts.filter((v) => !failed(v));
const failures = verdicts.filter(failed);

console.log(`  documents run    ${verdicts.length} of ${entries.length}`);
console.log(`  passed           ${passed.length}`);
console.log(`  failed           ${failures.length}`);
console.log(`  not run          ${unreached.length}`);

// The severity measure, totalled across every document. Printed, never
// allowed near the exit code (spec D9).
const compared = verdicts.reduce((n, v) => n + v.severity.compared, 0);
const agreed = verdicts.reduce((n, v) => n + v.severity.agreed, 0);
const offByTwo = verdicts.flatMap((v) => v.severity.offByTwo);
console.log(
  `  severity         ${agreed} of ${compared} tiers match${
    compared > 0 ? ` (${percent(agreed / compared)}, target ${percent(SEVERITY_AGREEMENT_TARGET)})` : ""
  }, ${offByTwo.length} off by two. Reported, not gating.`,
);

for (const v of failures) {
  console.log(`\n  FAILED  ${v.name}`);
  for (const line of v.failures) console.log(`    ${line}`);
}
for (const u of unreached) {
  console.log(`\n  NOT RUN  ${u.name}`);
  console.log(`    ${u.why}`);
}

console.log("");
rule("=");
// Printed twice on purpose: at the top before anyone has read a result, and
// here where they decide what the run means.
console.log(coverageLine(cover));

const reasons: string[] = [];
if (failures.length > 0) {
  reasons.push(
    `FAILED: ${failures.length} document(s) did not clear a gate that blocks a release.`,
  );
}
if (unreached.length > 0) {
  reasons.push(
    `INCOMPLETE: ${unreached.length} document(s) never got a reading, so the gates did not run on them.`,
  );
}
if (!cover.met) {
  reasons.push(
    `INCOMPLETE: the gold set holds ${cover.realDangerous} real dangerous document(s) and ${cover.realClean} real clean one(s), against the ${cover.targetDangerous} and ${cover.targetClean} PRD 4.5 asks for. Synthetic documents test the tool against whoever wrote them, so they do not count. Nothing here clears a release until the real documents arrive.`,
  );
}

if (reasons.length === 0) {
  console.log(
    `\nBoth gates cleared on all ${verdicts.length} documents of a complete gold set.\n`,
  );
  process.exit(0);
}

for (const reason of reasons) console.error(`\n${reason}`);
console.error("");
process.exit(1);

/**
 * --dry. The reading recorded for this document, put through the same rules
 * the live path applies after the model answers: the red lines in force decide
 * which clause types exist and what tier each earns, and a flag whose sentence
 * cannot be placed in the document is dropped before anyone sees it.
 */
function readRecorded(entry: GoldEntry): Analysis {
  return enforce(entry.documentText, SEED_RED_LINES, entry.recorded);
}

/**
 * The real pipeline against the real model, one document at a time. A 429
 * means the request never got a turn, so the document waits and asks again.
 */
async function readLive(entry: GoldEntry, callModel: CallModel): Promise<Analysis> {
  for (let attempt = 0; ; attempt += 1) {
    const started = Date.now();
    try {
      const analysis = await analyze({
        documentText: entry.documentText,
        redLines: SEED_RED_LINES,
        callModel,
      });
      console.log(`  read in    ${((Date.now() - started) / 1000).toFixed(1)}s`);
      return analysis;
    } catch (error) {
      if (!(error instanceof UpstreamBusyError) || attempt >= BACKOFF_SECONDS.length) {
        throw error;
      }
      const wait = BACKOFF_SECONDS[attempt];
      console.log(
        `  busy       the provider refused the turn. Waiting ${wait}s and asking again.`,
      );
      await sleep(wait);
    }
  }
}

function report(v: DocumentVerdict): void {
  if (v.catches) {
    const c = v.catches;
    console.log(
      `  catches what matters   ${c.caught} of ${c.identified} Critical clause(s) flagged` +
        (c.passed ? "" : `. Missing: ${c.missing.join(", ")}`),
    );
  }

  if (v.clean) {
    const c = v.clean;
    console.log(
      `  clean document         ${c.criticalFlags} Critical, ${c.flagCount} flag(s), ` +
        `the summary ${c.saysItLooksReasonable ? "says" : "does not say"} the document looks reasonable`,
    );
    for (const reason of c.failures) console.log(`                         ${reason}`);
  }

  const s = v.severity;
  console.log(
    `  severity defensible    ` +
      (s.compared === 0
        ? `nothing to compare`
        : `${s.agreed} of ${s.compared} tiers match (${percent(s.agreement ?? 0)}), ${s.offByTwo.length} off by two`) +
      `. Reported, not gating.`,
  );
  for (const d of s.disagreements) {
    console.log(
      `                         ${d.clauseType}: identified ${d.identified}, came back ${d.returned} (${d.tiers} tier${d.tiers === 1 ? "" : "s"} apart)`,
    );
  }
  if (s.notFlagged > 0) {
    console.log(
      `                         ${s.notFlagged} identified clause(s) never flagged, so no tier to compare`,
    );
  }

  console.log(
    `  citations              ${v.citations.checked - v.citations.unlocatable.length} of ${v.citations.checked} source sentence(s) found in the document`,
  );
  for (const quote of v.citations.unlocatable) {
    console.log(`                         not in the document: ${quote}`);
  }

  console.log(`  ${failed(v) ? "FAIL" : "PASS"}`);
}

function percent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}
