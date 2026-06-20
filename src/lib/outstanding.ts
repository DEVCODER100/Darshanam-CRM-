/**
 * outstanding.ts — THE critical calculation (PRD §5).
 *
 * One formula. One subtraction. No per-instalment running balances that can
 * compound into the ₹1.2 Cr double-counting bug. The whole booking is a single
 * ledger: cumulative due minus cumulative paid.
 *
 *   Outstanding(as of D) = Σ(schedule.amount WHERE due_date <= D) − Σ(payments.amount)
 *
 * Payments are NOT tied to specific instalments; they reduce the total. This is
 * implemented as a pure function over rows so it is trivially testable without a
 * database (PRD §12.3) and is the SINGLE source of truth used by API reads too.
 *
 * All amounts are bigint paise.
 */

export interface ScheduleRow {
  dueDate: string; // ISO date "YYYY-MM-DD"
  amount: bigint; // paise
}

export interface PaymentRow {
  amount: bigint; // paise
}

export interface OutstandingResult {
  /** Σ schedule amounts with due_date <= asOf. */
  dueTillDate: bigint;
  /** Σ all payments received (regardless of date). */
  totalPaid: bigint;
  /** dueTillDate − totalPaid. Negative means the customer is in advance/credit. */
  outstanding: bigint;
  /** total_cost − totalPaid. Total still owed across the WHOLE plan (PRD §5). */
  balancePropertyValue: bigint;
  /** True when outstanding < 0 — UI shows "Advance: ₹X" instead of a negative. */
  isAdvance: boolean;
  /** Magnitude of the advance/credit (0 when not in advance). */
  advanceAmount: bigint;
  /** True when totalPaid > totalCost — flag as a data-entry error (PRD §5 edge 3). */
  overpaidWholePlan: boolean;
}

/** Compare ISO date strings safely (lexicographic works for YYYY-MM-DD). */
function isOnOrBefore(date: string, asOf: string): boolean {
  return date <= asOf;
}

export function computeOutstanding(
  schedule: ScheduleRow[],
  payments: PaymentRow[],
  asOf: string,
  totalCost: bigint,
): OutstandingResult {
  const dueTillDate = schedule.reduce(
    (sum, row) => (isOnOrBefore(row.dueDate, asOf) ? sum + row.amount : sum),
    0n,
  );

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0n);

  const outstanding = dueTillDate - totalPaid;
  const balancePropertyValue = totalCost - totalPaid;

  const isAdvance = outstanding < 0n;

  return {
    dueTillDate,
    totalPaid,
    outstanding,
    balancePropertyValue,
    isAdvance,
    advanceAmount: isAdvance ? -outstanding : 0n,
    overpaidWholePlan: totalPaid > totalCost,
  };
}
