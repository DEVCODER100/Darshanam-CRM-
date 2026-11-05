import { describe, it, expect } from "vitest";
import {
  agentBrokerageTable,
  agentSalesTable,
  commission,
  ledgerTable,
  monthsBetween,
  salesByMonth,
  salesByStaff,
  type AgentAmount,
  type AgentRef,
  type DatedAmount,
} from "./report-calc";

const d = (date: string, amount: bigint, by = "Pritesh"): DatedAmount => ({ date, amount, by });
const period = { from: "2026-09-01", to: "2026-11-30" };

describe("sales reports", () => {
  it("lists every month in a range, across a year end", () => {
    expect(monthsBetween("2026-11-15", "2027-01-02")).toEqual(["2026-11", "2026-12", "2027-01"]);
  });
  it("groups sold and collected by month, including empty months, with totals", () => {
    const t = salesByMonth(
      [d("2026-09-05", 100n), d("2026-09-20", 50n), d("2026-11-02", 70n)],
      [d("2026-10-10", 30n), d("2026-11-03", 20n), d("2026-11-04", 5n)],
      period,
    );
    expect(t.rows.map((r) => [r[1], r[2], r[3], r[4]])).toEqual([
      [2, 150n, 0, 0n],
      [0, 0n, 1, 30n],
      [1, 70n, 2, 25n],
    ]);
    expect(t.footer).toEqual(["Total", 3, 220n, 3, 55n]);
  });
  it("groups by sales person, biggest seller first, counting collections of people with no new sales", () => {
    const t = salesByStaff([d("2026-09-05", 100n, "A"), d("2026-09-06", 300n, "B")], [d("2026-10-01", 40n, "C")], period);
    expect(t.rows.map((r) => [r[0], r[1], r[2], r[3]])).toEqual([["B", 1, 300n, 0n], ["A", 1, 100n, 0n], ["C", 0, 0n, 40n]]);
    expect(t.footer).toEqual(["Total", 2, 400n, 40n]);
  });
});

describe("client ledger", () => {
  it("runs a balance: due adds, payments reduce, due comes first on the same day", () => {
    const t = ledgerTable("t", 1000n, [
      { date: "2026-10-05", particulars: "Paid", unit: "V-1", due: 0n, received: 1500n },
      { date: "2026-10-05", particulars: "Instalment", unit: "V-1", due: 2000n, received: 0n },
      { date: "2026-09-01", particulars: "Booking", unit: "V-1", due: 500n, received: 0n },
    ]);
    expect(t.rows.map((r) => [r[1], r[5]])).toEqual([["Opening balance", 1000n], ["Booking", 1500n], ["Instalment", 3500n], ["Paid", 2000n]]);
    expect(t.footer).toEqual(["Total", "", "", 2500n, 1500n, 2000n]);
  });
});


describe("agents and brokerage", () => {
  const agents: AgentRef[] = [
    { id: "a1", name: "Mehul", mobile: "98", bps: 200 },
    { id: "a2", name: "Kiran", mobile: null, bps: 150 },
  ];
  const amt = (agentId: string, date: string, amount: bigint): AgentAmount => ({ agentId, date, amount });
  it("rounds commission to the paisa", () => {
    expect(commission(1_000_000n, 200)).toBe(20_000n);
    expect(commission(333n, 150)).toBe(5n); // 4.995 -> 5
    expect(commission(0n, 200)).toBe(0n);
  });
  it("brokerage: earned on basic received in the period, due is cumulative", () => {
    const t = agentBrokerageTable(
      agents,
      [amt("a1", "2026-08-10", 1_000_000n), amt("a1", "2026-10-10", 500_000n), amt("a2", "2026-10-20", 200_000n)],
      [amt("a1", "2026-09-01", 10_000n)],
      { from: "2026-10-01", to: "2026-10-31" },
    );
    // Mehul: period basic 5,00,000 -> earned 10,000; paid in period 0; due = 2% of 15,00,000 (30,000) - paid 10,000 = 20,000
    expect(t.rows[0]).toEqual(["Mehul", "2%", 500_000n, 10_000n, 0n, 20_000n]);
    expect(t.rows[1]).toEqual(["Kiran", "1.5%", 200_000n, 3_000n, 0n, 3_000n]);
    expect(t.footer).toEqual(["Total", "", 700_000n, 13_000n, 0n, 23_000n]);
  });
  it("agent report: units, value and collections in the period only", () => {
    const t = agentSalesTable(agents, [amt("a1", "2026-10-02", 900n), amt("a1", "2026-07-02", 100n)], [amt("a2", "2026-10-05", 50n)], { from: "2026-10-01", to: "2026-10-31" });
    expect(t.rows).toEqual([["Mehul", "98", 1, 900n, 0n], ["Kiran", "—", 0, 0n, 50n]]);
  });
});
