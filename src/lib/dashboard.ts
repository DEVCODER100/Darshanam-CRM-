import { inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  bookings,
  customers,
  loans,
  paymentSchedule,
  payments,
  propertyCosts,
} from "@/db/schema";
import { todayISO } from "./booking-detail";
import {
  calculateReceivable,
  CONSTRUCTION_STAGES,
  type PaymentType,
} from "./stage";

export interface PaymentBreakdown {
  receivable: bigint;
  received: bigint;
  due: bigint;
}

export interface DashboardData {
  totalCustomers: number;
  totalBookings: number;
  totalSalesValue: bigint;
  totalReceivable: bigint;
  totalReceived: bigint;
  totalOutstanding: bigint;
  pendingLoanAmount: bigint;
  activeLoans: number;
  paymentBreakdown: Record<PaymentType, PaymentBreakdown>;
  stageSummary: { value: string; label: string; count: number }[];
  alerts: {
    overduePayments: number;
    dueThisMonth: number;
    loanDocsPending: number;
    loanApprovalPending: number;
  };
}

function emptyBreakdown(): Record<PaymentType, PaymentBreakdown> {
  return {
    self_finance: { receivable: 0n, received: 0n, due: 0n },
    bank_loan: { receivable: 0n, received: 0n, due: 0n },
    installment: { receivable: 0n, received: 0n, due: 0n },
  };
}

export async function getDashboardData(
  asOf: string = todayISO(),
): Promise<DashboardData> {
  const monthStart = `${asOf.slice(0, 7)}-01`;
  const [year, month] = asOf.slice(0, 7).split("-").map(Number);
  const nextMonth =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const [
    customerRows,
    bookingRows,
    costRows,
    paymentRows,
    scheduleRows,
    pendingLoans,
    activeLoans,
    loanDocs,
    loanApproval,
    dueThisMonth,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(customers),
    db.select().from(bookings),
    db.select().from(propertyCosts),
    db.select().from(payments),
    db.select().from(paymentSchedule),
    db
      .select({ amount: loans.loanAmount })
      .from(loans)
      .where(inArray(loans.status, ["pending_docs", "applied", "approved"])),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(loans)
      .where(inArray(loans.status, ["approved", "disbursed"])),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(loans)
      .where(inArray(loans.status, ["pending_docs"])),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(loans)
      .where(inArray(loans.status, ["applied"])),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(paymentSchedule)
      .where(
        sql`${paymentSchedule.dueDate} >= ${monthStart} and ${paymentSchedule.dueDate} < ${nextMonth}`,
      ),
  ]);

  const costMap = new Map(costRows.map((row) => [row.bookingId, row]));
  const paymentsByBooking = new Map<string, bigint>();
  for (const payment of paymentRows) {
    paymentsByBooking.set(
      payment.bookingId,
      (paymentsByBooking.get(payment.bookingId) ?? 0n) + payment.amount,
    );
  }
  const scheduleDueByBooking = new Map<string, bigint>();
  for (const row of scheduleRows) {
    if (row.dueDate <= asOf) {
      scheduleDueByBooking.set(
        row.bookingId,
        (scheduleDueByBooking.get(row.bookingId) ?? 0n) + row.amount,
      );
    }
  }

  let totalSalesValue = 0n;
  let totalReceivable = 0n;
  let totalReceived = 0n;
  let totalOutstanding = 0n;
  let overduePayments = 0;
  const paymentBreakdown = emptyBreakdown();

  for (const booking of bookingRows) {
    const totalCost = costMap.get(booking.id)?.totalCost ?? 0n;
    const received = paymentsByBooking.get(booking.id) ?? 0n;
    const receivable = calculateReceivable({
      totalCost,
      paymentType: booking.paymentType,
      stageBased: booking.stageBased,
      currentStage: booking.currentStage,
      scheduleDueTillDate: scheduleDueByBooking.get(booking.id) ?? 0n,
    });
    const due = receivable > received ? receivable - received : 0n;
    totalSalesValue += totalCost;
    totalReceivable += receivable;
    totalReceived += received;
    totalOutstanding += due;
    if (due > 0n) overduePayments += 1;

    const bucket = paymentBreakdown[booking.paymentType];
    bucket.receivable += receivable;
    bucket.received += received;
    bucket.due += due;
  }

  const stageSummary = CONSTRUCTION_STAGES.map((stage) => ({
    value: stage.value,
    label: stage.label,
    count: bookingRows.filter((booking) => booking.currentStage === stage.value)
      .length,
  }));

  return {
    totalCustomers: customerRows[0].count,
    totalBookings: bookingRows.length,
    totalSalesValue,
    totalReceivable,
    totalReceived,
    totalOutstanding,
    pendingLoanAmount: pendingLoans.reduce(
      (sum, row) => sum + (row.amount ?? 0n),
      0n,
    ),
    activeLoans: activeLoans[0].count,
    paymentBreakdown,
    stageSummary,
    alerts: {
      overduePayments,
      dueThisMonth: dueThisMonth[0].count,
      loanDocsPending: loanDocs[0].count,
      loanApprovalPending: loanApproval[0].count,
    },
  };
}
