/**
 * report-calc.ts — the pure grouping behind the sales-side reports (monthly sales,
 * per sales person, client ledger). Each builds an ExportTable so the screen and the
 * Excel/CSV/PDF downloads share one source. No database access here, so it is tested.
 */
import type { Cell, ExportTable } from "./export-types";
import { formatReportDate, shiftMonth } from "./statement";

type Period = { from: string; to: string };

export const UNASSIGNED = "Not recorded";

export interface DatedAmount {
  date: string; // ISO date
  amount: bigint;
  by: string; // sales person
}

/** "2026-08" ... "2026-11" for a from/to range. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let m = from.slice(0, 7); m <= to.slice(0, 7); m = shiftMonth(m, 1)) out.push(m);
  return out;
}

const sum = (xs: DatedAmount[]) => xs.reduce((s, x) => s + x.amount, 0n);
const monthName = (ym: string) => formatReportDate(`${ym}-01`).replace(/^\d+ /, "").replace(",", "");

/** One row per month of the period: bookings made, value sold, money collected. */
export function salesByMonth(sold: DatedAmount[], collected: DatedAmount[], period: Period): ExportTable {
  const rows = monthsBetween(period.from, period.to).map((m) => {
    const s = sold.filter((x) => x.date.startsWith(m));
    const c = collected.filter((x) => x.date.startsWith(m));
    return { m, bookings: s.length, value: sum(s), payments: c.length, collected: sum(c) };
  });
  const t = (f: (r: (typeof rows)[number]) => bigint | number) => rows.reduce((a, r) => a + BigInt(f(r)), 0n);
  return {
    title: `Monthly sales ${formatReportDate(period.from)} to ${formatReportDate(period.to)}`,
    columns: [{ header: "Month" }, { header: "Units booked", align: "right" }, { header: "Sales value (Rs)", money: true }, { header: "Payments", align: "right" }, { header: "Collected (Rs)", money: true }],
    rows: rows.map((r): Cell[] => [monthName(r.m), r.bookings, r.value, r.payments, r.collected]),
    footer: ["Total", Number(t((r) => r.bookings)), t((r) => r.value), Number(t((r) => r.payments)), t((r) => r.collected)],
  };
}

/** One row per sales person. */
export function salesByStaff(sold: DatedAmount[], collected: DatedAmount[], period: Period): ExportTable {
  const names = [...new Set([...sold, ...collected].map((x) => x.by))].sort((a, b) => a.localeCompare(b));
  const rows = names.map((n) => {
    const s = sold.filter((x) => x.by === n);
    const c = collected.filter((x) => x.by === n);
    return { n, units: s.length, value: sum(s), collected: sum(c) };
  });
  rows.sort((a, b) => (b.value > a.value ? 1 : b.value < a.value ? -1 : 0));
  return {
    title: `Sales by person ${formatReportDate(period.from)} to ${formatReportDate(period.to)}`,
    columns: [{ header: "Booked by" }, { header: "Units booked", align: "right" }, { header: "Sales value (Rs)", money: true }, { header: "Collected in period (Rs)", money: true }],
    rows: rows.map((r): Cell[] => [r.n, r.units, r.value, r.collected]),
    footer: ["Total", rows.reduce((a, r) => a + r.units, 0), rows.reduce((a, r) => a + r.value, 0n), rows.reduce((a, r) => a + r.collected, 0n)],
  };
}

export interface LedgerEntry {
  date: string;
  particulars: string;
  unit: string;
  due: bigint; // instalment falling due (debit)
  received: bigint; // payment (credit)
}

