import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import {
  isValidPan,
  normalizePan,
  maskPan,
  encryptPan,
  decryptPan,
  hashPan,
  keyFromBase64,
} from "./pan";

const key = randomBytes(32);
const otherKey = randomBytes(32);

describe("PAN validation", () => {
  it("accepts the AAAAA9999A shape, case and spaces ignored", () => {
    expect(isValidPan("ABCDE1234F")).toBe(true);
    expect(isValidPan(" abcde1234f ")).toBe(true);
  });
  it("rejects wrong shapes", () => {
    for (const bad of ["ABCDE12345", "ABCD1234FG", "1234567890", "", "ABCDE1234", "ABCDE1234FF"])
      expect(isValidPan(bad)).toBe(false);
  });
  it("normalises and masks to the last 4", () => {
    expect(normalizePan(" abcde 1234f")).toBe("ABCDE1234F");
    expect(maskPan("ABCDE1234F")).toBe("XXXXXX234F");
  });
});

describe("PAN encryption", () => {
  it("round-trips", () => {
    const blob = encryptPan("abcde1234f", key);
    expect(blob.startsWith("v1.")).toBe(true);
    expect(blob).not.toContain("ABCDE1234F");
    expect(decryptPan(blob, key)).toBe("ABCDE1234F");
  });
  it("uses a fresh IV each time, so the same PAN encrypts differently", () => {
    expect(encryptPan("ABCDE1234F", key)).not.toBe(encryptPan("ABCDE1234F", key));
  });
  it("fails with the wrong key or a tampered value", () => {
    const blob = encryptPan("ABCDE1234F", key);
    expect(() => decryptPan(blob, otherKey)).toThrow();
    const parts = blob.split(".");
    parts[3] = Buffer.from("tampered!!!").toString("base64");
    expect(() => decryptPan(parts.join("."), key)).toThrow();
  });
});

describe("PAN search hash", () => {
  it("is stable for the same PAN, whatever the case", () => {
    expect(hashPan("ABCDE1234F", key)).toBe(hashPan(" abcde1234f", key));
  });
  it("differs per PAN and per key", () => {
    expect(hashPan("ABCDE1234F", key)).not.toBe(hashPan("ABCDE1234G", key));
    expect(hashPan("ABCDE1234F", key)).not.toBe(hashPan("ABCDE1234F", otherKey));
  });
});

describe("key parsing", () => {
  it("demands a 32-byte base64 key", () => {
    expect(() => keyFromBase64(undefined)).toThrow(/PAN_ENCRYPTION_KEY/);
    expect(() => keyFromBase64(Buffer.from("short").toString("base64"))).toThrow(/32 bytes/);
    expect(keyFromBase64(randomBytes(32).toString("base64")).length).toBe(32);
  });
});
