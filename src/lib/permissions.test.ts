import { describe, it, expect } from "vitest";
import { can } from "./permissions";

describe("RBAC capability matrix — admin-only editing", () => {
  it("admin can do everything", () => {
    expect(can("admin", "user:manage")).toBe(true);
    expect(can("admin", "payment:delete")).toBe(true);
    expect(can("admin", "customer:delete")).toBe(true);
    expect(can("admin", "booking:edit")).toBe(true);
    expect(can("admin", "cost:edit")).toBe(true);
    expect(can("admin", "audit:view")).toBe(true);
  });

  it("accountant: view-only — reports + unmask, but no editing at all", () => {
    expect(can("accountant", "report:view")).toBe(true);
    expect(can("accountant", "sensitive:view")).toBe(true);
    expect(can("accountant", "payment:create")).toBe(false);
    expect(can("accountant", "payment:edit")).toBe(false);
    expect(can("accountant", "payment:delete")).toBe(false);
    expect(can("accountant", "cost:edit")).toBe(false);
    expect(can("accountant", "customer:edit")).toBe(false);
    expect(can("accountant", "booking:edit")).toBe(false);
    expect(can("accountant", "user:manage")).toBe(false);
  });

  it("sales_executive: strictly view-only, no capabilities", () => {
    expect(can("sales_executive", "customer:create")).toBe(false);
    expect(can("sales_executive", "customer:edit")).toBe(false);
    expect(can("sales_executive", "booking:create")).toBe(false);
    expect(can("sales_executive", "booking:edit")).toBe(false);
    expect(can("sales_executive", "payment:create")).toBe(false);
    expect(can("sales_executive", "report:view")).toBe(false);
  });

  it("manager: read-only — reports yes, every mutation no", () => {
    expect(can("manager", "report:view")).toBe(true);
    expect(can("manager", "customer:create")).toBe(false);
    expect(can("manager", "booking:create")).toBe(false);
    expect(can("manager", "payment:create")).toBe(false);
    expect(can("manager", "cost:edit")).toBe(false);
    expect(can("manager", "sensitive:view")).toBe(false);
  });

  it("only admin holds any create/edit/delete capability", () => {
    const mutating = [
      "customer:create",
      "customer:edit",
      "customer:delete",
      "booking:create",
      "booking:edit",
      "booking:delete",
      "cost:edit",
      "schedule:edit",
      "payment:create",
      "payment:edit",
      "payment:delete",
      "loan:edit",
      "user:manage",
    ] as const;
    for (const cap of mutating) {
      expect(can("admin", cap)).toBe(true);
      expect(can("accountant", cap)).toBe(false);
      expect(can("sales_executive", cap)).toBe(false);
      expect(can("manager", cap)).toBe(false);
    }
  });
});
