import type { RedLine, Severity } from "./types.ts";

/**
 * The seeded default every account starts with. PRD §5, signed off 2026-09-11.
 * Unlimited revisions was dropped (spec D1). The user may add, delete, or
 * re-tier any entry; a user's entry overrides the tier here (spec D3).
 */
export const SEED_RED_LINES: readonly RedLine[] = [
  {
    clauseType: "personal-guarantee",
    label: "Personal guarantee",
    description:
      "The reader personally guarantees the obligations of a business, so liability survives the business closing or going bankrupt.",
    severity: "Critical",
  },
  {
    clauseType: "ip-before-payment",
    label: "IP assignment before full payment",
    description:
      "Ownership of the work product transfers to the client on creation or delivery rather than on full payment, so the client owns the work whether or not they pay.",
    severity: "Critical",
  },
  {
    clauseType: "uncapped-indemnity",
    label: "Uncapped indemnity",
    description:
      "The reader agrees to indemnify, defend, or hold harmless the other party with no cap on the amount, so exposure is unbounded.",
    severity: "Critical",
  },
  {
    clauseType: "non-compete",
    label: "Non-compete or exclusivity",
    description:
      "The reader is restricted from working with other clients, competitors, or in a field, during or after the engagement.",
    severity: "Serious",
  },
  {
    clauseType: "slow-payment-no-late-fee",
    label: "Payment terms worse than net-30 with no late fee",
    description:
      "Payment is due more than 30 days after invoice, or on an undefined trigger, and there is no late fee or interest for non-payment.",
    severity: "Serious",
  },
  {
    clauseType: "unilateral-termination",
    label: "Unilateral termination with no kill fee",
    description:
      "The client can terminate at will, with little or no notice, and owes nothing for work scheduled or in progress.",
    severity: "Serious",
  },
  {
    clauseType: "auto-renewal",
    label: "Auto-renewal",
    description:
      "The agreement renews automatically unless cancelled within a window, especially a short or unusual one.",
    severity: "Worth knowing",
  },
  {
    clauseType: "arbitration",
    label: "Arbitration or class-action waiver",
    description:
      "Disputes must go to binding arbitration, or the reader waives the right to join a class action.",
    severity: "Worth knowing",
  },
];

const ORDER: Record<Severity, number> = {
  Critical: 0,
  Serious: 1,
  "Worth knowing": 2,
};

export function compareSeverity(a: Severity, b: Severity): number {
  return ORDER[a] - ORDER[b];
}

/** One step less severe. "Worth knowing" is the floor. */
export function lowerTier(s: Severity): Severity {
  if (s === "Critical") return "Serious";
  return "Worth knowing";
}

export function requiresCounterOffer(s: Severity): boolean {
  return s !== "Worth knowing";
}
