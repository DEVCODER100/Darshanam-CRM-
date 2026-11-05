/** Brokerage and reward rules for agents. Pure. */

export interface BrokeragePlan {
  name: string;
  defaultBps: number; // 200 = 2%
  perType: Record<string, number>; // unit type -> bps
}

export interface RewardPlan {
  name: string;
  kind: "per_booking" | "percent_sales";
  value: bigint; // paise per booking, or basis points of sales value
}

/** Commission rate (bps) for one unit type: plan type rate, else plan default, else the agent's own %. */
export const rateFor = (plan: BrokeragePlan | null | undefined, ownBps: number, unitType: string): number =>
  plan ? (plan.perType[unitType] ?? plan.defaultBps) : ownBps;

/** Commission on an amount, rounded to the paisa. */
export const commission = (basic: bigint, bps: number) => (basic * BigInt(bps) + 5000n) / 10000n;

/** Commission on a set of (unit type, basic amount) rows: each type at its own rate. */
export function earnedOn(plan: BrokeragePlan | null | undefined, ownBps: number, rows: { type: string; amount: bigint }[]): bigint {
  const byType = new Map<string, bigint>();
  for (const r of rows) byType.set(r.type, (byType.get(r.type) ?? 0n) + r.amount);
  let total = 0n;
  for (const [type, amount] of byType) total += commission(amount, rateFor(plan, ownBps, type));
  return total;
}

/** Reward on a set of bookings (their sales values): per booking, or a % of the sales. */
export function rewardOn(plan: RewardPlan | null | undefined, sales: bigint[]): bigint {
  if (!plan) return 0n;
  if (plan.kind === "per_booking") return plan.value * BigInt(sales.length);
  return commission(sales.reduce((s, v) => s + v, 0n), Number(plan.value));
}

export const REWARD_KINDS = { per_booking: "Fixed amount per booking", percent_sales: "% of sales value" } as const;
