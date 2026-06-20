/**
 * gst-calc.ts — pure GST math (no DB), so it is unit-testable in isolation.
 *
 * GST owed is proportional to the BASIC amount actually collected:
 *   GST due on collection = rate × basic collected
 *   GST shortfall         = max(due − GST collected, 0)   (additional payable now)
 *   GST excess            = max(GST collected − due, 0)
 * Example: basic ₹60L, GST paid ₹2L, rate 5% → due ₹3L, shortfall ₹1L.
 */
import { applyBasisPoints } from "./money";

export interface GstStatus {
  basicCollected: bigint;
  gstCollected: bigint;
  gstDueOnCollection: bigint;
  gstShortfall: bigint;
  gstExcess: bigint;
}

export function computeGstStatus(params: {
  gstRateBps: number;
  basicCollected: bigint;
  gstCollected: bigint;
}): GstStatus {
  const { gstRateBps, basicCollected, gstCollected } = params;
  const gstDueOnCollection = applyBasisPoints(basicCollected, BigInt(gstRateBps));
  const gstShortfall =
    gstDueOnCollection > gstCollected ? gstDueOnCollection - gstCollected : 0n;
  const gstExcess =
    gstCollected > gstDueOnCollection ? gstCollected - gstDueOnCollection : 0n;
  return {
    basicCollected,
    gstCollected,
    gstDueOnCollection,
    gstShortfall,
    gstExcess,
  };
}
