/** The filtered-units table, shared by the Dashboard download and the Unit report tab. */
import { ACCOUNT_STATUS_LABELS, panQueryHash, type Params } from "./report-filters";
import { hashPan } from "./pan";
import { PAYMENT_TYPES, stageLabel } from "./stage";
import { getBoard } from "./unit-board";
import { matchesUnit, parseUnitFilters, segmentOf } from "./unit-filters";
import type { Cell, ExportTable } from "./export-types";

export async function unitTable(sp: Params, label: string): Promise<ExportTable> {
  const filters = parseUnitFilters(sp);
  let clientPanHash: string | null = null;
  try {
    clientPanHash = panQueryHash(filters.client, hashPan);
  } catch {} // no encryption key: PAN search simply finds nothing
  const units = (await getBoard()).units.filter((u) => matchesUnit(u, filters, { clientPanHash }));
  const dash = "—";
  return {
    title: `Units — ${label} (${units.length} found)`,
    landscape: true,
    columns: [
      { header: "Unit" }, { header: "Type" }, { header: "Sub type" }, { header: "Segment" }, { header: "Floor" },
      { header: "Area (sq ft)", align: "right" }, { header: "Status" }, { header: "Owner" }, { header: "Mobile" },
      { header: "Booking ID" }, { header: "Payment method" }, { header: "Scheme" }, { header: "Stage" },
      { header: "Total cost (Rs)", money: true }, { header: "Account status" }, { header: "Loan bank" },
      { header: "Booked by" }, { header: "Agreement signed" },
    ],
    rows: units.map((u): Cell[] => {
      const b = u.booking;
      return [
        u.name, u.unitType, u.subType ?? dash, segmentOf(u.unitType), u.floor ?? dash,
        u.areaSqft ? Number(u.areaSqft) : dash, u.status, u.owner ?? dash, b?.mobile ?? dash,
        b?.code ?? dash, b ? PAYMENT_TYPES[b.paymentType] : dash, b ? (b.stageBased ? "Stage-based" : "Schedule-based") : dash,
        b?.stage ? stageLabel(b.stage) : dash, b?.totalCost ?? "", b ? ACCOUNT_STATUS_LABELS[b.accountStatus] : dash,
        b?.loanBank ?? dash, b?.bookedBy ?? dash, b ? (b.hasAgreement ? "Yes" : "No") : dash,
      ];
    }),
  };
}

/** The dropdown choices of the unit filter, taken from the units on screen. */
export function filterOptions(units: Awaited<ReturnType<typeof getBoard>>["units"], types: string[]) {
  const distinct = (xs: (string | null | undefined)[]) =>
    [...new Set(xs.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return {
    types,
    subTypes: distinct(units.map((u) => u.subType)),
    banks: distinct(units.map((u) => u.booking?.loanBank)),
    bookedBy: distinct(units.map((u) => u.booking?.bookedBy)),
    floors: distinct(units.map((u) => u.floor)),
  };
}
