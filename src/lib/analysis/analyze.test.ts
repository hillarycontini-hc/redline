import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze, enforce, parseModelResponse } from "./analyze.ts";
import { SEED_RED_LINES } from "./red-lines.ts";
import type { ModelResponse, RedLine } from "./types.ts";

const DOC = `INDEPENDENT CONTRACTOR AGREEMENT

1. Ownership. All Work Product shall be the sole property of the Client upon creation, regardless of payment status.

2. Disputes. Any dispute arising under this Agreement shall be resolved by binding arbitration.

3. Renewal. This Agreement shall automatically renew for successive one-year terms unless either party gives thirty days written notice.

4. Termination. The Client may terminate this Agreement at any time, for any reason, without further obligation.`;

const ARBITRATION_SENTENCE =
  "Any dispute arising under this Agreement shall be resolved by binding arbitration.";

function response(flags: ModelResponse["flags"], summary = "A summary."): ModelResponse {
  return { summary, flags };
}

test("a flag whose quote is not in the document is dropped, the rest survive", () => {
  const out = enforce(
    DOC,
    SEED_RED_LINES,
    response([
      {
        clauseType: "ip-before-payment",
        sourceSentence: "The client owns everything even if they never pay.",
        consequence: "c",
        confidence: "high",
        counterOffer: "o",
      },
      {
        clauseType: "arbitration",
        sourceSentence: ARBITRATION_SENTENCE,
        consequence: "c",
        confidence: "high",
      },
    ]),
  );
  assert.equal(out.flags.length, 1);
  assert.equal(out.flags[0].clauseType, "arbitration");
  assert.equal(out.dropped.length, 1);
  assert.equal(out.dropped[0].reason, "unlocatable-source");
});

test("the rendered source sentence is the document's own characters", () => {
  const out = enforce(
    DOC,
    SEED_RED_LINES,
    response([
      {
        clauseType: "arbitration",
        sourceSentence: "Any dispute arising under this Agreement   shall be resolved by binding arbitration.",
        consequence: "c",
        confidence: "high",
      },
    ]),
  );
  assert.equal(out.flags[0].sourceSentence, ARBITRATION_SENTENCE);
  assert.equal(
    DOC.slice(out.flags[0].location.start, out.flags[0].location.end),
    ARBITRATION_SENTENCE,
  );
});

test("a user red line overrides the seeded tier and earns a counter-offer", () => {
  const redLines: RedLine[] = SEED_RED_LINES.map((r) =>
    r.clauseType === "arbitration" ? { ...r, severity: "Critical" } : r,
  );
  const out = enforce(
    DOC,
    redLines,
    response([
      {
        clauseType: "arbitration",
        sourceSentence: ARBITRATION_SENTENCE,
        consequence: "c",
        confidence: "high",
        counterOffer: "Disputes shall be resolved in the courts of the State.",
      },
    ]),
  );
  assert.equal(out.flags[0].severity, "Critical");
  assert.equal(out.flags[0].counterOffer, "Disputes shall be resolved in the courts of the State.");
});

test("a deleted red line means that clause type is not flagged", () => {
  const redLines = SEED_RED_LINES.filter((r) => r.clauseType !== "auto-renewal");
  const out = enforce(
    DOC,
    redLines,
    response([
      {
        clauseType: "auto-renewal",
        sourceSentence:
          "This Agreement shall automatically renew for successive one-year terms unless either party gives thirty days written notice.",
        consequence: "c",
        confidence: "high",
      },
    ]),
  );
  assert.equal(out.flags.length, 0);
  assert.equal(out.dropped[0].reason, "unknown-clause-type");
});

test("a clause type the model invents is dropped", () => {
  const out = enforce(
    DOC,
    SEED_RED_LINES,
    response([
      {
        clauseType: "scary-font",
        sourceSentence: ARBITRATION_SENTENCE,
        consequence: "c",
        confidence: "high",
      },
    ]),
  );
  assert.equal(out.flags.length, 0);
  assert.equal(out.dropped[0].reason, "unknown-clause-type");
});

