/**
 * allocation.ts — derives how the money received so far covers each cost
 * component, so the UI can flag e.g. "GST: pending" (PRD §6 cost parts).
 *
 * Payments are NOT earmarked in the data (outstanding stays a single ledger,
 * PRD §5). This is a *display* allocation: total paid is applied to the
 * components in a fixed waterfall order — Base → GST → Maintenance →
 * Documentation. A component is Paid only once everything before it is covered,
 * so a part-payment against the base correctly leaves GST "pending".
 *
 * All amounts are bigint paise.
 */
export type CoverageStatus = "paid" | "partial" | "pending" | "na";

export interface ComponentCoverage {
  key: "base" | "gst" | "maintenance" | "documentation";
  label: string;
  amount: bigint;
  covered: bigint;
  status: CoverageStatus;
}

export interface CostComponents {
  baseCost: bigint;
  gstAmount: bigint;
  maintenanceCharge: bigint;
  documentationAmount: bigint;
}

const ORDER: { key: ComponentCoverage["key"]; label: string; field: keyof CostComponents }[] = [
  { key: "base", label: "Base cost", field: "baseCost" },
  { key: "gst", label: "GST", field: "gstAmount" },
  { key: "maintenance", label: "Maintenance", field: "maintenanceCharge" },
  { key: "documentation", label: "Documentation", field: "documentationAmount" },
];

export function allocatePayments(
  cost: CostComponents,
  totalPaid: bigint,
): ComponentCoverage[] {
  let remaining = totalPaid > 0n ? totalPaid : 0n;

  return ORDER.map(({ key, label, field }) => {
    const amount = cost[field];
    if (amount <= 0n) {
      return { key, label, amount, covered: 0n, status: "na" as CoverageStatus };
    }
    const covered = remaining >= amount ? amount : remaining;
    remaining -= covered;
    const status: CoverageStatus =
      covered >= amount ? "paid" : covered > 0n ? "partial" : "pending";
    return { key, label, amount, covered, status };
  });
}