/** Instalments and payments in date order with a running balance (owed - paid). */
export function ledgerTable(title: string, opening: bigint, entries: LedgerEntry[]): ExportTable {
  // On the same day, what falls due comes before what is paid.
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date) || Number(b.due > 0n) - Number(a.due > 0n));
  let bal = opening;
  const rows: Cell[][] = [["", "Opening balance", "", 0n, 0n, opening]];
  for (const e of sorted) {
    bal += e.due - e.received;
    rows.push([formatReportDate(e.date), e.particulars, e.unit, e.due, e.received, bal]);
  }
  return {
    title,
    columns: [{ header: "Date" }, { header: "Particulars" }, { header: "Unit" }, { header: "Due (Rs)", money: true }, { header: "Received (Rs)", money: true }, { header: "Balance (Rs)", money: true }],
    rows,
    footer: ["Total", "", "", sorted.reduce((a, e) => a + e.due, 0n), sorted.reduce((a, e) => a + e.received, 0n), bal],
  };
}


// --- agents -----------------------------------------------------------------

export interface AgentRef {
  id: string;
  name: string;
  mobile: string | null;
  bps: number; // commission, 200 = 2%
}
export interface AgentAmount {
  agentId: string;
  date: string;
  amount: bigint;
}

/** Commission on an amount, rounded to the paisa. */
export const commission = (basic: bigint, bps: number) => (basic * BigInt(bps) + 5000n) / 10000n;

const total = (xs: AgentAmount[], agentId: string, within: (d: string) => boolean) =>
  xs.filter((x) => x.agentId === agentId && within(x.date)).reduce((s, x) => s + x.amount, 0n);
const count = (xs: AgentAmount[], agentId: string, within: (d: string) => boolean) =>
  xs.filter((x) => x.agentId === agentId && within(x.date)).length;

/** Units brought, value sold and money collected per agent in the period. */
export function agentSalesTable(agents: AgentRef[], sold: AgentAmount[], collected: AgentAmount[], period: Period): ExportTable {
  const inP = (d: string) => d >= period.from && d <= period.to;
  const rows = agents.map((a) => ({ a, units: count(sold, a.id, inP), value: total(sold, a.id, inP), got: total(collected, a.id, inP) }));
  return {
    title: `Agent report ${formatReportDate(period.from)} to ${formatReportDate(period.to)}`,
    columns: [{ header: "Agent" }, { header: "Mobile" }, { header: "Units booked", align: "right" }, { header: "Sales value (Rs)", money: true }, { header: "Collected in period (Rs)", money: true }],
    rows: rows.map((r): Cell[] => [r.a.name, r.a.mobile ?? "—", r.units, r.value, r.got]),
    footer: ["Total", "", rows.reduce((s, r) => s + r.units, 0), rows.reduce((s, r) => s + r.value, 0n), rows.reduce((s, r) => s + r.got, 0n)],
  };
}

/**
 * Brokerage: commission is earned on the basic amount actually received, and what has
 * been paid out is deducted; "due" is cumulative up to the To date.
 */
export function agentBrokerageTable(agents: AgentRef[], basicReceived: AgentAmount[], paid: AgentAmount[], period: Period): ExportTable {
  const inP = (d: string) => d >= period.from && d <= period.to;
  const upTo = (d: string) => d <= period.to;
  const rows = agents.map((a) => {
    const basic = total(basicReceived, a.id, inP);
    return {
      a,
      basic,
      earned: commission(basic, a.bps),
      paid: total(paid, a.id, inP),
      due: commission(total(basicReceived, a.id, upTo), a.bps) - total(paid, a.id, upTo),
    };
  });
  const sum = (f: (r: (typeof rows)[number]) => bigint) => rows.reduce((s, r) => s + f(r), 0n);
  return {
    title: `Agent brokerage ${formatReportDate(period.from)} to ${formatReportDate(period.to)}`,
    columns: [{ header: "Agent" }, { header: "Commission %", align: "right" }, { header: "Basic received (Rs)", money: true }, { header: "Earned (Rs)", money: true }, { header: "Paid (Rs)", money: true }, { header: "Due as on To date (Rs)", money: true }],
    rows: rows.map((r): Cell[] => [r.a.name, `${r.a.bps / 100}%`, r.basic, r.earned, r.paid, r.due]),
    footer: ["Total", "", sum((r) => r.basic), sum((r) => r.earned), sum((r) => r.paid), sum((r) => r.due)],
  };
}
