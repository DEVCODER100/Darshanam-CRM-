import { describe, it, expect } from "vitest";
import {
  accountStatus,
  ageBand,
  bankKey,
  matchesDue,
  matchesReceived,
  panQueryHash,
  parseDueFilters,
  parseReceivedFilters,
  resolvePeriod,
  activeCount,
  type DueRowFields,
  type ReceivedRowFields,
} from "./report-filters";
import { rupeesToPaise } from "./money";

const R = (r: string) => rupeesToPaise(r);

const base = {
  customer: "Mr. Maulik patel",
  mobile: "9824000001",
  unit: "A 803",
  clientCode: "CL026",
  bookingCode: "BI026",
  project: "Tower A",
  unitType: "Apartment",
  paymentTypeKey: "bank_loan" as const,
  stageBased: false,
  panHash: "hash-maulik",
  hasPan: true,
  accountStatus: "dues_pending" as const,
  amount: R("500000"),
};

const received = (over: Partial<ReceivedRowFields> = {}): ReceivedRowFields => ({
  ...base,
  mode: "rtgs",
  paidBy: "client",
  instrumentBank: "icici bank",
  paymentFor: "Installment [At the Time of Booking], Installment [On Completion of Plinth Level]",
  basic: R("500000"),
  gst: 0n,
  ...over,
});

const due = (over: Partial<DueRowFields> = {}): DueRowFields => ({
  ...base,
  amount: R("1968750"),
  instalment: "On Completion of Outside Plaster Level",
  projected: false,
  daysOverdue: 62,
  loanBank: "SBI",
  ...over,
});

describe("bank name matching (spellings seen in the real files)", () => {
  it("treats HDFC spellings as one bank", () => {
    const keys = ["hdfc", "HDFC", "HDFC BANK", "hdfc bank"].map(bankKey);
    expect(new Set(keys).size).toBe(1);
  });
  it("treats Bank of Baroda spellings as one bank", () => {
    const keys = ["bank of baroda", "Bank of baroda", "BOB"].map(bankKey);
    expect(new Set(keys).size).toBe(1);
  });
  it("treats ICICI and IDFC variants consistently, and keeps different banks apart", () => {
    expect(bankKey("icici bank")).toBe(bankKey("ICICI BANK"));
    expect(bankKey("IDFC FIRST BANK")).toBe(bankKey("idfc bank"));
    expect(bankKey("hdfc")).not.toBe(bankKey("icici"));
    expect(bankKey(null)).toBe("");
  });
});

describe("overdue age bands (the due file runs from 33 to 62 days)", () => {
  it("bands correctly at the edges", () => {
    expect(ageBand(30)).toBe("0-30");
    expect(ageBand(33)).toBe("31-60");
    expect(ageBand(60)).toBe("31-60");
    expect(ageBand(62)).toBe("61-90");
    expect(ageBand(91)).toBe("90+");
  });
});

describe("account status", () => {
  const total = R("10000000");
  it("paid in full when everything is received", () => {
    expect(accountStatus({ totalCost: total, received: total, dueNow: 0n })).toBe("paid_in_full");
  });
  it("dues pending when partly paid and something is overdue", () => {
    expect(accountStatus({ totalCost: total, received: R("4000000"), dueNow: R("1000000") })).toBe("dues_pending");
  });
  it("up to date when partly paid with nothing overdue", () => {
    expect(accountStatus({ totalCost: total, received: R("4000000"), dueNow: 0n })).toBe("up_to_date");
  });
  it("nothing paid when nothing is received", () => {
    expect(accountStatus({ totalCost: total, received: 0n, dueNow: R("500000") })).toBe("nothing_paid");
  });
});

describe("period", () => {
  it("uses a whole month, or from/to when both are valid", () => {
    expect(resolvePeriod({ month: "2026-09" })).toEqual({ from: "2026-09-01", to: "2026-09-30", month: "2026-09" });
    expect(resolvePeriod({ from: "2026-09-10", to: "2026-10-05" })).toEqual({ from: "2026-09-10", to: "2026-10-05", month: null });
  });
  it("falls back to the current month for bad input", () => {
    expect(resolvePeriod({ month: "nope" }, "2026-11-02").month).toBe("2026-11");
    expect(resolvePeriod({ from: "2026-10-05", to: "2026-09-10" }, "2026-11-02").month).toBe("2026-11");
  });
});

describe("parsing URL params", () => {
  it("reads received filters and ignores junk values", () => {
    const f = parseReceivedFilters({ q: " maulik ", mode: "rtgs", by: "bank", status: "paid_in_full", ptype: "stage", pan: "missing", min: "100000", gst: "only", by2: "x" });
    expect(f).toMatchObject({ q: "maulik", mode: "rtgs", paidBy: "bank", status: "paid_in_full", paymentType: "stage", panMissing: true, gstOnly: true });
    expect(f.min).toBe(R("100000"));
    expect(parseReceivedFilters({ status: "nonsense", by: "robot", min: "abc" })).toMatchObject({ status: undefined, paidBy: undefined, min: undefined });
  });
  it("reads due filters", () => {
    expect(parseDueFilters({ ms: "plinth", when: "overdue", age: "31-60", lbank: "hdfc" })).toMatchObject({ milestone: "plinth", when: "overdue", age: "31-60", loanBank: "hdfc" });
  });
  it("counts only switched-on filters", () => {
    expect(activeCount(parseReceivedFilters({}))).toBe(0);
    expect(activeCount(parseReceivedFilters({ mode: "rtgs", pan: "missing" }))).toBe(2);
  });
});

