import { describe, it, expect } from "vitest";
import {
  rupeesToPaise,
  paiseToRupeeString,
  applyBasisPoints,
  percentToBps,
  bpsToPercentString,
  formatINR,
  roundedDiv,
} from "./money";

describe("rupeesToPaise", () => {
  it("parses whole rupees", () => {
    expect(rupeesToPaise("13000000")).toBe(1_300_000_000n);
  });
  it("strips Indian-grouped commas", () => {
    expect(rupeesToPaise("1,30,00,000")).toBe(1_300_000_000n);
  });
  it("parses paise decimals", () => {
    expect(rupeesToPaise("20.50")).toBe(2050n);
    expect(rupeesToPaise("20.5")).toBe(2050n);
    expect(rupeesToPaise(100)).toBe(10_000n);
  });
  it("rejects malformed input", () => {
    expect(() => rupeesToPaise("12.345")).toThrow();
    expect(() => rupeesToPaise("abc")).toThrow();
    expect(() => rupeesToPaise("")).toThrow();
  });
});

describe("paiseToRupeeString", () => {
  it("renders 2dp", () => {
    expect(paiseToRupeeString(2050n)).toBe("20.50");
    expect(paiseToRupeeString(1_300_000_000n)).toBe("13000000.00");
    expect(paiseToRupeeString(-500n)).toBe("-5.00");
  });
});

describe("percent / basis points", () => {
  it("percentToBps", () => {
    expect(percentToBps(5)).toBe(500n);
    expect(percentToBps("5.9")).toBe(590n);
    expect(percentToBps("18")).toBe(1800n);
  });
  it("bpsToPercentString round-trips", () => {
    expect(bpsToPercentString(500n)).toBe("5");
    expect(bpsToPercentString(590n)).toBe("5.9");
    expect(bpsToPercentString(1800n)).toBe("18");
  });
  it("applyBasisPoints computes GST exactly", () => {
    // 5% of 1,30,00,000 rupees = 6,50,000 rupees
    expect(applyBasisPoints(rupeesToPaise("13000000"), 500n)).toBe(
      rupeesToPaise("650000"),
    );
    // 5.9% of 1,30,00,000 = 7,67,000
    expect(applyBasisPoints(rupeesToPaise("13000000"), 590n)).toBe(
      rupeesToPaise("767000"),
    );
  });
});

describe("roundedDiv", () => {
  it("rounds half up", () => {
    expect(roundedDiv(5n, 2n)).toBe(3n);
    expect(roundedDiv(4n, 2n)).toBe(2n);
    expect(roundedDiv(-5n, 2n)).toBe(-3n);
  });
});

describe("formatINR", () => {
  it("groups in lakh/crore", () => {
    expect(formatINR(rupeesToPaise("14917000"))).toBe("₹1,49,17,000.00");
    expect(formatINR(rupeesToPaise("2000000"))).toBe("₹20,00,000.00");
    expect(formatINR(rupeesToPaise("100"))).toBe("₹100.00");
    expect(formatINR(rupeesToPaise("1000"))).toBe("₹1,000.00");
  });
  it("handles negatives and no-paise option", () => {
    expect(formatINR(rupeesToPaise("-1000000"))).toBe("-₹10,00,000.00");
    expect(formatINR(rupeesToPaise("14917000"), { paise2dp: false })).toBe(
      "₹1,49,17,000",
    );
  });
});
