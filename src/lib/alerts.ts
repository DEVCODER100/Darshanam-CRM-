/**
 * alerts.ts — list builders behind the dashboard alert cards (drill-downs).
 * Reuses the outstanding report for overdue; adds due-this-month and
 * loan-status lists. All money is bigint paise.
 */
import { and, gte, lt, eq, inArray, asc } from "drizzle-orm";
import { db } from "@/db";
import { bookings, customers, paymentSchedule, loans } from "@/db/schema";
import { todayISO } from "./booking-detail";

function bookingLabel(type: string, num: string | null) {
  return `${type}${num ? " " + num : ""}`;
}

function monthBounds(asOf: string) {
  const monthStart = asOf.slice(0, 7) + "-01";
  const [y, m] = asOf.slice(0, 7).split("-").map(Number);
  const nextMonth =
    m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return { monthStart, nextMonth };
}

export interface DueRow {
  bookingId: string;
  customerName: string;
  booking: string;
  dueDate: string;
  label: string | null;
  amount: bigint;
}

export async function getDueThisMonthList(asOf: string = todayISO()): Promise<DueRow[]> {
  const { monthStart, nextMonth } = monthBounds(asOf);
  const rows = await db
    .select({
      bookingId: bookings.id,
      propertyType: bookings.propertyType,
      propertyNumber: bookings.propertyNumber,
      customerName: customers.fullName,
      dueDate: paymentSchedule.dueDate,
      label: paymentSchedule.label,
      amount: paymentSchedule.amount,
    })
    .from(paymentSchedule)
    .innerJoin(bookings, eq(paymentSchedule.bookingId, bookings.id))
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .where(
      and(
        gte(paymentSchedule.dueDate, monthStart),
        lt(paymentSchedule.dueDate, nextMonth),
      ),
    )
    .orderBy(asc(paymentSchedule.dueDate));

  return rows.map((r) => ({
    bookingId: r.bookingId,
    customerName: r.customerName,
    booking: bookingLabel(r.propertyType, r.propertyNumber),
    dueDate: r.dueDate,
    label: r.label,
    amount: r.amount,
  }));
}

export interface LoanRow {
  bookingId: string;
  customerName: string;
  booking: string;
  status: string;
  loanAmount: bigint | null;
  bankName: string | null;
}

export async function getLoanStatusList(
  statuses: ("pending_docs" | "applied" | "approved" | "disbursed" | "rejected" | "not_applicable")[],
): Promise<LoanRow[]> {
  const rows = await db
    .select({
      bookingId: bookings.id,
      propertyType: bookings.propertyType,
      propertyNumber: bookings.propertyNumber,
      customerName: customers.fullName,
      status: loans.status,
      loanAmount: loans.loanAmount,
      bankName: loans.bankName,
    })
    .from(loans)
    .innerJoin(bookings, eq(loans.bookingId, bookings.id))
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .where(inArray(loans.status, statuses));

  return rows.map((r) => ({
    bookingId: r.bookingId,
    customerName: r.customerName,
    booking: bookingLabel(r.propertyType, r.propertyNumber),
    status: r.status,
    loanAmount: r.loanAmount,
    bankName: r.bankName,
  }));
}
