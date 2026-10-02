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

rule("=");
if (unlocatable > 0) {
  console.error(`\nFAILED: ${unlocatable} flag(s) cited a sentence that is not in the document.`);
  console.error("ADR 0001: a flag whose source sentence cannot be shown is a bug, not a gap.\n");
  process.exit(1);
}
console.log(`\nEvery flag shown cites a sentence that is really in the document.\n`);
