/**
 * stage-tracking.ts — stage-wise bank disbursement data (DB).
 * Lists ONLY stage-payment bookings and rolls up the dashboard metrics.
 */
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, customers, propertyCosts, payments } from "@/db/schema";
import { stageDisbursement } from "./stage-ladder";
import { stageLabel } from "./stage";
import type { ConstructionStage } from "./stage";

export interface StageTrackRow {
  bookingId: string;
  customerName: string;
  mobile: string;
  propertyType: string;
  propertyNumber: string | null;
  unit: string;
  totalCost: bigint;
  currentStage: ConstructionStage | null;
  stageLabel: string;
  currentPercentBps: number;
  eligible: bigint;
  received: bigint;
  pendingRelease: bigint; // amount to take / due
  remaining: bigint; // amount left
  fullyPaid: boolean; // due == 0
}

export interface StageMetrics {
  customers: number;
  eligible: bigint;
  pendingRelease: bigint;
  released: bigint;
  remaining: bigint;
}

async function loadStageRows() {
  const [bookingRows, costRows, paidRows] = await Promise.all([
    db
      .select({
        id: bookings.id,
        propertyType: bookings.propertyType,
        propertyNumber: bookings.propertyNumber,
        currentStage: bookings.currentStage,
        customerName: customers.fullName,
        mobile: customers.mobile,
      })
      .from(bookings)
      .innerJoin(customers, eq(bookings.customerId, customers.id))
      .where(eq(bookings.stageBased, true)),
    db.select().from(propertyCosts),
    db
      .select({
        bookingId: payments.bookingId,
        paid: sql<string>`coalesce(sum(${payments.amount}),0)`,
      })
      .from(payments)
      .groupBy(payments.bookingId),
  ]);

  const costMap = new Map(costRows.map((c) => [c.bookingId, c]));
  const paidMap = new Map(paidRows.map((p) => [p.bookingId, BigInt(p.paid)]));
  return { bookingRows, costMap, paidMap };
}

export async function getStageDisbursementList(): Promise<StageTrackRow[]> {
  const { bookingRows, costMap, paidMap } = await loadStageRows();

  return bookingRows.map((b) => {
    const totalCost = costMap.get(b.id)?.totalCost ?? 0n;
    const received = paidMap.get(b.id) ?? 0n;
    const d = stageDisbursement(totalCost, b.currentStage, received);
    return {
      bookingId: b.id,
      customerName: b.customerName,
      mobile: b.mobile,
      propertyType: b.propertyType,
      propertyNumber: b.propertyNumber,
      unit: `${b.propertyType}${b.propertyNumber ? " " + b.propertyNumber : ""}`,
      totalCost,
      currentStage: b.currentStage,
      stageLabel: stageLabel(b.currentStage),
      currentPercentBps: d.currentPercentBps,
      eligible: d.eligible,
      received,
      pendingRelease: d.pendingRelease,
      remaining: d.remaining,
      fullyPaid: d.fullyPaid,
    };
  });
}

export async function getStageMetrics(): Promise<StageMetrics> {
  const { bookingRows, costMap, paidMap } = await loadStageRows();

  let eligible = 0n;
  let pendingRelease = 0n;
  let released = 0n;
  let remaining = 0n;
  for (const b of bookingRows) {
    const totalCost = costMap.get(b.id)?.totalCost ?? 0n;
    const received = paidMap.get(b.id) ?? 0n;
    const d = stageDisbursement(totalCost, b.currentStage, received);
    eligible += d.eligible;
    pendingRelease += d.pendingRelease;
    released += received;
    remaining += d.remaining;
  }
  return {
    customers: bookingRows.length,
    eligible,
    pendingRelease,
    released,
    remaining,
  };
}
