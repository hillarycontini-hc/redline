/**
 * The counter-offer pass, run against the gold fixture with a stub model.
 *
 * The first call's payload is built from the sidecar on disk, so no sentence
 * is typed into this file. What each test changes is what the model leaves
 * out, which is the case the reader is exposed to: a Critical flag with
 * nothing to send back.
 *
 * Everything asserted here is something the reader would see on screen —
 * which flags came back, which carry replacement wording, which sentence that
 * wording belongs to — or something the log records. Never the prompt.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyze } from "./analyze.ts";
import { locate } from "./citation.ts";
import { SEED_RED_LINES, requiresCounterOffer } from "./red-lines.ts";
import type { ChatMessage, ModelFlag, ModelResponse, Severity } from "./types.ts";

const FIXTURES = join(process.cwd(), "tests", "fixtures");

interface PlantedClause {
  clauseType: string;
  expectedSeverity: Severity;
  sourceSentence: string;
  consequence: string;
  counterOffer: string | null;
}

interface Sidecar {
  filename: string;
  summaryMustMention: string[];
  plantedClauses: PlantedClause[];
}

const sidecar = JSON.parse(
  readFileSync(join(FIXTURES, "adhesion-contract.json"), "utf8"),
) as Sidecar;
const documentText = readFileSync(join(FIXTURES, sidecar.filename), "utf8");

/** The two clause types whose counter-offer each test takes away. */
const WITHHELD_CRITICAL = "ip-before-payment";
const WITHHELD_SERIOUS = "unilateral-termination";

function planted(withhold: readonly string[]): ModelFlag[] {
  return sidecar.plantedClauses.map((c) => {
    const flag: ModelFlag = {
      clauseType: c.clauseType,
      sourceSentence: c.sourceSentence,
      consequence: c.consequence,
      confidence: "high",
    };
    if (c.counterOffer !== null && !withhold.includes(c.clauseType)) {
      flag.counterOffer = c.counterOffer;
    }
    return flag;
  });
}

function sentenceOf(clauseType: string): string {
  const clause = sidecar.plantedClauses.find((c) => c.clauseType === clauseType);
  assert.ok(clause, `the fixture has no ${clauseType} clause planted`);
  return clause.sourceSentence;
}

/**
 * A model that reads the document on its first call and drafts replacement
 * wording on any call after it. `draft` sees the second call's own payload, so
 * a test can answer the refs it was actually asked about. The stub is of the
 * model; the module under test is never stubbed.
 */
function stubModel(
  withhold: readonly string[],
  draft: (asked: Record<string, unknown>[]) => unknown,
) {
  const sent: ChatMessage[][] = [];

  const callModel = async (messages: ChatMessage[]) => {
    sent.push(messages);

    if (sent.length === 1) {
      const payload: ModelResponse = {
        summary: `What this document commits the signer to: ${sidecar.summaryMustMention.join("; ")}.`,
        flags: planted(withhold),
      };
      return JSON.stringify(payload);
    }

    const body = messages[1].content;
    const asked = JSON.parse(body.slice(body.indexOf("{"))) as {
      clauses: Record<string, unknown>[];
    };
    return JSON.stringify(draft(asked.clauses));
  };

  return {
    callModel,
    get calls() {
      return sent.length;
    },
    /** What the drafting call was asked about, as the model received it. */
    asked(): Record<string, unknown>[] {
      assert.ok(sent.length > 1, "no counter-offer call was made");
      const body = sent[1][1].content;
      return (
        JSON.parse(body.slice(body.indexOf("{"))) as {
          clauses: Record<string, unknown>[];
        }
      ).clauses;
    },
  };
}

/** Drafts wording for every ref it is asked about. */
const draftsEverything = (asked: Record<string, unknown>[]) => ({
  counterOffers: asked.map((clause) => ({
    ref: clause.ref,
    counterOffer: `Replacement wording for ${String(clause.clauseType)}, standing in place of the sentence it was asked about.`,
  })),
});

