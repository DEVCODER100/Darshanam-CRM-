/**
 * booking-detail.ts — the read model for a single booking. Loads cost, schedule,
 * payments and loan, then computes Outstanding + Balance Property Value via the
 * single source of truth in outstanding.ts (PRD §5). Used by both the booking
 * detail page and the GET API so they can never diverge.
 */
import { eq, asc, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  bookings,
  customers,
  propertyCosts,
  paymentSchedule,
  payments,
  loans,
} from "@/db/schema";
import { computeOutstanding, type OutstandingResult } from "./outstanding";
import {
  calculateReceivable,
  stageLabel,
  stagePercentBps,
} from "./stage";

export interface BookingDetail {
  booking: typeof bookings.$inferSelect;
  customer: typeof customers.$inferSelect | null;
  cost: typeof propertyCosts.$inferSelect | null;
  schedule: (typeof paymentSchedule.$inferSelect)[];
  payments: (typeof payments.$inferSelect)[];
  loan: typeof loans.$inferSelect | null;
  outstanding: OutstandingResult;
  receivableSummary: {
    receivable: bigint;
    due: bigint;
    stageLabel: string;
    stagePercentBps: number;
  };
}

/** "Today" as an ISO date (UTC) — the as-of date for the outstanding calc. */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function loadBookingDetail(
  bookingId: string,
  asOf: string = todayISO(),
): Promise<BookingDetail | null> {
  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, bookingId),
  });
  if (!booking) return null;

  const [customer, cost, schedule, paymentRows, loan] = await Promise.all([
    db.query.customers.findFirst({ where: eq(customers.id, booking.customerId) }),
    db.query.propertyCosts.findFirst({
      where: eq(propertyCosts.bookingId, bookingId),
    }),
    db
      .select()
      .from(paymentSchedule)
      .where(eq(paymentSchedule.bookingId, bookingId))
      .orderBy(asc(paymentSchedule.dueDate)),
    db
      .select()
      .from(payments)
      .where(eq(payments.bookingId, bookingId))
      .orderBy(desc(payments.paymentDate)),
    db.query.loans.findFirst({ where: eq(loans.bookingId, bookingId) }),
  ]);

  const totalCost = cost?.totalCost ?? 0n;
  const ledger = computeOutstanding(
    schedule.map((s) => ({ dueDate: s.dueDate, amount: s.amount })),
    paymentRows.map((p) => ({ amount: p.amount })),
    asOf,
    totalCost,
  );
  const scheduleDueTillDate = schedule
    .filter((row) => row.dueDate <= asOf)
    .reduce((sum, row) => sum + row.amount, 0n);
  const receivable = calculateReceivable({
    totalCost,
    paymentType: booking.paymentType,
    stageBased: booking.stageBased,
    currentStage: booking.currentStage,
    scheduleDueTillDate,
  });
  const due = receivable - ledger.totalPaid;
  const outstanding: OutstandingResult = {
    ...ledger,
    dueTillDate: receivable,
    outstanding: due,
    isAdvance: due < 0n,
    advanceAmount: due < 0n ? -due : 0n,
  };

  return {
    booking,
    customer: customer ?? null,
    cost: cost ?? null,
    schedule,
    payments: paymentRows,
    loan: loan ?? null,
    outstanding,
    receivableSummary: {
      receivable,
      due,
      stageLabel: stageLabel(booking.currentStage),
      stagePercentBps: stagePercentBps(booking.currentStage),
    },
  };
}