test("Worth knowing flags never carry a counter-offer", () => {
  const out = enforce(
    DOC,
    SEED_RED_LINES,
    response([
      {
        clauseType: "arbitration",
        sourceSentence: ARBITRATION_SENTENCE,
        consequence: "c",
        confidence: "high",
        counterOffer: "This should be stripped.",
      },
    ]),
  );
  assert.equal(out.flags[0].severity, "Worth knowing");
  assert.equal(out.flags[0].counterOffer, undefined);
});

test("low confidence lowers the tier by one step, and Worth knowing is the floor", () => {
  const out = enforce(
    DOC,
    SEED_RED_LINES,
    response([
      {
        clauseType: "ip-before-payment",
        sourceSentence:
          "All Work Product shall be the sole property of the Client upon creation, regardless of payment status.",
        consequence: "c",
        confidence: "low",
        counterOffer: "o",
      },
      {
        clauseType: "arbitration",
        sourceSentence: ARBITRATION_SENTENCE,
        consequence: "c",
        confidence: "low",
      },
    ]),
  );
  const ip = out.flags.find((f) => f.clauseType === "ip-before-payment");
  const arb = out.flags.find((f) => f.clauseType === "arbitration");
  assert.equal(ip?.severity, "Serious");
  assert.equal(arb?.severity, "Worth knowing");
});

test("flags are ranked Critical, Serious, Worth knowing", () => {
  const out = enforce(
    DOC,
    SEED_RED_LINES,
    response([
      {
        clauseType: "arbitration",
        sourceSentence: ARBITRATION_SENTENCE,
        consequence: "c",
        confidence: "high",
      },
      {
        clauseType: "unilateral-termination",
        sourceSentence:
          "The Client may terminate this Agreement at any time, for any reason, without further obligation.",
        consequence: "c",
        confidence: "high",
        counterOffer: "o",
      },
      {
        clauseType: "ip-before-payment",
        sourceSentence:
          "All Work Product shall be the sole property of the Client upon creation, regardless of payment status.",
        consequence: "c",
        confidence: "high",
        counterOffer: "o",
      },
    ]),
  );
  assert.deepEqual(
    out.flags.map((f) => f.severity),
    ["Critical", "Serious", "Worth knowing"],
  );
});

test("a malformed flag is dropped without throwing", () => {
  const out = enforce(DOC, SEED_RED_LINES, {
    summary: "s",
    flags: [{ nonsense: true } as unknown as ModelResponse["flags"][number]],
  });
  assert.equal(out.flags.length, 0);
  assert.equal(out.dropped[0].reason, "malformed");
});

test("parseModelResponse strips a code fence and rejects non-JSON", () => {
  const ok = parseModelResponse('```json\n{"summary":"s","flags":[]}\n```');
  assert.equal(ok.summary, "s");
  assert.throws(() => parseModelResponse("not json"), /valid JSON/);
  assert.throws(() => parseModelResponse('{"summary":1}'), /shape/);
});

test("analyze() calls the model once with the red lines and document", async () => {
  const calls: string[] = [];
  const out = await analyze({
    documentText: DOC,
    redLines: SEED_RED_LINES,
    callModel: async (messages) => {
      calls.push(messages.map((m) => m.role).join(","));
      const user = messages[1].content;
      assert.ok(user.includes("clauseType: arbitration"));
      assert.ok(user.includes("INDEPENDENT CONTRACTOR AGREEMENT"));
      return JSON.stringify(
        response([
          {
            clauseType: "arbitration",
            sourceSentence: ARBITRATION_SENTENCE,
            consequence: "c",
            confidence: "high",
          },
        ]),
      );
    },
  });
  assert.deepEqual(calls, ["system,user"]);
  assert.equal(out.flags.length, 1);
});
