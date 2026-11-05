/**
 * report-hub.ts — the Reports section's tab list, and one function that builds the
 * table behind any tab. The page and the downloads both call loadTable, so a
 * download always equals what is on screen.
 */
import type { Capability } from "./permissions";
import type { ExportTable } from "./export-types";
import { getReportTable } from "./reports";
import { clientLedgerTable, monthlySalesTable, staffActivityTable, staffSalesTable } from "./report-sales";
import { resolvePeriod, type Params } from "./report-filters";
import { agentBrokerageReport, agentReportTable } from "./report-agents";
import { unitTable } from "./unit-table";
import { getActiveProject } from "./project-scope";

export interface Tab {
  key: string;
  label: string;
  row: 1 | 2;
  /** Drawn by its own screen (own filters and totals) rather than the generic table. */
  custom?: boolean;
  /** Shows the From / To date range. */
  period?: boolean;
  capability?: Capability;
}

export const TABS: Tab[] = [
  { key: "received", label: "Payment Received", row: 1, custom: true, period: true },
  { key: "due", label: "Payment Due", row: 1, custom: true, period: true },
  { key: "unit", label: "Unit Report", row: 1 },
  { key: "outstanding", label: "O/S Summary", row: 1, period: true },
  { key: "customer", label: "Client Report", row: 1, period: true },
  { key: "ledger", label: "Client Ledger", row: 1, period: true },
  { key: "sales", label: "Monthly Sales", row: 1, period: true },
  { key: "staff", label: "Sales-person Report", row: 2, period: true },
  { key: "activity", label: "Staff Activity", row: 2, period: true, capability: "audit:view" },
  { key: "agent", label: "Agent Report", row: 2, period: true },
  { key: "brokerage", label: "Agent Brokerage", row: 2, period: true },
  { key: "statement", label: "Statement", row: 2, custom: true },
  { key: "gst", label: "GST Tracker", row: 2, custom: true },
  { key: "stage", label: "Stage Collection", row: 2, period: true },
  { key: "loan", label: "Loans", row: 2 },
  { key: "payment", label: "All Payments", row: 2 },
  { key: "monthly", label: "Monthly Collection", row: 2 },
];

export const tabOf = (key: string | undefined) => TABS.find((t) => t.key === key) ?? TABS[0];

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

/** The table behind a generic (non-custom) tab, for the screen and the downloads. */
export async function loadTable(key: string, sp: Params): Promise<ExportTable> {
  const period = resolvePeriod(sp);
  const label = (await getActiveProject())?.label ?? "All projects";
  switch (key) {
    case "unit":
      return unitTable(sp, label);
    case "sales":
      return monthlySalesTable(period);
    case "staff":
      return staffSalesTable(period);
    case "ledger":
      return clientLedgerTable(period, first(sp.client));
    case "activity":
      return staffActivityTable(period);
    case "agent":
      return agentReportTable(period);
    case "brokerage":
      return agentBrokerageReport(period);
    case "outstanding":
    case "customer":
    case "stage":
      return getReportTable(key, period.to); // "as on" the To date
    case "loan":
    case "payment":
    case "monthly":
      return getReportTable(key);
    default:
      throw new Error(`No table for report "${key}"`);
  }
}
