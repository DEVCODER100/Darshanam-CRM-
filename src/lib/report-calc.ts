/**
 * report-calc.ts — the pure grouping behind the sales-side reports (monthly sales,
 * per sales person, client ledger). Each builds an ExportTable so the screen and the
 * Excel/CSV/PDF downloads share one source. No database access here, so it is tested.
 */
import type { Cell, ExportTable } from "./export-types";
import { earnedOn, rewardOn, type BrokeragePlan, type RewardPlan } from "./agent-rates";
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
  bps: number; // the agent's own commission %, used when there is no plan (200 = 2%)
  plan?: BrokeragePlan | null;
  reward?: RewardPlan | null;
  group?: string;
}
export interface AgentAmount {
  agentId: string;
  date: string;
  amount: bigint;
  type?: string; // unit type, for per-type brokerage rates
  kind?: "brokerage" | "reward"; // for payments made to the agent
}

const mine = (xs: AgentAmount[], a: AgentRef, within: (d: string) => boolean) =>
  xs.filter((x) => x.agentId === a.id && within(x.date));
const sumOf = (xs: AgentAmount[]) => xs.reduce((s, x) => s + x.amount, 0n);

/** Units brought, value sold and money collected per agent in the period. */
export function agentSalesTable(agents: AgentRef[], sold: AgentAmount[], collected: AgentAmount[], period: Period): ExportTable {
  const inP = (d: string) => d >= period.from && d <= period.to;
  const rows = agents.map((a) => ({ a, s: mine(sold, a, inP), c: mine(collected, a, inP) }));
  return {
    title: `Agent report ${formatReportDate(period.from)} to ${formatReportDate(period.to)}`,
    columns: [{ header: "Agent" }, { header: "Mobile" }, { header: "Group" }, { header: "Brokerage plan" }, { header: "Units booked", align: "right" }, { header: "Sales value (Rs)", money: true }, { header: "Collected in period (Rs)", money: true }],
    rows: rows.map((r): Cell[] => [r.a.name, r.a.mobile ?? "—", r.a.group ?? "—", r.a.plan?.name ?? "—", r.s.length, sumOf(r.s), sumOf(r.c)]),
    footer: ["Total", "", "", "", rows.reduce((t, r) => t + r.s.length, 0), rows.reduce((t, r) => t + sumOf(r.s), 0n), rows.reduce((t, r) => t + sumOf(r.c), 0n)],
  };
}

/**
 * Brokerage is earned on the basic amount actually received, each unit type at its plan rate;
 * rewards on bookings made. What was paid out is deducted; "due" is cumulative up to the To date.
 */
export function agentBrokerageTable(agents: AgentRef[], basicReceived: AgentAmount[], sold: AgentAmount[], paid: AgentAmount[], period: Period): ExportTable {
  const inP = (d: string) => d >= period.from && d <= period.to;
  const upTo = (d: string) => d <= period.to;
  const rows = agents.map((a) => {
    const earn = (within: (d: string) => boolean) => earnedOn(a.plan, a.bps, mine(basicReceived, a, within).map((x) => ({ type: x.type ?? "", amount: x.amount })));
    const reward = (within: (d: string) => boolean) => rewardOn(a.reward, mine(sold, a, within).map((x) => x.amount));
    const payments = (kind: "brokerage" | "reward", within: (d: string) => boolean) => sumOf(mine(paid, a, within).filter((x) => (x.kind ?? "brokerage") === kind));
    return {
      a,
      basic: sumOf(mine(basicReceived, a, inP)),
      earned: earn(inP),
      paid: payments("brokerage", inP),
      due: earn(upTo) - payments("brokerage", upTo),
      rEarned: reward(inP),
      rPaid: payments("reward", inP),
      rDue: reward(upTo) - payments("reward", upTo),
    };
  });
  const sum = (f: (r: (typeof rows)[number]) => bigint) => rows.reduce((s, r) => s + f(r), 0n);
  return {
    title: `Agent brokerage ${formatReportDate(period.from)} to ${formatReportDate(period.to)}`,
    landscape: true,
    columns: [
      { header: "Agent" }, { header: "Plan" }, { header: "Basic received (Rs)", money: true }, { header: "Brokerage earned (Rs)", money: true },
      { header: "Brokerage paid (Rs)", money: true }, { header: "Brokerage due (Rs)", money: true },
      { header: "Reward earned (Rs)", money: true }, { header: "Reward paid (Rs)", money: true }, { header: "Reward due (Rs)", money: true },
    ],
    rows: rows.map((r): Cell[] => [r.a.name, r.a.plan?.name ?? `${r.a.bps / 100}%`, r.basic, r.earned, r.paid, r.due, r.rEarned, r.rPaid, r.rDue]),
    footer: ["Total", "", sum((r) => r.basic), sum((r) => r.earned), sum((r) => r.paid), sum((r) => r.due), sum((r) => r.rEarned), sum((r) => r.rPaid), sum((r) => r.rDue)],
  };
}