function read(
  withhold: readonly string[],
  draft: (asked: Record<string, unknown>[]) => unknown,
) {
  const model = stubModel(withhold, draft);
  return {
    model,
    analysis: analyze({ documentText, redLines: SEED_RED_LINES, callModel: model.callModel }),
  };
}

test("a Critical flag the model left without replacement wording comes back with some", async () => {
  const { model, analysis } = read(
    [WITHHELD_CRITICAL, WITHHELD_SERIOUS],
    draftsEverything,
  );
  const out = await analysis;

  const critical = out.flags.find((f) => f.clauseType === WITHHELD_CRITICAL);
  const serious = out.flags.find((f) => f.clauseType === WITHHELD_SERIOUS);

  assert.ok(critical, "the Critical flag the model under-answered is not on the statement");
  assert.ok(serious, "the Serious flag the model under-answered is not on the statement");
  assert.equal(critical.severity, "Critical");
  assert.equal(serious.severity, "Serious");

  assert.ok(
    critical.counterOffer && critical.counterOffer.length > 0,
    "a Critical flag reached the reader with nothing to send back",
  );
  assert.ok(
    serious.counterOffer && serious.counterOffer.length > 0,
    "a Serious flag reached the reader with nothing to send back",
  );

  // Nothing was dropped to get there, and no gap is left on the record.
  assert.deepEqual(out.dropped, []);
  assert.deepEqual(out.missingCounterOffers, []);
  assert.equal(out.flags.length, sidecar.plantedClauses.length);
  assert.equal(model.calls, 2);
});

test("every Critical and Serious flag on the statement carries replacement wording", async () => {
  const { analysis } = read([WITHHELD_CRITICAL, WITHHELD_SERIOUS], draftsEverything);
  const out = await analysis;

  const bare = out.flags
    .filter((f) => requiresCounterOffer(f.severity) && !f.counterOffer)
    .map((f) => `[${f.severity}] ${f.clauseType}`);

  assert.deepEqual(bare, [], bare.join("\n  "));
});

test("a flag is never dropped for want of replacement wording, and the gap is recorded", async () => {
  // The drafting call comes back with nothing usable: a note instead of
  // wording, and an entry for a clause that was never asked about.
  const { model, analysis } = read([WITHHELD_CRITICAL], () => ({
    counterOffers: [
      { ref: 0, counterOffer: "   " },
      { ref: 41, counterOffer: "Wording for a clause nobody asked about." },
    ],
  }));
  const out = await analysis;

  const critical = out.flags.find((f) => f.clauseType === WITHHELD_CRITICAL);
  assert.ok(critical, "the flag was dropped for want of a counter-offer");
  assert.equal(critical.counterOffer, undefined);

  // It still cites its sentence, and the sentence is still the document's own.
  assert.equal(critical.sourceSentence, sentenceOf(WITHHELD_CRITICAL));
  assert.equal(
    documentText.slice(critical.location.start, critical.location.end),
    critical.sourceSentence,
  );

  // The gap is on the record rather than silent.
  assert.deepEqual(out.missingCounterOffers, [
    {
      clauseType: WITHHELD_CRITICAL,
      severity: "Critical",
      sourceSentence: sentenceOf(WITHHELD_CRITICAL),
    },
  ]);
  assert.deepEqual(out.dropped, []);
  assert.equal(out.flags.length, sidecar.plantedClauses.length);
  assert.equal(model.calls, 2);
});

test("the reading survives a drafting call that falls over", async () => {
  const model = stubModel([WITHHELD_CRITICAL], () => ({}));
  let calls = 0;
  const callModel = async (messages: ChatMessage[]) => {
    calls += 1;
    if (calls > 1) throw new Error("the drafting call fell over");
    return model.callModel(messages);
  };

  const out = await analyze({ documentText, redLines: SEED_RED_LINES, callModel });

  assert.equal(out.flags.length, sidecar.plantedClauses.length);
  assert.ok(out.summary.length > 0);
  assert.equal(out.missingCounterOffers.length, 1);
  assert.equal(out.missingCounterOffers[0].clauseType, WITHHELD_CRITICAL);
});

