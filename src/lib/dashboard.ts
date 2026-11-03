import { sql } from "drizzle-orm";
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
  PAYMENT_TYPES,
  type PaymentType,
} from "./stage";
import { stageDisbursement } from "./stage-ladder";
import { activeProjectId, forBookings, inProject } from "./project-scope";

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
  stageMetrics: {
    customers: number;
    pendingRelease: bigint;
    released: bigint;
    remaining: bigint;
  };
  alerts: {
    overduePayments: number;
    dueThisMonth: number;
    loanDocsPending: number;
    loanApprovalPending: number;
  };
}

function emptyBreakdown(): Record<PaymentType, PaymentBreakdown> {
  return Object.fromEntries(
    (Object.keys(PAYMENT_TYPES) as PaymentType[]).map((k) => [k, { receivable: 0n, received: 0n, due: 0n }]),
  ) as Record<PaymentType, PaymentBreakdown>;
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

  // Everything is loaded for the active project only; child rows follow their booking.
  const pid = await activeProjectId();
  const [customerRows, bookingRows, allCosts, allPayments, allSchedule, allLoans] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(customers).where(inProject(customers.projectId, pid)),
    db.select().from(bookings).where(inProject(bookings.projectId, pid)),
    db.select().from(propertyCosts),
    db.select().from(payments),
    db.select().from(paymentSchedule),
    db.select({ bookingId: loans.bookingId, status: loans.status, amount: loans.loanAmount }).from(loans),
  ]);
  const ids = new Set(bookingRows.map((b) => b.id));
  const costRows = forBookings(allCosts, ids);
  const paymentRows = forBookings(allPayments, ids);
  const scheduleRows = forBookings(allSchedule, ids);
  const loanRows = forBookings(allLoans, ids);
  const loansIn = (...statuses: string[]) => loanRows.filter((l) => statuses.includes(l.status));

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
  let stageCustomers = 0;
  let stagePendingRelease = 0n;
  let stageReleased = 0n;
  let stageRemaining = 0n;

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

    if (booking.stageBased) {
      const sd = stageDisbursement(totalCost, booking.currentStage, received);
      stageCustomers += 1;
      stagePendingRelease += sd.pendingRelease;
      stageReleased += received;
      stageRemaining += sd.remaining;
    }
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
    pendingLoanAmount: loansIn("pending_docs", "applied", "approved").reduce((sum, row) => sum + (row.amount ?? 0n), 0n),
    activeLoans: loansIn("approved", "disbursed").length,
    paymentBreakdown,
    stageSummary,
    stageMetrics: {
      customers: stageCustomers,
      pendingRelease: stagePendingRelease,
      released: stageReleased,
      remaining: stageRemaining,
    },
    alerts: {
      overduePayments,
      dueThisMonth: scheduleRows.filter((r) => r.dueDate >= monthStart && r.dueDate < nextMonth).length,
      loanDocsPending: loansIn("pending_docs").length,
      loanApprovalPending: loansIn("applied").length,
    },
  };
}
