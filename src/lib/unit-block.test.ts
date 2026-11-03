import { describe, it, expect } from "vitest";
import { blockActive } from "./unit-block";

describe("blockActive", () => {
  const today = "2026-11-03";
  it("never-expiring block stays active", () => {
    expect(blockActive({ blocked: true, unblockOn: null }, today)).toBe(true);
  });
  it("is active until the unblock date, free on it", () => {
    expect(blockActive({ blocked: true, unblockOn: "2026-11-04" }, today)).toBe(true);
    expect(blockActive({ blocked: true, unblockOn: "2026-11-03" }, today)).toBe(false);
    expect(blockActive({ blocked: true, unblockOn: "2026-10-01" }, today)).toBe(false);
  });
  it("an unblocked unit is never active", () => {
    expect(blockActive({ blocked: false, unblockOn: "2027-01-01" }, today)).toBe(false);
  });
});