test("Worth knowing is never sent for drafting and never gets replacement wording", async () => {
  const worthKnowing = sidecar.plantedClauses
    .filter((c) => c.expectedSeverity === "Worth knowing")
    .map((c) => c.clauseType);
  assert.ok(worthKnowing.length > 0, "the fixture plants no Worth-knowing clause");

  // Draft for everything asked about, so the only reason a Worth-knowing flag
  // ends up without wording is that it was never sent.
  const { model, analysis } = read(
    [WITHHELD_CRITICAL, WITHHELD_SERIOUS],
    draftsEverything,
  );
  const out = await analysis;

  const sentTypes = model.asked().map((clause) => clause.clauseType);
  for (const clauseType of worthKnowing) {
    assert.ok(
      !sentTypes.includes(clauseType),
      `${clauseType} is Worth knowing and was sent for drafting`,
    );
  }
  assert.ok(
    !model.asked().some((clause) => clause.severity === "Worth knowing"),
    "a Worth-knowing clause was sent for drafting",
  );

  const wrong = out.flags
    .filter((f) => f.severity === "Worth knowing" && f.counterOffer !== undefined)
    .map((f) => f.clauseType);
  assert.deepEqual(wrong, [], `Worth knowing carried wording: ${wrong.join(", ")}`);
});

test("drafted wording points at the same source sentence as its flag, and that sentence is in the document", async () => {
  // The stub answers each ref with the sentence it was given, so the wording
  // can be matched back to the flag it belongs to.
  const { model, analysis } = read([WITHHELD_CRITICAL, WITHHELD_SERIOUS], (asked) => ({
    counterOffers: asked.map((clause) => ({
      ref: clause.ref,
      counterOffer: `In place of: ${String(clause.sourceSentence)}`,
    })),
  }));
  const out = await analysis;

  const asked = model.asked();
  assert.equal(asked.length, 2);

  for (const clauseType of [WITHHELD_CRITICAL, WITHHELD_SERIOUS]) {
    const flag = out.flags.find((f) => f.clauseType === clauseType);
    assert.ok(flag?.counterOffer, `${clauseType} came back with no wording`);

    // The wording carries the sentence it was drafted against, and it is the
    // flag's own sentence.
    assert.equal(flag.counterOffer, `In place of: ${flag.sourceSentence}`);

    // And that sentence is locatable in the document, at the range the flag
    // points at. ADR 0001 holds for the clause the counter-offer replaces.
    const at = locate(documentText, flag.sourceSentence);
    assert.ok(at, `${clauseType} cites a sentence that is not in the document`);
    assert.deepEqual(at, flag.location);
  }
});

test("no second call is made when the model already drafted every counter-offer", async () => {
  const { model, analysis } = read([], () => {
    assert.fail("the model was asked to draft wording it had already supplied");
  });
  const out = await analysis;

  assert.equal(model.calls, 1);
  assert.deepEqual(out.missingCounterOffers, []);

  const bare = out.flags
    .filter((f) => requiresCounterOffer(f.severity) && !f.counterOffer)
    .map((f) => f.clauseType);
  assert.deepEqual(bare, []);
});

test("the source sentence handed back unchanged is not accepted as a replacement for it", async () => {
  const { analysis } = read([WITHHELD_CRITICAL], (asked) => ({
    counterOffers: asked.map((clause) => ({
      ref: clause.ref,
      counterOffer: String(clause.sourceSentence),
    })),
  }));
  const out = await analysis;

  const critical = out.flags.find((f) => f.clauseType === WITHHELD_CRITICAL);
  assert.ok(critical, "the flag was dropped");
  assert.equal(critical.counterOffer, undefined);
  assert.equal(out.missingCounterOffers.length, 1);
});
