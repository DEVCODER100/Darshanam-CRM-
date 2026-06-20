import { describe, it, expect } from "vitest";
import { maskSensitive, lastFour, classifyId } from "./masking";

describe("masking", () => {
  it("masks Aadhaar to last 4", () => {
    expect(maskSensitive("1234 5678 9012")).toBe("XXXXXXXX9012");
    expect(lastFour("1234 5678 9012")).toBe("9012");
  });
  it("masks PAN to last 4", () => {
    expect(maskSensitive("ABCDE1234F")).toBe("XXXXXX234F");
  });
  it("classifies ids", () => {
    expect(classifyId("123456789012")).toBe("aadhaar");
    expect(classifyId("ABCDE1234F")).toBe("pan");
    expect(classifyId("hello")).toBe("unknown");
  });
});
