/**
 * cost.ts — property cost auto-calculation (PRD §6).
 *
 * All inputs/outputs are bigint paise; percents are integer basis points.
 * Fields below `totalCost` are read-only OUTPUTS derived from the inputs:
 *
 *   gstAmount           = baseCost × gstPercent
 *   documentationAmount = baseCost × documentationPercent
 *   totalCost           = baseCost + gstAmount + maintenanceCharge + documentationAmount
 */
import { applyBasisPoints } from "./money";

export interface CostInputs {
  baseCost: bigint; // paise
  extraCharges?: bigint;
  discount?: bigint;
  gstPercentBps: number; // basis points, e.g. 500 = 5%
  maintenanceCharge: bigint; // paise
  documentationPercentBps: number; // basis points, e.g. 590 = 5.9%
}

export interface CostBreakdown extends CostInputs {
  extraCharges: bigint;
  discount: bigint;
  agreementValue: bigint;
  gstAmount: bigint;
  documentationAmount: bigint;
  totalCost: bigint;
}

export function computeCost(inputs: CostInputs): CostBreakdown {
  const {
    baseCost,
    extraCharges = 0n,
    discount = 0n,
    gstPercentBps,
    maintenanceCharge,
    documentationPercentBps,
  } = inputs;

  if (
    baseCost < 0n ||
    extraCharges < 0n ||
    discount < 0n ||
    maintenanceCharge < 0n
  ) {
    throw new Error("computeCost: amounts must be non-negative");
  }
  if (gstPercentBps < 0 || documentationPercentBps < 0) {
    throw new Error("computeCost: percentages must be non-negative");
  }

  const agreementValue = baseCost + extraCharges - discount;
  if (agreementValue < 0n) {
    throw new Error("computeCost: discount cannot exceed base plus extras");
  }
  const gstAmount = applyBasisPoints(baseCost, BigInt(gstPercentBps));
  const documentationAmount = applyBasisPoints(
    baseCost,
    BigInt(documentationPercentBps),
  );
  const totalCost =
    agreementValue + gstAmount + maintenanceCharge + documentationAmount;

  return {
    baseCost,
    extraCharges,
    discount,
    agreementValue,
    gstPercentBps,
    maintenanceCharge,
    documentationPercentBps,
    gstAmount,
    documentationAmount,
    totalCost,
  };
}
