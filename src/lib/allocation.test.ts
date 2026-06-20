import { describe, it, expect } from "vitest";
import { allocatePayments } from "./allocation";
import { rupeesToPaise } from "./money";

// Villa V-204 cost parts (PRD §6): base 1.3Cr, GST 6.5L, maint 5L, doc 7.67L.
const cost = {
  baseCost: rupeesToPaise("13000000"),
  gstAmount: rupeesToPaise("650000"),
  maintenanceCharge: rupeesToPaise("500000"),
  documentationAmount: rupeesToPaise("767000"),
};
const byKey = (rows: ReturnType<typeof allocatePayments>) =>
  Object.fromEntries(rows.map((r) => [r.key, r]));

describe("allocatePayments — waterfall coverage", () => {
  it("paid 20L against base -> GST and the rest pending (the user's example)", () => {
    const r = byKey(allocatePayments(cost, rupeesToPaise("2000000")));
    expect(r.base.status).toBe("partial");
    expect(r.base.covered).toBe(rupeesToPaise("2000000"));
    expect(r.gst.status).toBe("pending");
    expect(r.maintenance.status).toBe("pending");
    expect(r.documentation.status).toBe("pending");
  });

  it("nothing paid -> everything pending", () => {
    const r = byKey(allocatePayments(cost, 0n));
    expect(r.base.status).toBe("pending");
    expect(r.gst.status).toBe("pending");
  });

  it("base fully paid -> GST becomes partial then paid", () => {
    const r = byKey(allocatePayments(cost, rupeesToPaise("13300000"))); // base + 3L
    expect(r.base.status).toBe("paid");
    expect(r.gst.status).toBe("partial");
    expect(r.gst.covered).toBe(rupeesToPaise("300000"));
  });

  it("everything paid -> all paid", () => {
    const r = byKey(allocatePayments(cost, rupeesToPaise("14917000")));
    expect(r.base.status).toBe("paid");
    expect(r.gst.status).toBe("paid");
    expect(r.maintenance.status).toBe("paid");
    expect(r.documentation.status).toBe("paid");
  });

  it("zero-amount component is marked n/a, not pending", () => {
    const r = byKey(
      allocatePayments({ ...cost, maintenanceCharge: 0n }, rupeesToPaise("13000000")),
    );
    expect(r.maintenance.status).toBe("na");
  });
});
