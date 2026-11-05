import { describe, it, expect } from "vitest";
import { activeCount, matchesUnit, parseUnitFilters, segmentOf, type FilterUnit } from "./unit-filters";
import { rupeesToPaise } from "./money";

const booked = (over: Partial<NonNullable<FilterUnit["booking"]>> = {}, unit: Partial<FilterUnit> = {}): FilterUnit => ({
  name: "Flat 302", unitNumber: "302", unitType: "Flat", subType: "Type B", floor: "3", areaSqft: "1100.00",
  status: "booked", owner: "Pooja Modi",
  booking: {
    code: "BI012", date: "2026-03-10", paymentType: "bank_loan", stageBased: true, stage: "plinth", bookedBy: "Pritesh",
    clientCode: "CL007", mobile: "+919812345678", panHash: "hash-pooja", loanBank: "HDFC Bank", hasLoan: true,
    hasAgreement: true, totalCost: rupeesToPaise("5000000"), accountStatus: "dues_pending", ...over,
  },
  ...unit,
});
const free: FilterUnit = { name: "Flat 101", unitNumber: "101", unitType: "Flat", subType: "Type A", floor: "1", areaSqft: "950.00", status: "available", owner: null, booking: null };

describe("parsing", () => {
  it("reads the URL and ignores junk", () => {
    const f = parseUnitFilters({ type: "Flat", sub: "Type B", pay: "bank_loan", stage: "plinth", loan: "yes", pmin: "1000000", amin: "900", status: "nonsense", pay2: "x", acct: "bad" });
    expect(f).toMatchObject({ type: "Flat", subType: "Type B", payment: "bank_loan", stage: "plinth", loan: "yes", minArea: 900 });
    expect(f.minPrice).toBe(rupeesToPaise("1000000"));
    expect(f.status).toBeUndefined();
    expect(f.account).toBeUndefined();
    expect(activeCount(parseUnitFilters({}))).toBe(0);
    expect(activeCount(f)).toBe(7);
  });
  it("derives the segment from the type", () => {
    expect(segmentOf("Shop")).toBe("Commercial");
    expect(segmentOf("Villa")).toBe("Residential");
  });
});

describe("matching", () => {
  it("no filters matches everything", () => {
    expect(matchesUnit(free, {})).toBe(true);
    expect(matchesUnit(booked(), {})).toBe(true);
  });
  it("unit-side filters work on free units too", () => {
    expect(matchesUnit(free, { type: "Flat", subType: "type a", floor: "1", minArea: 900, maxArea: 1000 })).toBe(true);
    expect(matchesUnit(free, { subType: "Type B" })).toBe(false);
    expect(matchesUnit(free, { segment: "Commercial" })).toBe(false);
    expect(matchesUnit(free, { status: "available" })).toBe(true);
  });
  it("any booking filter excludes a free unit", () => {
    for (const f of [{ payment: "bank_loan" as const }, { loan: "no" as const }, { client: "x" }, { stage: "plinth" as const }, { minPrice: 1n }])
      expect(matchesUnit(free, f)).toBe(false);
  });
  it("payment, scheme, stage, loan, bank (any spelling), agreement, account status", () => {
    const u = booked();
    expect(matchesUnit(u, { payment: "bank_loan", scheme: "stage", stage: "plinth", loan: "yes", bank: "hdfc", agreement: "yes", account: "dues_pending" })).toBe(true);
    expect(matchesUnit(u, { payment: "self_finance" })).toBe(false);
    expect(matchesUnit(u, { scheme: "schedule" })).toBe(false);
    expect(matchesUnit(u, { stage: "flooring" })).toBe(false);
    expect(matchesUnit(u, { loan: "no" })).toBe(false);
    expect(matchesUnit(u, { bank: "icici" })).toBe(false);
    expect(matchesUnit(u, { agreement: "no" })).toBe(false);
    expect(matchesUnit(u, { account: "paid_in_full" })).toBe(false);
  });
  it("finds a client by name, mobile, client code or exact PAN; booked by; booking ID", () => {
    const u = booked();
    for (const client of ["pooja", "98123", "cl007"]) expect(matchesUnit(u, { client })).toBe(true);
    expect(matchesUnit(u, { client: "ABCDE1234F" })).toBe(false);
    expect(matchesUnit(u, { client: "ABCDE1234F" }, { clientPanHash: "hash-pooja" })).toBe(true);
    expect(matchesUnit(u, { bookedBy: "prit" })).toBe(true);
    expect(matchesUnit(u, { bookingCode: "bi012" })).toBe(true);
    expect(matchesUnit(u, { bookingCode: "bi999" })).toBe(false);
  });
  it("price range and booking dates", () => {
    const u = booked();
    expect(matchesUnit(u, { minPrice: rupeesToPaise("4000000"), maxPrice: rupeesToPaise("6000000") })).toBe(true);
    expect(matchesUnit(u, { minPrice: rupeesToPaise("6000000") })).toBe(false);
    expect(matchesUnit(u, { from: "2026-03-01", to: "2026-03-31" })).toBe(true);
    expect(matchesUnit(u, { from: "2026-04-01" })).toBe(false);
  });
  it("combines filters with AND, and search matches unit name or owner", () => {
    expect(matchesUnit(booked(), { q: "pooja", type: "Flat", payment: "bank_loan" })).toBe(true);
    expect(matchesUnit(booked(), { q: "302", payment: "installment" })).toBe(false);
  });
});
