import Link from "next/link";
import { ACCOUNT_STATUS_LABELS } from "@/lib/report-filters";
import { CONSTRUCTION_STAGES, PAYMENT_TYPES } from "@/lib/stage";
import { STATUSES } from "@/lib/unit-style";
import type { UnitFilters } from "@/lib/unit-filters";

/**
 * The big filter above the unit board: unit, payment, client and loan filters in one
 * plain GET form (works without JavaScript; the URL holds the search).
 */
export function UnitFilterPanel({
  values,
  active,
  found,
  total,
  options,
  keep,
  resetHref,
  downloadHref,
}: {
  values: Record<string, string>; // current URL params
  active: number;
  found: number;
  total: number;
  options: { types: string[]; subTypes: string[]; banks: string[]; bookedBy: string[]; floors: string[] };
  keep: Record<string, string | undefined>; // params carried along (view, map)
  resetHref: string;
  downloadHref: string;
}) {
  const v = (k: string) => values[k] ?? "";
  const select = (name: string, entries: [string, string][], any = "Any") => (
    <select name={name} defaultValue={v(name)} className="field">
      <option value="">{any}</option>
      {entries.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
    </select>
  );
  const list = (xs: string[]) => xs.map((x): [string, string] => [x, x]);
  const field = (label: string, node: React.ReactNode) => (
    <label className="block space-y-1">
      <span className="text-xs text-muted">{label}</span>
      {node}
    </label>
  );
  const text = (name: string, placeholder = "") => (
    <input name={name} defaultValue={v(name)} placeholder={placeholder} className="field" />
  );

  return (
    <details open={active > 0} className="card p-3">
      <summary className="cursor-pointer text-sm font-medium">
        Filter units{active > 0 && <span className="ml-2 pill-neutral">{active} on</span>}
        <span className="ml-3 font-normal text-muted">
          {found === total ? `${total} units` : `${found} of ${total} units found`}
        </span>
      </summary>
      <form method="get" className="mt-3 space-y-3">
        {Object.entries(keep).map(([k, val]) => val && <input key={k} type="hidden" name={k} value={val} />)}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {field("Unit type", select("type", list(options.types)))}
          {field("Sub type", select("sub", list(options.subTypes)))}
          {field("Segment", select("seg", list(["Residential", "Commercial"])))}
          {field("Floor", select("floor", list(options.floors)))}
          {field("Unit name / owner", text("q", "e.g. B-3 or Patel"))}
          {field("Booking ID", text("bid", "e.g. BI012"))}
          {field("Unit status", select("status", STATUSES.map((s): [string, string] => [s.key, s.label])))}
          {field("Account status", select("acct", Object.entries(ACCOUNT_STATUS_LABELS)))}
          {field("Payment method", select("pay", Object.entries(PAYMENT_TYPES)))}
          {field("Payment scheme", select("scheme", [["stage", "Stage-based"], ["schedule", "Schedule-based"]]))}
          {field("Construction stage", select("stage", CONSTRUCTION_STAGES.map((s): [string, string] => [s.value, s.label])))}
          {field("Booked by", select("by", list(options.bookedBy)))}
          {field("Client (name, mobile, ID or PAN)", text("client"))}
          {field("Bank loan", select("loan", [["yes", "Yes"], ["no", "No"]]))}
          {field("Bank", select("bank", list(options.banks)))}
          {field("Agreement signed", select("agr", [["yes", "Yes"], ["no", "No"]]))}
          {field("Price between (Rs)", <span className="flex gap-2">{text("pmin", "min")}{text("pmax", "max")}</span>)}
          {field("Area between (sq ft)", <span className="flex gap-2">{text("amin", "min")}{text("amax", "max")}</span>)}
          {field("Booked from", <input type="date" name="bfrom" defaultValue={v("bfrom")} className="field" />)}
          {field("Booked to", <input type="date" name="bto" defaultValue={v("bto")} className="field" />)}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-primary px-4 py-1.5">Search</button>
          <Link href={resetHref} className="btn-secondary px-4 py-1.5">Reset</Link>
          <a href={downloadHref} className="btn-secondary px-4 py-1.5">Download Excel</a>
          <span className="text-sm text-muted">{found} unit{found === 1 ? "" : "s"} found</span>
        </div>
      </form>
    </details>
  );
}
