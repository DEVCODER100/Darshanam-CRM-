import { describe, expect, it } from "vitest";
import {
  amountAtPercent,
  calculateReceivable,
  checkCollectionLimit,
  stagePercentBps,
} from "./stage";

describe("stage receivable", () => {
  it("uses the fixed construction percentages", () => {
    expect(stagePercentBps("plinth")).toBe(4500);
    expect(stagePercentBps("ground_floor")).toBe(5500);
    expect(stagePercentBps("finishing")).toBe(10000);
  });

  it("calculates 55% of ₹1.5 Cr as ₹82.5 L", () => {
    expect(amountAtPercent(15_000_000_00n, 5500)).toBe(8_250_000_00n);
  });

  it("returns the full cost for self finance without stage", () => {
    expect(
      calculateReceivable({
        totalCost: 15_000_000_00n,
        paymentType: "self_finance",
        stageBased: false,
        currentStage: null,
      }),
    ).toBe(15_000_000_00n);
  });

  it("caps stage-based installments at the lower of schedule and stage eligibility", () => {
    expect(
      calculateReceivable({
        totalCost: 15_000_000_00n,
        paymentType: "installment",
        stageBased: true,
        currentStage: "ground_floor",
        scheduleDueTillDate: 10_000_000_00n,
      }),
    ).toBe(8_250_000_00n);
  });

  it("detects collection beyond the eligible amount", () => {
    const result = checkCollectionLimit(
      8_250_000_00n,
      7_000_000_00n,
      2_000_000_00n,
    );
    expect(result.exceedsEligible).toBe(true);
    expect(result.remainingBefore).toBe(1_250_000_00n);
  });
});
