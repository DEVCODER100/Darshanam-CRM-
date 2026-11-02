/**
 * statement.ts — month-wise received/due statement maths (pure, no DB).
 *
 * Money is split into three components: basic (installment), GST and other
 * charges (maintenance). Each component is its own ledger:
 *   due(component) = max(Σ scheduled up to date − Σ received, 0)
 * Per-instalment dues are a FIFO display allocation of what was received, in
 * due-date order, so a short payment leaves the OLDEST instalment partly open.
 * All amounts are bigint paise.
 */

export interface Components {
  basic: bigint;
  gst: bigint;
  other: bigint;
}

export const ZERO: Components = { basic: 0n, gst: 0n, other: 0n };

export const sumComponents = (c: Components): bigint => c.basic + c.gst + c.other;

const add = (a: Components, b: Components): Components => ({
  basic: a.basic + b.basic,
  gst: a.gst + b.gst,
  other: a.other + b.other,
});

const nonNeg = (n: bigint): bigint => (n > 0n ? n : 0n);

const KEYS = ["basic", "gst", "other"] as const;

/** Split GST into CGST + SGST (equal halves; an odd paisa goes to SGST). */
export function splitGst(gst: bigint): { cgst: bigint; sgst: bigint } {
  const cgst = gst / 2n;
  return { cgst, sgst: gst - cgst };
}

/** Components of a schedule row. Legacy rows with no split count as all-basic. */
export function scheduleComponents(row: {
  amount: bigint;
  basicAmount: bigint;
  gstAmount: bigint;
  otherChargeAmount: bigint;
}): Components {
  const split = row.basicAmount + row.gstAmount + row.otherChargeAmount;
  if (split === 0n) return { basic: row.amount, gst: 0n, other: 0n };
  return {
    basic: row.basicAmount,
    gst: row.gstAmount,
    other: row.otherChargeAmount,
  };
}

/** Components of a payment: basic = total − gst − maintenance (never negative). */
export function paymentComponents(p: {
  amount: bigint;
  gstAmount: bigint;
  maintenanceAmount: bigint;
}): Components {
  return {
    basic: nonNeg(p.amount - p.gstAmount - p.maintenanceAmount),
    gst: p.gstAmount,
    other: p.maintenanceAmount,
  };
}

export interface ScheduleItem {
  id: string;
  dueDate: string; // YYYY-MM-DD
  label: string | null;
  percentageBps: number | null;
  comps: Components;
}

export interface BookingStatement {
  receivable: Components; // everything scheduled
  dueTillDate: Components; // scheduled with dueDate <= asOf
  received: Components;
  due: Components; // overdue now, per component, never negative
}

export function bookingStatement(
  schedule: ScheduleItem[],
  payments: Components[],
  asOf: string,
): BookingStatement {
  let receivable = ZERO;
  let dueTillDate = ZERO;
  for (const row of schedule) {
    receivable = add(receivable, row.comps);
    if (row.dueDate <= asOf) dueTillDate = add(dueTillDate, row.comps);
  }
  const received = payments.reduce(add, ZERO);
  return {
    receivable,
    dueTillDate,
    received,
    due: {
      basic: nonNeg(dueTillDate.basic - received.basic),
      gst: nonNeg(dueTillDate.gst - received.gst),
      other: nonNeg(dueTillDate.other - received.other),
    },
  };
}

/** Whole days from `from` to `to` (YYYY-MM-DD). Negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export interface RowDue {
  item: ScheduleItem;
  paid: Components; // part of this row covered by money received
  due: Components; // part of this row still unpaid
  daysOverdue: number; // 0 when not yet due
  projected: boolean; // due date is after asOf
}

/** FIFO allocation of received money to each schedule row, per component. */
export function rowDues(
  schedule: ScheduleItem[],
  payments: Components[],
  asOf: string,
): RowDue[] {
  const ordered = [...schedule].sort(
    (a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id),
  );
  const received = payments.reduce(add, ZERO);
  const remaining: Components = { ...received };

  return ordered.map((item) => {
    const paid: Components = { basic: 0n, gst: 0n, other: 0n };
    const due: Components = { basic: 0n, gst: 0n, other: 0n };
    for (const k of KEYS) {
      const take = remaining[k] < item.comps[k] ? remaining[k] : item.comps[k];
      paid[k] = take;
      due[k] = item.comps[k] - take;
      remaining[k] -= take;
    }
    const daysOverdue = item.dueDate < asOf ? daysBetween(item.dueDate, asOf) : 0;
    return { item, paid, due, daysOverdue, projected: item.dueDate > asOf };
  });
}

// --- report periods ---------------------------------------------------------

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "2026-09" -> first and last day of that month. */
export function monthRange(ym: string): { from: string; to: string } {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!m) throw new Error(`monthRange: invalid month "${ym}"`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) throw new Error(`monthRange: invalid month "${ym}"`);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    from: `${m[1]}-${m[2]}-01`,
    to: `${m[1]}-${m[2]}-${String(lastDay).padStart(2, "0")}`,
  };
}

/** "2026-09-30" -> "30 Sep, 2026" (the format used in the report titles). */
export function formatReportDate(iso: string): string {
  const [y, mo, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")} ${MONTHS[mo - 1]}, ${y}`;
}

/** "2026-09" shifted by `delta` months, e.g. (-1) -> "2026-08", (+1) at Dec -> next Jan. */
export function shiftMonth(ym: string, delta: number): string {
  monthRange(ym); // validates
  const [y, m] = ym.split("-").map(Number);
  const idx = y * 12 + (m - 1) + delta;
  const year = Math.floor(idx / 12);
  const month = (idx % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** True for a well-formed "YYYY-MM" month string. */
export function isMonth(value: string | undefined | null): value is string {
  return !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}
