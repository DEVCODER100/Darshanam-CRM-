/**
 * gst.ts — GST tracker (workflow: "GST tracker — due vs collected per unit").
 * Per booking:
 *   GST receivable   = full GST liability (5% × base, stored as cost.gstAmount)
 *   GST on collection = booking GST rate × amount collected so far
 *   GST due          = receivable − on collection (pending GST to collect)
 * All amounts are bigint paise.
 */
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, customers, propertyCosts, payments } from "@/db/schema";
import { computeGstStatus } from "./gst-calc";

export { computeGstStatus } from "./gst-calc";
export type { GstStatus } from "./gst-calc";

export interface GstRow {
  bookingId: string;
  customerName: string;
  booking: string;
  gstPercent: number; // e.g. 5
  gstReceivable: bigint; // full liability (5% × base)
  basicCollected: bigint;
  gstCollected: bigint; // GST actually recorded on payments
  gstDueOnCollection: bigint; // 5% × basic collected
  gstShortfall: bigint; // additional GST payable now
}

export interface GstTracker {
  rows: GstRow[];
  totals: {
    receivable: bigint;
    collected: bigint;
    dueOnCollection: bigint;
    shortfall: bigint;
  };
}

export async function getGstTracker(): Promise<GstTracker> {
  const [bookingRows, costRows, paidRows] = await Promise.all([
    db
      .select({
        id: bookings.id,
        propertyType: bookings.propertyType,
        propertyNumber: bookings.propertyNumber,
        customerName: customers.fullName,
      })
      .from(bookings)
      .innerJoin(customers, eq(bookings.customerId, customers.id)),
    db.select().from(propertyCosts),
    db
      .select({
        bookingId: payments.bookingId,
        total: sql<string>`coalesce(sum(${payments.amount}),0)`,
        gst: sql<string>`coalesce(sum(${payments.gstAmount}),0)`,
      })
      .from(payments)
      .groupBy(payments.bookingId),
  ]);

  const costMap = new Map(costRows.map((c) => [c.bookingId, c]));
  const paidMap = new Map(
    paidRows.map((p) => [p.bookingId, { total: BigInt(p.total), gst: BigInt(p.gst) }]),
  );

  const rows: GstRow[] = [];
  let tReceivable = 0n;
  let tCollected = 0n;
  let tDueOnCollection = 0n;
  let tShortfall = 0n;

  for (const b of bookingRows) {
    const cost = costMap.get(b.id);
    if (!cost || cost.gstPercentBps <= 0) continue;
    const paid = paidMap.get(b.id) ?? { total: 0n, gst: 0n };
    const basicCollected = paid.total - paid.gst;
    const status = computeGstStatus({
      gstRateBps: cost.gstPercentBps,
      basicCollected,
      gstCollected: paid.gst,
    });

    rows.push({
      bookingId: b.id,
      customerName: b.customerName,
      booking: `${b.propertyType}${b.propertyNumber ? " " + b.propertyNumber : ""}`,
      gstPercent: cost.gstPercentBps / 100,
      gstReceivable: cost.gstAmount,
      basicCollected,
      gstCollected: paid.gst,
      gstDueOnCollection: status.gstDueOnCollection,
      gstShortfall: status.gstShortfall,
    });
    tReceivable += cost.gstAmount;
    tCollected += paid.gst;
    tDueOnCollection += status.gstDueOnCollection;
    tShortfall += status.gstShortfall;
  }

  rows.sort((a, b) =>
    b.gstShortfall > a.gstShortfall ? 1 : b.gstShortfall < a.gstShortfall ? -1 : 0,
  );
  return {
    rows,
    totals: {
      receivable: tReceivable,
      collected: tCollected,
      dueOnCollection: tDueOnCollection,
      shortfall: tShortfall,
    },
  };
}