describe("received filters", () => {
  it("search matches client, mobile, unit and codes, case-insensitively", () => {
    for (const q of ["MAULIK", "98240", "a 803", "cl026", "bi026"])
      expect(matchesReceived(received(), { q })).toBe(true);
    expect(matchesReceived(received(), { q: "nobody" })).toBe(false);
  });
  it("search finds a customer by exact PAN through the hash", () => {
    const ctx = { qPanHash: "hash-maulik" };
    expect(matchesReceived(received(), { q: "ABCDE1234F" })).toBe(false); // no hash given: text alone does not match
    expect(matchesReceived(received(), { q: "ABCDE1234F" }, ctx)).toBe(true); // hash matches the row's PAN
    expect(matchesReceived(received({ customer: "x", mobile: "", unit: "", clientCode: null, bookingCode: null }), { q: "ABCDE1234F" }, ctx)).toBe(true);
    expect(panQueryHash("ABCDE1234F", (p) => `h:${p}`)).toBe("h:ABCDE1234F");
    expect(panQueryHash("maulik", (p) => p)).toBeNull();
  });
  it("mode, paid-by and bank filters (bank spelling-insensitive)", () => {
    expect(matchesReceived(received(), { mode: "rtgs" })).toBe(true);
    expect(matchesReceived(received(), { mode: "cheque" })).toBe(false);
    expect(matchesReceived(received(), { paidBy: "bank" })).toBe(false);
    expect(matchesReceived(received(), { bank: "ICICI" })).toBe(true);
    expect(matchesReceived(received(), { bank: "hdfc" })).toBe(false);
  });
  it("payment-for text and GST-only", () => {
    expect(matchesReceived(received(), { payFor: "plinth" })).toBe(true);
    expect(matchesReceived(received(), { payFor: "slab" })).toBe(false);
    expect(matchesReceived(received({ basic: 0n, gst: R("225000") }), { gstOnly: true })).toBe(true);
    expect(matchesReceived(received(), { gstOnly: true })).toBe(false);
  });
  it("PAN missing, payment type, status and amount range", () => {
    expect(matchesReceived(received({ hasPan: false, panHash: null }), { panMissing: true })).toBe(true);
    expect(matchesReceived(received(), { panMissing: true })).toBe(false);
    expect(matchesReceived(received(), { paymentType: "bank_loan" })).toBe(true);
    expect(matchesReceived(received(), { paymentType: "self_finance" })).toBe(false);
    expect(matchesReceived(received({ stageBased: true }), { paymentType: "stage" })).toBe(true);
    expect(matchesReceived(received(), { paymentType: "stage" })).toBe(false);
    expect(matchesReceived(received(), { status: "paid_in_full" })).toBe(false);
    expect(matchesReceived(received(), { min: R("400000"), max: R("600000") })).toBe(true);
    expect(matchesReceived(received(), { min: R("600000") })).toBe(false);
  });
  it("combines filters with AND", () => {
    expect(matchesReceived(received(), { mode: "rtgs", bank: "icici", status: "dues_pending" })).toBe(true);
    expect(matchesReceived(received(), { mode: "rtgs", bank: "hdfc" })).toBe(false);
  });
});

describe("due filters", () => {
  it("milestone text (Plaster matches both plaster milestones)", () => {
    expect(matchesDue(due(), { milestone: "plaster" })).toBe(true);
    expect(matchesDue(due(), { milestone: "plinth" })).toBe(false);
  });
  it("overdue vs projected", () => {
    expect(matchesDue(due(), { when: "overdue" })).toBe(true);
    expect(matchesDue(due(), { when: "projected" })).toBe(false);
    expect(matchesDue(due({ projected: true, daysOverdue: 0 }), { when: "projected" })).toBe(true);
  });
  it("age band applies to overdue rows only", () => {
    expect(matchesDue(due({ daysOverdue: 62 }), { age: "61-90" })).toBe(true);
    expect(matchesDue(due({ daysOverdue: 62 }), { age: "31-60" })).toBe(false);
    expect(matchesDue(due({ projected: true, daysOverdue: 0 }), { age: "0-30" })).toBe(false);
  });
  it("loan bank, spelling-insensitive", () => {
    expect(matchesDue(due({ loanBank: "HDFC" }), { loanBank: "hdfc bank" })).toBe(true);
    expect(matchesDue(due({ loanBank: "SBI" }), { loanBank: "hdfc" })).toBe(false);
  });
  it("unit type and minimum overdue days", () => {
    expect(matchesDue(due(), { unitType: "apartment" })).toBe(true);
    expect(matchesDue(due(), { unitType: "Villa" })).toBe(false);
    expect(matchesDue(due({ daysOverdue: 62 }), { minDays: 60 })).toBe(true);
    expect(matchesDue(due({ daysOverdue: 62 }), { minDays: 90 })).toBe(false);
    expect(matchesDue(due({ projected: true, daysOverdue: 0 }), { minDays: 1 })).toBe(false);
    expect(parseDueFilters({ days: "45", utype: "Villa" })).toMatchObject({ minDays: 45, unitType: "Villa" });
    expect(parseDueFilters({ days: "abc" }).minDays).toBeUndefined();
    expect(matchesReceived(received(), { unitType: "Villa" })).toBe(false);
  });
  it("account status and PAN missing work on the due report too", () => {
    expect(matchesDue(due(), { status: "dues_pending" })).toBe(true);
    expect(matchesDue(due({ accountStatus: "paid_in_full" }), { status: "dues_pending" })).toBe(false);
    expect(matchesDue(due({ hasPan: false }), { panMissing: true })).toBe(true);
  });
});
