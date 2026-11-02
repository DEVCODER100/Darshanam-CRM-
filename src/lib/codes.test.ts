import { describe, it, expect } from "vitest";
import { nextCode, newPaymentNumber } from "./codes";

describe("nextCode", () => {
  it("starts at 001 when nothing exists", () => {
    expect(nextCode("CL", [])).toBe("CL001");
    expect(nextCode("CL", [null, undefined])).toBe("CL001");
  });
  it("continues after the highest existing code, ignoring gaps and other prefixes", () => {
    expect(nextCode("CL", ["CL001", "CL007", "CL003", "BI099"])).toBe("CL008");
  });
  it("grows past three digits", () => {
    expect(nextCode("BI", ["BI999"])).toBe("BI1000");
  });
});

describe("newPaymentNumber", () => {
  it("uses the payment month and 6 characters", () => {
    const n = newPaymentNumber("2026-09-27");
    expect(n).toMatch(/^PAY2609-[0-9A-Z]{6}$/);
    expect(n).not.toMatch(/[IO]/);
  });
  it("is deterministic with an injected random source", () => {
    expect(newPaymentNumber("2026-09-27", () => 0)).toBe("PAY2609-000000");
  });
  it("differs between calls", () => {
    expect(newPaymentNumber("2026-09-27")).not.toBe(newPaymentNumber("2026-09-27"));
  });
});
