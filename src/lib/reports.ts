/**
 * reports.ts — data builders for the four reports (PRD §9). All money stays in
 * bigint paise; outstanding is computed live, never stored.
 */
import { sql, lte, eq, asc, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  customers,
  bookings,
  propertyCosts,
  paymentSchedule,
  payments,
  loans,
} from "@/db/schema";
import { todayISO } from "./booking-detail";
import type { ExportTable } from "./export-types";
import {
  calculateReceivable,
  CONSTRUCTION_STAGES,
  stageLabel,
} from "./stage";

const STATUS_LABEL: Record<string, string> = {
  not_applicable: "Not applicable",
  pending_docs: "Pending docs",
  applied: "Applied",
  approved: "Approved",
  disbursed: "Disbursed",
  rejected: "Rejected",
};

export const REPORT_TYPES = [
  "outstanding",
  "customer",
  "unit",
  "payment",
  "loan",
  "stage",
  "monthly",
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

function toBig(v: string | null): bigint {
  return v ? BigInt(v) : 0n;
}

function bookingLabel(propertyType: string, propertyNumber: string | null) {
  return `${propertyType}${propertyNumber ? " " + propertyNumber : ""}`;
}

async function dueAndPaidMaps(asOf: string) {
  const [due, paid] = await Promise.all([
    db
      .select({
        bookingId: paymentSchedule.bookingId,
        due: sql<string>`coalesce(sum(${paymentSchedule.amount}),0)`,
      })
      .from(paymentSchedule)
      .where(lte(paymentSchedule.dueDate, asOf))
      .groupBy(paymentSchedule.bookingId),
    db
      .select({
        bookingId: payments.bookingId,
        paid: sql<string>`coalesce(sum(${payments.amount}),0)`,
      })
      .from(payments)
      .groupBy(payments.bookingId),
  ]);
  const dueMap = new Map(due.map((r) => [r.bookingId, toBig(r.due)]));
  const paidMap = new Map(paid.map((r) => [r.bookingId, toBig(r.paid)]));
  return { dueMap, paidMap };
}

export interface OutstandingRow {
  bookingId: string;
  customerName: string;
  booking: string;
  totalCost: bigint;
  paid: bigint;
  outstanding: bigint;
}

export async function getOutstandingReport(
  asOf: string = todayISO(),
): Promise<OutstandingRow[]> {
  const rows = await db
    .select({
      bookingId: bookings.id,
      propertyType: bookings.propertyType,
      propertyNumber: bookings.propertyNumber,
      customerName: customers.fullName,
      totalCost: propertyCosts.totalCost,
      paymentType: bookings.paymentType,
      stageBased: bookings.stageBased,
      currentStage: bookings.currentStage,
    })
    .from(bookings)
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .leftJoin(propertyCosts, eq(propertyCosts.bookingId, bookings.id));

  const { dueMap, paidMap } = await dueAndPaidMaps(asOf);

  return rows
    .map((r) => {
      const paid = paidMap.get(r.bookingId) ?? 0n;
      const receivable = calculateReceivable({
        totalCost: r.totalCost ?? 0n,
        paymentType: r.paymentType,
        stageBased: r.stageBased,
        currentStage: r.currentStage,
        scheduleDueTillDate: dueMap.get(r.bookingId) ?? 0n,
      });
      const outstanding = receivable - paid;
      return {
        bookingId: r.bookingId,
        customerName: r.customerName,
        booking: bookingLabel(r.propertyType, r.propertyNumber),
        totalCost: r.totalCost ?? 0n,
        paid,
        outstanding,
      };
    })
    .filter((r) => r.outstanding > 0n)
    .sort((a, b) => (b.outstanding > a.outstanding ? 1 : -1));
}

export interface LoanReportRow {
  customerName: string;
  booking: string;
  status: string;
  loanAmount: bigint | null;
  bankName: string | null;
  approvalDate: string | null;
  disbursementDate: string | null;
}

export async function getLoanReport(): Promise<LoanReportRow[]> {
  const rows = await db
    .select({
      customerName: customers.fullName,
      propertyType: bookings.propertyType,
      propertyNumber: bookings.propertyNumber,
      status: loans.status,
      loanAmount: loans.loanAmount,
      bankName: loans.bankName,
      approvalDate: loans.approvalDate,
      disbursementDate: loans.disbursementDate,
    })
    .from(loans)
    .innerJoin(bookings, eq(loans.bookingId, bookings.id))
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .orderBy(asc(loans.status));

  return rows.map((r) => ({
    customerName: r.customerName,
    booking: bookingLabel(r.propertyType, r.propertyNumber),
    status: r.status,
    loanAmount: r.loanAmount ?? null,
    bankName: r.bankName,
    approvalDate: r.approvalDate,
    disbursementDate: r.disbursementDate,
  }));
}

export interface MonthlyCollectionRow {
  month: string; // YYYY-MM
  total: bigint;
  count: number;
}

export async function getMonthlyCollection(): Promise<MonthlyCollectionRow[]> {
  const rows = await db
    .select({
      month: sql<string>`to_char(${payments.paymentDate}, 'YYYY-MM')`,
      total: sql<string>`coalesce(sum(${payments.amount}),0)`,
      count: sql<number>`count(*)::int`,
    })
    .from(payments)
    .groupBy(sql`to_char(${payments.paymentDate}, 'YYYY-MM')`)
    .orderBy(desc(sql`to_char(${payments.paymentDate}, 'YYYY-MM')`));

  return rows.map((r) => ({
    month: r.month,
    total: toBig(r.total),
    count: r.count,
  }));
}

export async function getUnitReport() {
  return db
    .select({
      bookingId: bookings.id,
      customerName: customers.fullName,
      projectName: bookings.projectName,
      unitType: bookings.propertyType,
      unitNumber: bookings.propertyNumber,
      unitStatus: bookings.unitStatus,
      paymentType: bookings.paymentType,
      currentStage: bookings.currentStage,
      agreementValue: propertyCosts.agreementValue,
      totalCost: propertyCosts.totalCost,
    })
    .from(bookings)
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .leftJoin(propertyCosts, eq(propertyCosts.bookingId, bookings.id))
    .orderBy(asc(bookings.propertyType), asc(bookings.propertyNumber));
}

export async function getPaymentReport() {
  return db
    .select({
      transactionId: payments.id,
      paymentDate: payments.paymentDate,
      customerName: customers.fullName,
      unitType: bookings.propertyType,
      unitNumber: bookings.propertyNumber,
      paymentType: bookings.paymentType,
      stage: payments.stage,
      amount: payments.amount,
      mode: payments.mode,
      source: payments.source,
      referenceNumber: payments.referenceNumber,
      notes: payments.notes,
    })
    .from(payments)
    .innerJoin(bookings, eq(payments.bookingId, bookings.id))
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .orderBy(desc(payments.paymentDate));
}

export async function getStageCollectionReport(asOf: string = todayISO()) {
  const [bookingRows, costRows, paymentRows, scheduleRows] = await Promise.all([
    db.select().from(bookings),
    db.select().from(propertyCosts),
    db.select().from(payments),
    db.select().from(paymentSchedule),
  ]);
  const costs = new Map(costRows.map((row) => [row.bookingId, row.totalCost]));
  const received = new Map<string, bigint>();
  for (const payment of paymentRows) {
    received.set(
      payment.bookingId,
      (received.get(payment.bookingId) ?? 0n) + payment.amount,
    );
  }
  const scheduled = new Map<string, bigint>();
  for (const row of scheduleRows) {
    if (row.dueDate <= asOf) {
      scheduled.set(
        row.bookingId,
        (scheduled.get(row.bookingId) ?? 0n) + row.amount,
      );
    }
  }

  return CONSTRUCTION_STAGES.map((stage) => {
    const stageBookings = bookingRows.filter(
      (booking) => booking.currentStage === stage.value,
    );
    let receivable = 0n;
    let collected = 0n;
    for (const booking of stageBookings) {
      receivable += calculateReceivable({
        totalCost: costs.get(booking.id) ?? 0n,
        paymentType: booking.paymentType,
        stageBased: booking.stageBased,
        currentStage: booking.currentStage,
        scheduleDueTillDate: scheduled.get(booking.id) ?? 0n,
      });
      collected += received.get(booking.id) ?? 0n;
    }
    return {
      stage: stage.label,
      percentage: stage.percentBps / 100,
      units: stageBookings.length,
      receivable,
      received: collected,
      pending: receivable > collected ? receivable - collected : 0n,
    };
  });
}

export interface CustomerReportEntry {
  customerName: string;
  mobile: string;
  bookings: {
    booking: string;
    totalCost: bigint;
    paid: bigint;
    outstanding: bigint;
    payments: { date: string; amount: bigint; mode: string; reference: string | null }[];
  }[];
}

export async function getCustomerReport(
  asOf: string = todayISO(),
): Promise<CustomerReportEntry[]> {
  const [custRows, bookRows, payRows, costRows] = await Promise.all([
    db.select().from(customers).orderBy(asc(customers.fullName)),
    db.select().from(bookings),
    db.select().from(payments).orderBy(desc(payments.paymentDate)),
    db.select().from(propertyCosts),
  ]);
  const { dueMap } = await dueAndPaidMaps(asOf);

  const costMap = new Map(costRows.map((c) => [c.bookingId, c.totalCost]));
  const paysByBooking = new Map<string, typeof payRows>();
  for (const p of payRows) {
    const arr = paysByBooking.get(p.bookingId) ?? [];
    arr.push(p);
    paysByBooking.set(p.bookingId, arr);
  }
  const booksByCustomer = new Map<string, typeof bookRows>();
  for (const b of bookRows) {
    const arr = booksByCustomer.get(b.customerId) ?? [];
    arr.push(b);
    booksByCustomer.set(b.customerId, arr);
  }

  return custRows.map((c) => ({
    customerName: c.fullName,
    mobile: c.mobile,
    bookings: (booksByCustomer.get(c.id) ?? []).map((b) => {
      const bookingPays = paysByBooking.get(b.id) ?? [];
      const paid = bookingPays.reduce((s, p) => s + p.amount, 0n);
      return {
        booking: bookingLabel(b.propertyType, b.propertyNumber),
        totalCost: costMap.get(b.id) ?? 0n,
        paid,
        outstanding:
          calculateReceivable({
            totalCost: costMap.get(b.id) ?? 0n,
            paymentType: b.paymentType,
            stageBased: b.stageBased,
            currentStage: b.currentStage,
            scheduleDueTillDate: dueMap.get(b.id) ?? 0n,
          }) - paid,
        payments: bookingPays.map((p) => ({
          date: p.paymentDate,
          amount: p.amount,
          mode: p.mode,
          reference: p.referenceNumber,
        })),
      };
    }),
  }));
}

/** Build the generic export table for a given report type (PRD §9 + export). */
export async function getReportTable(
  type: ReportType,
  asOf: string = todayISO(),
): Promise<ExportTable> {
  if (type === "outstanding") {
    const rows = await getOutstandingReport(asOf);
    const total = rows.reduce((s, r) => s + r.outstanding, 0n);
    return {
      title: "Outstanding report",
      columns: [
        { header: "Customer" },
        { header: "Booking" },
        { header: "Total cost", money: true },
        { header: "Paid", money: true },
        { header: "Outstanding", money: true },
      ],
      rows: rows.map((r) => [r.customerName, r.booking, r.totalCost, r.paid, r.outstanding]),
      footer: ["Total outstanding", "", "", "", total],
    };
  }

  if (type === "loan") {
    const rows = await getLoanReport();
    return {
      title: "Loan report",
      columns: [
        { header: "Customer" },
        { header: "Booking" },
        { header: "Status" },
        { header: "Loan amount", money: true },
        { header: "Bank" },
        { header: "Approved" },
        { header: "Disbursed" },
      ],
      rows: rows.map((r) => [
        r.customerName,
        r.booking,
        STATUS_LABEL[r.status] ?? r.status,
        r.loanAmount ?? 0n,
        r.bankName ?? "—",
        r.approvalDate ?? "—",
        r.disbursementDate ?? "—",
      ]),
    };
  }

  if (type === "unit") {
    const rows = await getUnitReport();
    return {
      title: "Unit report",
      columns: [
        { header: "Customer" },
        { header: "Project" },
        { header: "Unit" },
        { header: "Status" },
        { header: "Payment type" },
        { header: "Stage" },
        { header: "Agreement value", money: true },
        { header: "Total payable", money: true },
      ],
      rows: rows.map((row) => [
        row.customerName,
        row.projectName ?? "—",
        bookingLabel(row.unitType, row.unitNumber),
        row.unitStatus,
        row.paymentType.replace("_", " "),
        stageLabel(row.currentStage),
        row.agreementValue ?? 0n,
        row.totalCost ?? 0n,
      ]),
    };
  }

  if (type === "payment") {
    const rows = await getPaymentReport();
    return {
      title: "Payment report",
      columns: [
        { header: "Date" },
        { header: "Customer" },
        { header: "Unit" },
        { header: "Payment type" },
        { header: "Stage" },
        { header: "Source" },
        { header: "Method" },
        { header: "Amount", money: true },
      ],
      rows: rows.map((row) => [
        row.paymentDate,
        row.customerName,
        bookingLabel(row.unitType, row.unitNumber),
        row.paymentType.replace("_", " "),
        stageLabel(row.stage),
        row.source,
        row.mode,
        row.amount,
      ]),
    };
  }

  if (type === "stage") {
    const rows = await getStageCollectionReport(asOf);
    return {
      title: "Stage-wise collection report",
      columns: [
        { header: "Stage" },
        { header: "Percentage" },
        { header: "Units" },
        { header: "Receivable", money: true },
        { header: "Received", money: true },
        { header: "Pending", money: true },
      ],
      rows: rows.map((row) => [
        row.stage,
        `${row.percentage}%`,
        row.units,
        row.receivable,
        row.received,
        row.pending,
      ]),
    };
  }

  if (type === "monthly") {
    const rows = await getMonthlyCollection();
    const total = rows.reduce((s, r) => s + r.total, 0n);
    return {
      title: "Monthly collection",
      columns: [
        { header: "Month" },
        { header: "Payments", align: "right" },
        { header: "Collected", money: true },
      ],
      rows: rows.map((r) => [r.month, r.count, r.total]),
      footer: ["Total", "", total],
    };
  }

  // customer — flattened to one row per booking
  const entries = await getCustomerReport(asOf);
  const rows: ExportTable["rows"] = [];
  for (const c of entries) {
    if (c.bookings.length === 0) {
      rows.push([c.customerName, c.mobile, "—", 0n, 0n, 0n]);
    }
    for (const b of c.bookings) {
      rows.push([c.customerName, c.mobile, b.booking, b.totalCost, b.paid, b.outstanding]);
    }
  }
  return {
    title: "Customer report",
    columns: [
      { header: "Customer" },
      { header: "Mobile" },
      { header: "Booking" },
      { header: "Total cost", money: true },
      { header: "Paid", money: true },
      { header: "Outstanding", money: true },
    ],
    rows,
  };
}
