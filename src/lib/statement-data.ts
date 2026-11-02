/**
 * statement-data.ts — DB readers for the month-wise Payment Received, Payment
 * Due and Statement reports. All maths lives in statement.ts (pure + tested).
 * All amounts are bigint paise.
 */
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  bookings,
  customers,
  loans,
  paymentSchedule,
  payments,
} from "@/db/schema";
import { todayISO } from "./booking-detail";
import {
  ZERO,
  bookingStatement,
  monthRange,
  paymentComponents,
  rowDues,
  scheduleComponents,
  splitGst,
  sumComponents,
  type Components,
  type ScheduleItem,
} from "./statement";

export const MODE_LABELS: Record<string, string> = {
  bank_transfer: "Bank transfer",
  rtgs: "RTGS",
  neft: "NEFT",
  cheque: "Cheque/DD",
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  other: "Other",
};

const TYPE_LABELS: Record<string, string> = {
  self_finance: "Self finance",
  bank_loan: "Bank loan",
  installment: "Installment",
};

export function paymentTypeLabel(paymentType: string, stageBased: boolean): string {
  const base = TYPE_LABELS[paymentType] ?? paymentType;
  return stageBased ? `${base} · Stage` : base;
}

const unitName = (type: string, number: string | null) =>
  number ? number : type;

const add = (a: Components, b: Components): Components => ({
  basic: a.basic + b.basic,
  gst: a.gst + b.gst,
  other: a.other + b.other,
  doc: a.doc + b.doc,
});

// --- Payment Received -------------------------------------------------------

export interface ReceivedRow {
  no: number;
  bookingId: string;
  date: string;
  unit: string;
  customer: string;
  mobile: string;
  paymentType: string;
  paidBy: string;
  mode: string;
  reference: string;
  bank: string;
  basic: bigint;
  cgst: bigint;
  sgst: bigint;
  maintenance: bigint;
  documentation: bigint;
  total: bigint;
  paymentFor: string;
  narration: string;
}

export interface ReceivedReport {
  month: string;
  from: string;
  to: string;
  rows: ReceivedRow[];
  totals: {
    basic: bigint;
    cgst: bigint;
    sgst: bigint;
    maintenance: bigint;
    documentation: bigint;
    total: bigint;
  };
}

export async function getReceivedReport(month: string): Promise<ReceivedReport> {
  const { from, to } = monthRange(month);
  const rows = await db
    .select({
      bookingId: bookings.id,
      date: payments.paymentDate,
      propertyType: bookings.propertyType,
      propertyNumber: bookings.propertyNumber,
      paymentType: bookings.paymentType,
      stageBased: bookings.stageBased,
      customer: customers.fullName,
      mobile: customers.mobile,
      source: payments.source,
      mode: payments.mode,
      reference: payments.referenceNumber,
      bankName: loans.bankName,
      amount: payments.amount,
      gstAmount: payments.gstAmount,
      maintenanceAmount: payments.maintenanceAmount,
      documentationAmount: payments.documentationAmount,
      paymentFor: payments.paymentFor,
      notes: payments.notes,
    })
    .from(payments)
    .innerJoin(bookings, eq(payments.bookingId, bookings.id))
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .leftJoin(loans, eq(loans.bookingId, bookings.id))
    .where(and(gte(payments.paymentDate, from), lte(payments.paymentDate, to)))
    .orderBy(desc(payments.paymentDate), desc(payments.createdAt));

  const totals = {
    basic: 0n,
    cgst: 0n,
    sgst: 0n,
    maintenance: 0n,
    documentation: 0n,
    total: 0n,
  };
  const out = rows.map((r, i): ReceivedRow => {
    const c = paymentComponents(r);
    const { cgst, sgst } = splitGst(c.gst);
    totals.basic += c.basic;
    totals.cgst += cgst;
    totals.sgst += sgst;
    totals.maintenance += c.other;
    totals.documentation += c.doc;
    totals.total += r.amount;
    return {
      no: i + 1,
      bookingId: r.bookingId,
      date: r.date,
      unit: unitName(r.propertyType, r.propertyNumber),
      customer: r.customer,
      mobile: r.mobile,
      paymentType: paymentTypeLabel(r.paymentType, r.stageBased),
      paidBy: r.source === "bank" ? "Bank" : "Client",
      mode: MODE_LABELS[r.mode] ?? r.mode,
      reference: r.reference ?? "—",
      bank: r.source === "bank" ? (r.bankName ?? "—") : "—",
      basic: c.basic,
      cgst,
      sgst,
      maintenance: c.other,
      documentation: c.doc,
      total: r.amount,
      paymentFor: r.paymentFor ?? "—",
      narration: r.notes ?? "",
    };
  });
  return { month, from, to, rows: out, totals };
}

// --- shared loader for due + statement --------------------------------------

interface BookingInfo {
  bookingId: string;
  unit: string;
  customer: string;
  mobile: string;
  paymentType: string;
  loanBank: string | null;
  schedule: ScheduleItem[];
  payments: { date: string; comps: Components }[];
}

