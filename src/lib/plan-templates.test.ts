import { describe, it, expect } from "vitest";
import { loanPlan, stagePlan, STAGE_STEPS } from "./plan-templates";
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
