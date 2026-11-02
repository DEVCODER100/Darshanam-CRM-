import { describe, it, expect } from "vitest";
import {
  splitGst,
  scheduleComponents,
  paymentComponents,
  bookingStatement,
  rowDues,
  monthRange,
  formatReportDate,
  daysBetween,
  shiftMonth,
  isMonth,
  sumComponents,
  type ScheduleItem,
  type Components,
} from "./statement";
import { rupeesToPaise } from "./money";

const R = (rupees: string) => rupeesToPaise(rupees);
const L = (lakh: number) => rupeesToPaise(String(lakh * 100000));

const row = (id: string, dueDate: string, basic: bigint, gst = 0n, other = 0n): ScheduleItem => ({
  id,
  dueDate,
  label: id,
  percentageBps: null,
  comps: { basic, gst, other },
});
const pay = (basic: bigint, gst = 0n, other = 0n): Components => ({ basic, gst, other });

describe("GST split and totals (numbers from the Payment Due report)", () => {
  it("₹18,75,000 + 5% GST -> CGST ₹46,875 + SGST ₹46,875 = ₹19,68,750", () => {
    const gst = R("93750");
    const { cgst, sgst } = splitGst(gst);
    expect(cgst).toBe(R("46875"));
    expect(sgst).toBe(R("46875"));
    expect(sumComponents({ basic: R("1875000"), gst, other: 0n })).toBe(R("1968750"));
  });
  it("an odd paisa goes to SGST", () => {
    expect(splitGst(5n)).toEqual({ cgst: 2n, sgst: 3n });
  });
});

describe("component helpers", () => {
  it("legacy schedule row with no split counts as all basic", () => {
    const c = scheduleComponents({
      amount: L(60), basicAmount: 0n, gstAmount: 0n, otherChargeAmount: 0n,
    });
    expect(c).toEqual({ basic: L(60), gst: 0n, other: 0n });
  });
  it("explicit split is used as given", () => {
    const c = scheduleComponents({
      amount: R("1968750"), basicAmount: R("1875000"), gstAmount: R("93750"), otherChargeAmount: 0n,
    });
    expect(c.basic).toBe(R("1875000"));
    expect(c.gst).toBe(R("93750"));
  });
  it("payment basic = total − gst − maintenance", () => {
    const c = paymentComponents({
      amount: R("1050000"), gstAmount: R("50000"), maintenanceAmount: R("100000"),
    });
    expect(c).toEqual({ basic: R("900000"), gst: R("50000"), other: R("100000") });
  });
});

describe("monthly plan (₹10L a month for 10 months) — the user's carry-forward example", () => {
  const schedule = Array.from({ length: 10 }, (_, i) =>
    row(`m${i + 1}`, `2026-${String(i + 1).padStart(2, "0")}-05`, L(10)),
  );
  // Month 1 pays 10L, month 2 pays 5L, month 3 pays 15L, month 4 nothing, month 5 pays 20L.
  const paidByMonth = [L(10), L(5), L(15), 0n, L(20)];
  const outstandingAfter = (month: number) => {
    const payments = paidByMonth.slice(0, month).map((p) => pay(p));
    const asOf = `2026-${String(month).padStart(2, "0")}-28`;
    return bookingStatement(schedule, payments, asOf).due.basic;
  };

  it("month 1: paid 10L -> nothing outstanding", () => expect(outstandingAfter(1)).toBe(0n));
  it("month 2: paid only 5L -> 5L outstanding", () => expect(outstandingAfter(2)).toBe(L(5)));
  it("month 3: 10L due + 5L carried = 15L, paid 15L -> 0", () => expect(outstandingAfter(3)).toBe(0n));
  it("month 4: nothing paid -> 10L outstanding", () => expect(outstandingAfter(4)).toBe(L(10)));
  it("month 5: 10L carried + 10L due = 20L, paid 20L -> 0", () => expect(outstandingAfter(5)).toBe(0n));
});

describe("bookingStatement — categories", () => {
  const schedule = [
    row("i1", "2026-09-01", R("1875000"), R("93750"), 0n),
    row("mnt", "2026-09-01", 0n, 0n, R("100000")),
  ];
  it("GST short-paid shows as GST due while basic is clear", () => {
    const s = bookingStatement(schedule, [pay(R("1875000"), R("50000"), R("100000"))], "2026-09-30");
    expect(s.due.basic).toBe(0n);
    expect(s.due.gst).toBe(R("43750"));
    expect(s.due.other).toBe(0n);
    expect(s.receivable.gst).toBe(R("93750"));
  });
  it("future instalments count as receivable but not due", () => {
    const s = bookingStatement([row("f", "2027-01-01", L(10))], [], "2026-09-30");
    expect(s.receivable.basic).toBe(L(10));
    expect(s.due.basic).toBe(0n);
  });
});

describe("rowDues — FIFO allocation and days overdue", () => {
  const schedule = [
    row("b", "2026-09-04", L(10)),
    row("a", "2026-09-01", L(10)),
    row("c", "2026-12-01", L(10)),
  ];
  const result = rowDues(schedule, [pay(L(15))], "2026-11-02");

  it("allocates oldest first regardless of input order", () => {
    expect(result.map((r) => r.item.id)).toEqual(["a", "b", "c"]);
    expect(result[0].due.basic).toBe(0n);
    expect(result[1].due.basic).toBe(L(5));
    expect(result[2].due.basic).toBe(L(10));
  });
  it("computes days overdue (01 Sep -> 02 Nov = 62 days) and flags projected", () => {
    expect(result[0].daysOverdue).toBe(62);
    expect(result[2].daysOverdue).toBe(0);
    expect(result[2].projected).toBe(true);
    expect(result[1].projected).toBe(false);
  });
});

describe("report period helpers", () => {
  it("monthRange covers the whole month, including leap Feb", () => {
    expect(monthRange("2026-09")).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(monthRange("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });
  it("rejects bad months", () => {
    expect(() => monthRange("2026-13")).toThrow();
    expect(() => monthRange("nope")).toThrow();
  });
  it("formats dates like the report titles", () => {
    expect(formatReportDate("2026-09-01")).toBe("01 Sep, 2026");
    expect(formatReportDate("2026-09-30")).toBe("30 Sep, 2026");
  });
  it("daysBetween", () => {
    expect(daysBetween("2026-09-01", "2026-11-02")).toBe(62);
    expect(daysBetween("2026-11-02", "2026-09-01")).toBe(-62);
  });
});

describe("month navigation", () => {
  it("shifts across year boundaries", () => {
    expect(shiftMonth("2026-09", -1)).toBe("2026-08");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
  it("validates month strings", () => {
    expect(isMonth("2026-09")).toBe(true);
    expect(isMonth("2026-13")).toBe(false);
    expect(isMonth("sep")).toBe(false);
    expect(isMonth(undefined)).toBe(false);
  });
});
