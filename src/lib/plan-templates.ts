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

/**
 * Keep a plan's shares adding up to 100% when one is edited: the other rows share
 * what is left in proportion to what they had (equally if they were all 0). Works in
 * basis points; `null` rows (no percentage) are left alone. The last other row takes
 * any rounding, so the total is exact.
 */
export function rebalance(bps: (number | null)[], index: number, value: number): (number | null)[] {
  const edited = Math.min(Math.max(value, 0), 10000);
  const others = bps.map((v, i) => (i !== index && v !== null ? i : -1)).filter((i) => i >= 0);
  if (!others.length) return bps.map((v, i) => (i === index ? edited : v));
  const left = 10000 - edited;
  const total = others.reduce((s, i) => s + (bps[i] as number), 0);
  const out = [...bps];
  out[index] = edited;
  let given = 0;
  others.forEach((i, n) => {
    const share = n === others.length - 1 ? left - given : Math.round(total > 0 ? (left * (bps[i] as number)) / total : left / others.length);
    out[i] = share;
    given += share;
  });
  return out;
}
