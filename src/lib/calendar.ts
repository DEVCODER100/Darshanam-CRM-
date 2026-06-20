/**
 * calendar.ts — upcoming payments & cashflow view (workflow: "Calendar").
 * Groups scheduled instalments by month so the team can see expected inflows.
 * Split into overdue (due date already passed) and upcoming buckets.
 * All amounts are bigint paise.
 */
import { eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { bookings, customers, paymentSchedule } from "@/db/schema";
import { todayISO } from "./booking-detail";

export interface CashflowItem {
  bookingId: string;
  customerName: string;
  booking: string;
  dueDate: string;
  label: string | null;
  amount: bigint;
  overdue: boolean;
}

export interface MonthGroup {
  month: string; // YYYY-MM
  total: bigint;
  items: CashflowItem[];
}

export interface CashflowData {
  overdueTotal: bigint;
  upcomingTotal: bigint;
  months: MonthGroup[];
}

export async function getCashflow(asOf: string = todayISO()): Promise<CashflowData> {
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
    .orderBy(asc(paymentSchedule.dueDate));

  const byMonth = new Map<string, MonthGroup>();
  let overdueTotal = 0n;
  let upcomingTotal = 0n;

  for (const r of rows) {
    const overdue = r.dueDate < asOf;
    const item: CashflowItem = {
      bookingId: r.bookingId,
      customerName: r.customerName,
      booking: `${r.propertyType}${r.propertyNumber ? " " + r.propertyNumber : ""}`,
      dueDate: r.dueDate,
      label: r.label,
      amount: r.amount,
      overdue,
    };
    if (overdue) overdueTotal += r.amount;
    else upcomingTotal += r.amount;

    const key = r.dueDate.slice(0, 7);
    const group = byMonth.get(key) ?? { month: key, total: 0n, items: [] };
    group.items.push(item);
    group.total += r.amount;
    byMonth.set(key, group);
  }

  return {
    overdueTotal,
    upcomingTotal,
    months: [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)),
  };
}