async function loadBookings(): Promise<BookingInfo[]> {
  const [bookingRows, scheduleRows, paymentRows] = await Promise.all([
    db
      .select({
        id: bookings.id,
        propertyType: bookings.propertyType,
        propertyNumber: bookings.propertyNumber,
        paymentType: bookings.paymentType,
        stageBased: bookings.stageBased,
        customer: customers.fullName,
        mobile: customers.mobile,
        loanBank: loans.bankName,
      })
      .from(bookings)
      .innerJoin(customers, eq(bookings.customerId, customers.id))
      .leftJoin(loans, eq(loans.bookingId, bookings.id)),
    db.select().from(paymentSchedule),
    db.select().from(payments),
  ]);

  const schedByBooking = new Map<string, ScheduleItem[]>();
  for (const s of scheduleRows) {
    const list = schedByBooking.get(s.bookingId) ?? [];
    list.push({
      id: s.id,
      dueDate: s.dueDate,
      label: s.label,
      percentageBps: s.percentageBps,
      comps: scheduleComponents(s),
    });
    schedByBooking.set(s.bookingId, list);
  }
  const payByBooking = new Map<string, { date: string; comps: Components }[]>();
  for (const p of paymentRows) {
    const list = payByBooking.get(p.bookingId) ?? [];
    list.push({ date: p.paymentDate, comps: paymentComponents(p) });
    payByBooking.set(p.bookingId, list);
  }

  return bookingRows.map((b) => ({
    bookingId: b.id,
    unit: unitName(b.propertyType, b.propertyNumber),
    customer: b.customer,
    mobile: b.mobile,
    paymentType: paymentTypeLabel(b.paymentType, b.stageBased),
    loanBank: b.loanBank,
    schedule: schedByBooking.get(b.id) ?? [],
    payments: payByBooking.get(b.id) ?? [],
  }));
}

// --- Payment Due ------------------------------------------------------------

export interface DueRow {
  no: number;
  bookingId: string;
  dueDate: string;
  unit: string;
  customer: string;
  mobile: string;
  paymentType: string;
  instalment: string;
  percentage: number | null; // percent, e.g. 10 or 11.54
  basic: bigint;
  cgst: bigint;
  sgst: bigint;
  other: bigint;
  doc: bigint;
  total: bigint;
  daysOverdue: number;
  projected: boolean;
  loanBank: string;
}

export interface DueReport {
  month: string;
  from: string;
  to: string;
  asOf: string;
  rows: DueRow[];
  totals: {
    basic: bigint;
    cgst: bigint;
    sgst: bigint;
    other: bigint;
    doc: bigint;
    total: bigint;
  };
}

export async function getDueReport(
  month: string,
  asOf: string = todayISO(),
): Promise<DueReport> {
  const { from, to } = monthRange(month);
  const all = await loadBookings();

  const rows: DueRow[] = [];
  for (const b of all) {
    const dues = rowDues(
      b.schedule,
      b.payments.map((p) => p.comps),
      asOf,
    );
    for (const d of dues) {
      if (d.item.dueDate < from || d.item.dueDate > to) continue;
      if (sumComponents(d.due) === 0n) continue;
      const { cgst, sgst } = splitGst(d.due.gst);
      rows.push({
        no: 0,
        bookingId: b.bookingId,
        dueDate: d.item.dueDate,
        unit: b.unit,
        customer: b.customer,
        mobile: b.mobile,
        paymentType: b.paymentType,
        instalment: d.item.label ?? "Installment",
        percentage:
          d.item.percentageBps === null ? null : d.item.percentageBps / 100,
        basic: d.due.basic,
        cgst,
        sgst,
        other: d.due.other,
        doc: d.due.doc,
        total: sumComponents(d.due),
        daysOverdue: d.daysOverdue,
        projected: d.projected,
        loanBank: b.loanBank ?? "—",
      });
    }
  }
  rows.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.unit.localeCompare(b.unit));
  rows.forEach((r, i) => (r.no = i + 1));

  const totals = { basic: 0n, cgst: 0n, sgst: 0n, other: 0n, doc: 0n, total: 0n };
  for (const r of rows) {
    totals.basic += r.basic;
    totals.cgst += r.cgst;
    totals.sgst += r.sgst;
    totals.other += r.other;
    totals.doc += r.doc;
    totals.total += r.total;
  }
  return { month, from, to, asOf, rows, totals };
}

// --- Statement: Receivable / Received / Due by category ---------------------

export interface StatementLine {
  receivable: Components;
  received: Components;
  due: Components;
}

export interface Statement {
  month: string;
  from: string;
  to: string;
  asOf: string;
  thisMonth: StatementLine;
  allTime: StatementLine;
}

export async function getStatement(
  month: string,
  asOf: string = todayISO(),
): Promise<Statement> {
  const { from, to } = monthRange(month);
  const all = await loadBookings();

  let mReceivable = ZERO;
  let mReceived = ZERO;
  let mDue = ZERO;
  let aReceivable = ZERO;
  let aReceived = ZERO;
  let aDue = ZERO;

  for (const b of all) {
    const payComps = b.payments.map((p) => p.comps);
    const st = bookingStatement(b.schedule, payComps, asOf);
    aReceivable = add(aReceivable, st.receivable);
    aReceived = add(aReceived, st.received);
    aDue = add(aDue, st.due);

    for (const s of b.schedule) {
      if (s.dueDate >= from && s.dueDate <= to) mReceivable = add(mReceivable, s.comps);
    }
    for (const p of b.payments) {
      if (p.date >= from && p.date <= to) mReceived = add(mReceived, p.comps);
    }
    for (const d of rowDues(b.schedule, payComps, asOf)) {
      if (d.item.dueDate >= from && d.item.dueDate <= to) mDue = add(mDue, d.due);
    }
  }

  return {
    month,
    from,
    to,
    asOf,
    thisMonth: { receivable: mReceivable, received: mReceived, due: mDue },
    allTime: { receivable: aReceivable, received: aReceived, due: aDue },
  };
}
