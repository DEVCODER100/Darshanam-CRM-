import { describe, it, expect } from "vitest";
import { computeOutstanding, ScheduleRow, PaymentRow } from "./outstanding";
import { rupeesToPaise } from "./money";

const L = (lakh: number) => rupeesToPaise(String(lakh * 100000)); // lakhs -> paise
const Cr = (crore: number) => rupeesToPaise(String(crore * 10000000)); // crore -> paise

// A standard plan: June 20L, October 40L, February 60L.
const JUNE: ScheduleRow = { dueDate: "2026-06-20", amount: L(20) };
const OCT: ScheduleRow = { dueDate: "2026-10-15", amount: L(40) };
const FEB: ScheduleRow = { dueDate: "2027-02-10", amount: L(60) };

// total_cost large enough that the §5 examples never trip the overpaid flag.
const TOTAL = Cr(2);

const pay = (lakh: number): PaymentRow => ({ amount: L(lakh) });

describe("PRD §5 — the six verified rows", () => {
  it("Ex1: June due 20L, paid 0 -> 20L", () => {
    const r = computeOutstanding([JUNE], [], "2026-06-30", TOTAL);
    expect(r.outstanding).toBe(L(20));
  });

  it("Ex2: June 20L, paid 10L -> 10L", () => {
    const r = computeOutstanding([JUNE], [pay(10)], "2026-06-30", TOTAL);
    expect(r.outstanding).toBe(L(10));
  });

  it("Ex3: June 20L + Oct 40L due, paid 0 -> 60L", () => {
    const r = computeOutstanding([JUNE, OCT], [], "2026-10-31", TOTAL);
    expect(r.outstanding).toBe(L(60));
  });

  it("Ex4: June 20L + Oct 40L, paid 20L -> 40L", () => {
    const r = computeOutstanding([JUNE, OCT], [pay(20)], "2026-10-31", TOTAL);
    expect(r.outstanding).toBe(L(40));
  });

  it("Ex5: June 20L + Oct 40L, paid 10L -> 50L", () => {
    const r = computeOutstanding([JUNE, OCT], [pay(10)], "2026-10-31", TOTAL);
    expect(r.outstanding).toBe(L(50));
  });

  it("Feb: 20+40+60L due (1.2 Cr), paid 20L -> 1 Cr", () => {
    const r = computeOutstanding(
      [JUNE, OCT, FEB],
      [pay(20)],
      "2027-02-28",
      TOTAL,
    );
    expect(r.dueTillDate).toBe(Cr(1.2));
    expect(r.outstanding).toBe(Cr(1));
  });
});

describe("PRD §5 — the four edge cases", () => {
  it("Edge 1: overpayment shows as Advance, not negative outstanding", () => {
    // June 20L due, paid 30L -> outstanding -10L -> Advance 10L
    const r = computeOutstanding([JUNE], [pay(30)], "2026-06-30", TOTAL);
    expect(r.outstanding).toBe(-L(10));
    expect(r.isAdvance).toBe(true);
    expect(r.advanceAmount).toBe(L(10));
  });

  it("Edge 2: a payment counts the moment it's received, before its instalment is due", () => {
    // As of July, only June (20L) is due. A 40L payment (earmarked for Oct) still
    // counts now -> outstanding = 20L - 40L = -20L (advance of 20L).
    const r = computeOutstanding(
      [JUNE, OCT],
      [pay(40)],
      "2026-07-01",
      TOTAL,
    );
    expect(r.dueTillDate).toBe(L(20));
    expect(r.totalPaid).toBe(L(40));
    expect(r.outstanding).toBe(-L(20));
    expect(r.isAdvance).toBe(true);
  });

  it("Edge 3: total paid exceeds total property cost -> data-entry warning", () => {
    const smallTotal = L(50);
    const r = computeOutstanding(
      [JUNE, OCT, FEB],
      [pay(60)],
      "2027-02-28",
      smallTotal,
    );
    expect(r.overpaidWholePlan).toBe(true);
    expect(r.balancePropertyValue).toBe(L(50) - L(60)); // negative -> overpaid plan
  });

  it("Edge 4: deleting a payment recalculates correctly (recompute on read)", () => {
    const before = computeOutstanding(
      [JUNE, OCT],
      [pay(20), pay(10)],
      "2026-10-31",
      TOTAL,
    );
    expect(before.outstanding).toBe(L(30)); // 60 - 30

    // Simulate deleting the 10L payment -> recompute over remaining rows.
    const after = computeOutstanding(
      [JUNE, OCT],
      [pay(20)],
      "2026-10-31",
      TOTAL,
    );
    expect(after.outstanding).toBe(L(40)); // 60 - 20
  });
});

describe("Outstanding vs Balance Property Value are distinct (PRD §5)", () => {
  it("outstanding = due-till-today − paid; balance = total_cost − paid", () => {
    const total = Cr(1.5);
    const r = computeOutstanding([JUNE, OCT], [pay(20)], "2026-10-31", total);
    expect(r.outstanding).toBe(L(40)); // 60L due − 20L paid
    expect(r.balancePropertyValue).toBe(total - L(20)); // whole plan − paid
    expect(r.outstanding).not.toBe(r.balancePropertyValue);
  });
});
