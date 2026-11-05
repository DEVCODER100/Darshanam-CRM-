import { describe, it, expect } from "vitest";
import { loanPlan, rebalance, stagePlan, STAGE_STEPS } from "./plan-templates";
import { rupeesToPaise } from "./money";

const sum = (rows: { basic: bigint }[]) => rows.reduce((s, r) => s + r.basic, 0n);
const price = rupeesToPaise("18750000");

describe("plan templates", () => {
  it("stage steps are the increments and add up to 100%", () => {
    expect(STAGE_STEPS.map((s) => s.bps)).toEqual([4500, 1000, 1500, 1000, 1000, 500, 500]);
  });
  it("stage-wise plan totals the price exactly, first stage 45%", () => {
    const rows = stagePlan(price);
    expect(sum(rows)).toBe(price);
    expect(rows[0]).toMatchObject({ percentBps: 4500, basic: rupeesToPaise("8437500") });
  });
  it("rounding never leaks: odd prices still total exactly", () => {
    const odd = rupeesToPaise("12345679");
    expect(sum(stagePlan(odd))).toBe(odd);
    expect(sum(loanPlan(odd, rupeesToPaise("9999999")))).toBe(odd);
  });
  it("bank-loan plan: margin first, then the loan by stage", () => {
    const rows = loanPlan(price, rupeesToPaise("15000000"));
    expect(rows[0].basic).toBe(rupeesToPaise("3750000"));
    expect(rows).toHaveLength(8);
    expect(sum(rows.slice(1))).toBe(rupeesToPaise("15000000"));
  });
  it("assumes an 80% loan when none is recorded", () => {
    expect(loanPlan(price, null)[0].basic).toBe(rupeesToPaise("3750000"));
  });
});

describe("rebalance", () => {
  const sum = (xs: (number | null)[]) => xs.reduce<number>((s, v) => s + (v ?? 0), 0);
  it("spreads the rest over the other rows in proportion, always totalling 100%", () => {
    const out = rebalance([1000, 3000, 3000, 3000], 0, 4000); // first row 10% -> 40%
    expect(out[0]).toBe(4000);
    expect(sum(out)).toBe(10000);
    expect(out.slice(1)).toEqual([2000, 2000, 2000]);
  });
  it("keeps the proportions between the other rows", () => {
    const out = rebalance([2000, 2000, 6000], 0, 5000);
    expect(out).toEqual([5000, 1250, 3750]);
  });
  it("shares equally when the others were all zero, and absorbs rounding in the last row", () => {
    expect(rebalance([0, 0, 0], 0, 1000)).toEqual([1000, 4500, 4500]);
    expect(sum(rebalance([3333, 3333, 3334], 1, 3333))).toBe(10000);
  });
  it("leaves rows without a percentage alone and clamps to 0-100%", () => {
    expect(rebalance([5000, null, 5000], 0, 2500)).toEqual([2500, null, 7500]);
    expect(rebalance([5000, 5000], 0, 15000)).toEqual([10000, 0]);
    expect(rebalance([10000], 0, 3000)).toEqual([3000]);
  });
});
