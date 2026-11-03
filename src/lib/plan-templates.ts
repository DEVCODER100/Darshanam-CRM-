/**
 * plan-templates.ts — starting points for the instalment plan editor.
 * Stage-wise and bank-loan plans follow the construction stage ladder; the
 * editor fills these in and the user adjusts dates and amounts before saving.
 */
import { CONSTRUCTION_STAGES } from "./stage";
import { applyBasisPoints, roundedDiv } from "./money";

export interface PlanRow {
  label: string;
  percentBps: number; // share of the price, in basis points
  basic: bigint;
}

/** Each stage collects the step up from the previous stage (45%, 10%, 15%, ...). */
export const STAGE_STEPS = CONSTRUCTION_STAGES.map((s, i) => ({
  label: s.label,
  bps: s.percentBps - (CONSTRUCTION_STAGES[i - 1]?.percentBps ?? 0),
}));

const share = (amount: bigint, price: bigint) =>
  price > 0n ? Number(roundedDiv(amount * 10000n, price)) : 0;

/** Split `amount` across the stage steps; the last stage absorbs rounding. */
function spread(amount: bigint, price: bigint, prefix = ""): PlanRow[] {
  let left = amount;
  return STAGE_STEPS.map((s, i) => {
    const last = i === STAGE_STEPS.length - 1;
    const basic = last ? left : applyBasisPoints(amount, BigInt(s.bps));
    left -= basic;
    return { label: prefix + s.label, percentBps: share(basic, price), basic };
  });
}

export const stagePlan = (price: bigint): PlanRow[] => spread(price, price);

/**
 * Bank-loan plan: the customer's own margin first, then the loan released
 * stage by stage. Without a recorded loan amount, 80% of the price is assumed.
 */
export function loanPlan(price: bigint, loanAmount: bigint | null): PlanRow[] {
  const loan = loanAmount && loanAmount > 0n && loanAmount < price
    ? loanAmount
    : applyBasisPoints(price, 8000n);
  const margin = price - loan;
  return [
    { label: "Own contribution (margin)", percentBps: share(margin, price), basic: margin },
    ...spread(loan, price, "Bank disbursement: "),
  ];
}
