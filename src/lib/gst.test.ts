import { describe, it, expect } from "vitest";
import { computeGstStatus } from "./gst-calc";
import { rupeesToPaise } from "./money";

const L = (lakh: number) => rupeesToPaise(String(lakh * 100000));

describe("computeGstStatus — proportional GST on collection (user's example)", () => {
  it("basic ₹60L collected, ₹2L GST paid, 5% -> due ₹3L, shortfall ₹1L", () => {
    const r = computeGstStatus({
      gstRateBps: 500,
      basicCollected: L(60),
      gstCollected: L(2),
    });
    expect(r.gstDueOnCollection).toBe(L(3));
    expect(r.gstShortfall).toBe(L(1));
    expect(r.gstExcess).toBe(0n);
  });

  it("GST exactly matches what is due -> no shortfall", () => {
    const r = computeGstStatus({
      gstRateBps: 500,
      basicCollected: L(60),
      gstCollected: L(3),
    });
    expect(r.gstShortfall).toBe(0n);
    expect(r.gstExcess).toBe(0n);
  });

  it("GST overpaid -> excess, no shortfall", () => {
    const r = computeGstStatus({
      gstRateBps: 500,
      basicCollected: L(60),
      gstCollected: L(4),
    });
    expect(r.gstShortfall).toBe(0n);
    expect(r.gstExcess).toBe(L(1));
  });

  it("nothing collected -> all zero", () => {
    const r = computeGstStatus({ gstRateBps: 500, basicCollected: 0n, gstCollected: 0n });
    expect(r.gstDueOnCollection).toBe(0n);
    expect(r.gstShortfall).toBe(0n);
  });
});
