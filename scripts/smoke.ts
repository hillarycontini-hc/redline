/**
 * The smoke run. One fixture, the real pipeline, the real model.
 *
 *   pnpm smoke            the adhesion contract, which should come back full
 *   pnpm smoke --clean    the fair agreement, which should come back quiet
 *
 * This is the only script in the build that spends money. It exists because
 * the unit suite stubs the model, so nothing else proves the whole path works:
 * env to OpenRouter to the analysis seam to the citation check.
 *
 * It fails loudly if any flag's source sentence cannot be found in the
 * document. That is ADR 0001 checked against a live reading rather than
 * against a recorded one.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyze } from "../src/lib/analysis/analyze.ts";
import { locate } from "../src/lib/analysis/citation.ts";
import { DOCUMENT_DOES_NOT_ADDRESS, ask } from "../src/lib/analysis/question.ts";
import { SEED_RED_LINES } from "../src/lib/analysis/red-lines.ts";
import { openRouterCaller } from "../src/lib/openrouter.ts";

const clean = process.argv.includes("--clean");
const fixture = clean ? "clean-agreement" : "adhesion-contract";
const dir = join(process.cwd(), "tests", "fixtures");

const documentText = readFileSync(join(dir, `${fixture}.txt`), "utf8");
const sidecar = JSON.parse(
  readFileSync(join(dir, `${fixture}.json`), "utf8"),
) as { plantedClauses: { clauseType: string; expectedSeverity: string }[] };

const rule = (ch = "-") => console.log(ch.repeat(78));

console.log(`\nRedline smoke run`);
rule("=");
console.log(`document     ${fixture}.txt  (${documentText.length} characters)`);
console.log(`model        ${process.env.OPENROUTER_MODEL ?? "(OPENROUTER_MODEL is not set)"}`);
console.log(`red lines    ${SEED_RED_LINES.length} seeded`);
console.log(`planted      ${sidecar.plantedClauses.length}`);
rule("=");

const started = Date.now();
const analysis = await analyze({
  documentText,
  redLines: SEED_RED_LINES,
  callModel: openRouterCaller(),
});
const seconds = ((Date.now() - started) / 1000).toFixed(1);

console.log(`\nSUMMARY  (${seconds}s)`);
rule();
console.log(analysis.summary || "(the model returned no summary)");

console.log(`\nFLAGS  (${analysis.flags.length})`);
rule();

let unlocatable = 0;
for (const flag of analysis.flags) {
  const found = locate(documentText, flag.sourceSentence) !== null;
  if (!found) unlocatable += 1;
  console.log(`\n  ${flag.severity.toUpperCase()}  ${flag.clauseType}`);
  console.log(`  ${flag.consequence}`);
  console.log(`\n  the sentence it came from${found ? "" : "  *** NOT IN THE DOCUMENT ***"}:`);
  console.log(`    "${flag.sourceSentence}"`);
  if (flag.counterOffer) console.log(`\n  counter-offer:\n    ${flag.counterOffer}`);
  else console.log(`\n  counter-offer: none`);
}

if (analysis.flags.length === 0) {
  console.log("\n  Nothing flagged. On a fair agreement that is the right answer.");
}

console.log(`\nREFUSED  (${analysis.dropped.length})`);
rule();
for (const d of analysis.dropped) {
  console.log(`  ${d.reason}  ${d.clauseType ?? "(no clause type)"}`);
  if (d.sourceSentence) console.log(`    "${d.sourceSentence.slice(0, 160)}"`);
}
if (analysis.dropped.length === 0) console.log("  Nothing refused.");

// What the planted clauses say should have been caught.
const caught = new Set(analysis.flags.map((f) => f.clauseType));
const missed = sidecar.plantedClauses.filter((c) => !caught.has(c.clauseType));

console.log(`\nAGAINST THE SIDECAR`);
rule();
console.log(`  planted      ${sidecar.plantedClauses.length}`);
console.log(`  caught       ${sidecar.plantedClauses.length - missed.length}`);
console.log(`  missed       ${missed.length}${missed.length ? "  " + missed.map((m) => m.clauseType).join(", ") : ""}`);
console.log(`  shown        ${analysis.flags.length}`);
console.log(`  verified     ${analysis.flags.length - unlocatable} of ${analysis.flags.length} source sentences found in the document`);
console.log(`  no wording   ${analysis.missingCounterOffers.length}${analysis.missingCounterOffers.length ? "  " + analysis.missingCounterOffers.map((m) => m.clauseType).join(", ") : ""}`);

// The question box, on the same document and through the same live model. Two
// questions: one the document answers, and one it says nothing about. Each is
// asked on its own, so nothing from the first goes with the second.
const QUESTIONS = [
  "Can the other side end this agreement without paying for work already started?",
  "Does the Client pay for my health insurance?",
];

console.log(`\nQUESTION BOX`);
rule();

let unquotable = 0;
for (const question of QUESTIONS) {
  const answered = await ask({
    documentText,
    question,
    callModel: openRouterCaller(),
  });

  const fixed = answered.answer === DOCUMENT_DOES_NOT_ADDRESS;
  console.log(`\n  Q  ${question}`);
  console.log(`  A  ${answered.answer}`);

  if (answered.citations.length === 0) {
    console.log(
      `     nothing quoted${fixed ? "  (the fixed response)" : "  *** AN ANSWER WITH NOTHING BEHIND IT ***"}`,
    );
    if (!fixed) unquotable += 1;
  }

  for (const citation of answered.citations) {
    const found = locate(documentText, citation.sourceSentence) !== null;
    if (!found) unquotable += 1;
    console.log(
      `     the sentence it rests on${found ? "" : "  *** NOT IN THE DOCUMENT ***"}:`,
    );
    console.log(`       "${citation.sourceSentence}"`);
  }

  if (answered.dropped.length > 0) {
    console.log(`     refused  ${answered.dropped.length} quote(s) could not be placed`);
  }
}

rule("=");
if (unlocatable > 0 || unquotable > 0) {
  if (unlocatable > 0) {
    console.error(
      `\nFAILED: ${unlocatable} flag(s) cited a sentence that is not in the document.`,
    );
  }
  if (unquotable > 0) {
    console.error(
      `\nFAILED: ${unquotable} answer(s) reached the reader with no sentence behind them.`,
    );
  }
  console.error(
    "ADR 0001: a claim about the document whose sentence cannot be shown is a bug, not a gap.\n",
  );
  process.exit(1);
}
console.log(
  `\nEvery flag and every answer shown cites a sentence that is really in the document.\n`,
);
