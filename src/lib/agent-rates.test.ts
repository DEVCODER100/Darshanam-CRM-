import { describe, it, expect } from "vitest";
import { commission, earnedOn, rateFor, rewardOn, type BrokeragePlan, type RewardPlan } from "./agent-rates";

const plan: BrokeragePlan = { name: "Plan 1", defaultBps: 200, perType: { Villa: 250, Shop: 150 } };

describe("brokerage rates", () => {
  it("uses the plan's rate for the unit type, else the plan default, else the agent's own %", () => {
    expect(rateFor(plan, 100, "Villa")).toBe(250);
    expect(rateFor(plan, 100, "Flat")).toBe(200);
    expect(rateFor(null, 100, "Villa")).toBe(100);
    expect(rateFor({ name: "Zero", defaultBps: 0, perType: {} }, 100, "Villa")).toBe(0); // a plan wins, even at 0%
  });
  it("earns each unit type at its own rate", () => {
    const rows = [{ type: "Villa", amount: 1_000_000n }, { type: "Shop", amount: 1_000_000n }, { type: "Flat", amount: 500_000n }, { type: "Villa", amount: 1_000_000n }];
    // Villa 2,000,000 x 2.5% = 50,000; Shop 1,000,000 x 1.5% = 15,000; Flat 500,000 x 2% = 10,000
    expect(earnedOn(plan, 0, rows)).toBe(75_000n);
    expect(earnedOn(null, 100, rows)).toBe(35_000n);
    expect(earnedOn(plan, 0, [])).toBe(0n);
  });
  it("rounds commission to the paisa", () => {
    expect(commission(333n, 150)).toBe(5n);
  });
});

describe("rewards", () => {
  it("fixed amount per booking", () => {
    const r: RewardPlan = { name: "R", kind: "per_booking", value: 500_000n };
    expect(rewardOn(r, [1n, 2n, 3n])).toBe(1_500_000n);
    expect(rewardOn(r, [])).toBe(0n);
  });
  it("percent of sales value", () => {
    const r: RewardPlan = { name: "R", kind: "percent_sales", value: 50n }; // 0.5%
    expect(rewardOn(r, [10_000_000n, 30_000_000n])).toBe(200_000n);
  });
  it("no plan, no reward", () => expect(rewardOn(null, [100n])).toBe(0n));
});
