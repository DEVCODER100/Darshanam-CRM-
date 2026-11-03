import Link from "next/link";
import { formatReportDate, shiftMonth } from "@/lib/statement";
import {
  ACCOUNT_STATUS_LABELS,
  AGE_BANDS,
  PAYMENT_TYPE_LABELS,
  type Params,
  type Period,
} from "@/lib/report-filters";
import { MODE_LABELS } from "@/lib/statement-data";

/** Rebuild a query string from the current URL params, with overrides. */
function queryString(sp: Params, override: Record<string, string | null> = {}): string {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val) out.set(k, val);
  }
  for (const [k, v] of Object.entries(override)) {
    if (v === null) out.delete(k);
    else out.set(k, v);
  }
  return out.toString();
}

type Kind = "received" | "due";

/**
 * Period picker, filters and download buttons for the Received / Due reports.
 * A plain GET form, so it works without JavaScript; the downloads carry the
 * same query string, so the file always matches what is on screen.
 */
export function ReportFilterBar({
  kind,
  sp,
  period,
  shown,
  total,
  active,
  options,
}: {
  kind: Kind;
  sp: Params;
  period: Period;
  shown: number;
  total: number;
  active: number;
  options: { banks?: string[]; milestones?: string[]; loanBanks?: string[] };
}) {
  const basePath = `/reports/${kind}`;
  const val = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };
  const dl = (format: string) =>
    `/api/statements/${kind}/export?${queryString(sp, { format })}`;
  const month = period.month;

  return (
    <div className="card space-y-3 p-3">
      <div className="flex flex-wrap items-center gap-3">
        {month ? (
          <>
            <Link
              href={`${basePath}?${queryString(sp, { month: shiftMonth(month, -1), from: null, to: null })}`}
              className="btn-secondary px-3 py-1.5"
            >
              ← Prev
            </Link>
            <Link
              href={`${basePath}?${queryString(sp, { month: shiftMonth(month, 1), from: null, to: null })}`}
              className="btn-secondary px-3 py-1.5"
            >
              Next →
            </Link>
          </>
        ) : null}
        <span className="text-sm text-muted">
          {formatReportDate(period.from)} to {formatReportDate(period.to)}
        </span>
        <span className="ml-auto flex gap-2">
          <a href={dl("xlsx")} className="btn-primary px-3 py-1.5">Excel</a>
          <a href={dl("csv")} className="btn-secondary px-3 py-1.5">CSV</a>
          <a href={dl("pdf")} className="btn-secondary px-3 py-1.5">PDF</a>
        </span>
      </div>

      <form method="get" className="space-y-3 border-t border-hairline pt-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Month">
            <input
              type="month"
              name="month"
              defaultValue={month ?? ""}
              className="field"
            />
          </Field>
          <Field label="Or from date">
            <input type="date" name="from" defaultValue={month ? "" : period.from} className="field" />
          </Field>
          <Field label="To date">
            <input type="date" name="to" defaultValue={month ? "" : period.to} className="field" />
          </Field>
          <Field label="Search (client, mobile, unit, ID, exact PAN)">
            <input name="q" defaultValue={val("q")} placeholder="e.g. Maulik, A 803, ABCDE1234F" className="field" />
          </Field>

          <Field label="Payment type">
            <Select name="ptype" value={val("ptype")} options={PAYMENT_TYPE_LABELS} />
          </Field>
          <Field label="Account status">
            <Select name="status" value={val("status")} options={ACCOUNT_STATUS_LABELS} />
          </Field>
          <Field label="Unit type">
            <Select
              name="utype"
              value={val("utype")}
              options={Object.fromEntries(["Villa", "Bungalow", "Apartment", "Flat", "Shop", "Plot"].map((t) => [t, t]))}
            />
          </Field>
          <Field label="PAN">
            <Select name="pan" value={val("pan")} options={{ missing: "PAN missing" }} all="All" />
          </Field>
          <Field label="Amount between (Rs)">
            <span className="flex items-center gap-2">
              <input name="min" defaultValue={val("min")} inputMode="decimal" placeholder="min" className="field" />
              <input name="max" defaultValue={val("max")} inputMode="decimal" placeholder="max" className="field" />
            </span>
          </Field>

          {kind === "received" ? (
            <>
              <Field label="Payment mode">
                <Select name="mode" value={val("mode")} options={MODE_LABELS} />
              </Field>
              <Field label="Paid by">
                <Select name="by" value={val("by")} options={{ client: "Client", bank: "Bank (loan)" }} />
              </Field>
              <Field label="Bank on instrument">
                <input name="bank" list="rf-banks" defaultValue={val("bank")} placeholder="HDFC, ICICI…" className="field" />
                <datalist id="rf-banks">
                  {(options.banks ?? []).map((b) => <option key={b} value={b} />)}
                </datalist>
              </Field>
              <Field label="Payment for contains">
                <input name="for" defaultValue={val("for")} placeholder="Plinth, Slab…" className="field" />
              </Field>
              <Field label="GST only">
                <Select name="gst" value={val("gst")} options={{ only: "GST-only receipts" }} all="All" />
              </Field>
            </>
          ) : (
            <>
              <Field label="Milestone / instalment">
                <input name="ms" list="rf-ms" defaultValue={val("ms")} placeholder="Plinth, Plaster, Slab…" className="field" />
                <datalist id="rf-ms">
                  {(options.milestones ?? []).map((m) => <option key={m} value={m} />)}
                </datalist>
              </Field>
              <Field label="Overdue or projected">
                <Select name="when" value={val("when")} options={{ overdue: "Overdue", projected: "Projected" }} all="Both" />
              </Field>
              <Field label="Days overdue">
                <Select
                  name="age"
                  value={val("age")}
                  options={Object.fromEntries(AGE_BANDS.map((a) => [a, `${a} days`]))}
                />
              </Field>
              <Field label="Overdue at least (days)">
                <input name="days" defaultValue={val("days")} inputMode="numeric" placeholder="e.g. 30" className="field" />
              </Field>
              <Field label="Loan bank">
                <input name="lbank" list="rf-lbanks" defaultValue={val("lbank")} placeholder="SBI, HDFC…" className="field" />
                <datalist id="rf-lbanks">
                  {(options.loanBanks ?? []).map((b) => <option key={b} value={b} />)}
                </datalist>
              </Field>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-primary px-4 py-1.5">Apply filters</button>
          {active > 0 || !month ? (
            <Link href={`${basePath}?month=${month ?? period.from.slice(0, 7)}`} className="text-sm text-brass-dark hover:underline">
              Clear filters
            </Link>
          ) : null}
          <span className="text-sm text-muted">
            Showing {shown} of {total}
            {active > 0 ? ` · ${active} filter${active === 1 ? "" : "s"} on` : ""}
          </span>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-muted">{label}</span>
      {children}
    </label>
  );
}

function Select({
  name,
  value,
  options,
  all = "Any",
}: {
  name: string;
  value: string;
  options: Record<string, string>;
  all?: string;
}) {
  return (
    <select name={name} defaultValue={value} className="field">
      <option value="">{all}</option>
      {Object.entries(options).map(([k, label]) => (
        <option key={k} value={k}>{label}</option>
      ))}
    </select>
  );
}
