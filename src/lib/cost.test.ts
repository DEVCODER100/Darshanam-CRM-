import { describe, it, expect } from "vitest";
import { computeCost } from "./cost";
import { rupeesToPaise, formatINR } from "./money";

describe("computeCost — Villa worked example (PRD §6)", () => {
  // base 1,30,00,000 + GST 5% (6,50,000) + maintenance 5,00,000
  //   + documentation 5.9% (7,67,000) = Total 1,49,17,000
  const result = computeCost({
    baseCost: rupeesToPaise("13000000"),
    gstPercentBps: 500,
    maintenanceCharge: rupeesToPaise("500000"),
    documentationPercentBps: 590,
  });

  it("GST amount = 6,50,000", () => {
    expect(result.gstAmount).toBe(rupeesToPaise("650000"));
  });
  it("documentation amount = 7,67,000", () => {
    expect(result.documentationAmount).toBe(rupeesToPaise("767000"));
  });
  it("total cost = 1,49,17,000", () => {
    expect(result.totalCost).toBe(rupeesToPaise("14917000"));
    expect(formatINR(result.totalCost, { paise2dp: false })).toBe(
      "₹1,49,17,000",
    );
  });
});

describe("computeCost — edge behaviour", () => {
  it("zero percentages and maintenance", () => {
    const r = computeCost({
      baseCost: rupeesToPaise("1000000"),
      gstPercentBps: 0,
      maintenanceCharge: 0n,
      documentationPercentBps: 0,
    });
    expect(r.totalCost).toBe(rupeesToPaise("1000000"));
  });
  it("rejects negative base cost", () => {
    expect(() =>
      computeCost({
        baseCost: -1n,
        gstPercentBps: 0,
        maintenanceCharge: 0n,
        documentationPercentBps: 0,
      }),
    ).toThrow();
  });

  it("applies extra charges and discount to agreement value", () => {
    const r = computeCost({
      baseCost: rupeesToPaise("15000000"),
      extraCharges: rupeesToPaise("1000000"),
      discount: rupeesToPaise("500000"),
      gstPercentBps: 0,
      maintenanceCharge: 0n,
      documentationPercentBps: 0,
    });
    expect(r.agreementValue).toBe(rupeesToPaise("15500000"));
    expect(r.totalCost).toBe(rupeesToPaise("15500000"));
  });
});
