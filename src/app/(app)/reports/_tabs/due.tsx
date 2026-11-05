import Link from "next/link";
import { getCurrentUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { Forbidden } from "@/components/ReportForbidden";
import { ReportFilterBar } from "@/components/ReportFilterBar";
import { formatINR } from "@/lib/money";
import { formatReportDate } from "@/lib/statement";
import { activeCount, parseDueFilters, resolvePeriod, type Params } from "@/lib/report-filters";
import { getDueReport } from "@/lib/statement-data";

export const dynamic = "force-dynamic";

export default async function DueReport({ searchParams }: { searchParams: Params }) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "report:view")) return <Forbidden />;

  const period = resolvePeriod(searchParams);
  const filters = parseDueFilters(searchParams);
  const report = await getDueReport(period, filters, {
    canSeePan: can(user.role, "sensitive:view"),
  });
  const t = report.totals;
  const overdue = report.rows.filter((r) => !r.projected);
  const projected = report.rows.filter((r) => r.projected);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-medium">Payment due</h1>
        <p className="text-sm text-muted">
          Unpaid instalments falling due in the period, as of {formatReportDate(report.asOf)}.
          Projected dues (not yet due) are highlighted.
        </p>
      </div>

      <ReportFilterBar
        kind="due"
        sp={searchParams}
        period={period}
        shown={report.rows.length}
        total={report.unfilteredCount}
        active={activeCount(filters)}
        options={{ milestones: report.options.milestones, loanBanks: report.options.loanBanks }}
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Installment due" value={formatINR(t.basic, { paise2dp: false })} />
        <Stat label="CGST due" value={formatINR(t.cgst, { paise2dp: false })} />
        <Stat label="SGST due" value={formatINR(t.sgst, { paise2dp: false })} />
        <Stat label="Other charges due" value={formatINR(t.other, { paise2dp: false })} />
        <Stat label="Document charges due" value={formatINR(t.doc, { paise2dp: false })} />
        <Stat label="Total due" value={formatINR(t.total, { paise2dp: false })} tone="due" />
      </section>
      <p className="text-sm text-muted">
        {overdue.length} overdue · {projected.length} projected
      </p>

      {report.rows.length === 0 ? (
        <p className="text-sm text-muted">
          {report.unfilteredCount > 0 ? "No dues match these filters." : "Nothing is due in this period."}
        </p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="data-table min-w-[1400px]">
            <thead>
              <tr>
                <th>No.</th><th>Due date</th><th>Unit</th><th>Client</th><th>PAN</th><th>Mobile</th>
                <th>Payment type</th><th>Instalment</th><th className="text-right">%</th>
                <th className="text-right">Installment</th><th className="text-right">CGST</th>
                <th className="text-right">SGST</th><th className="text-right">Other</th>
                <th className="text-right">Doc</th>
                <th className="text-right">Total due</th><th className="text-right">Days</th>
                <th>Loan bank</th><th>Branch</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((r) => (
                <tr key={`${r.no}-${r.bookingId}`} className={r.projected ? "bg-yellow-50" : ""}>
                  <td>{r.no}</td>
                  <td className="whitespace-nowrap">{formatReportDate(r.dueDate)}</td>
                  <td>
                    <Link href={`/bookings/${r.bookingId}`} className="text-brass-dark hover:underline">{r.unit}</Link>
                  </td>
                  <td>{r.customer}</td>
                  <td className="whitespace-nowrap font-mono text-xs">
                    {r.panMissing ? <span className="pill-due">PAN missing</span> : r.pan}
                  </td>
                  <td className="whitespace-nowrap text-muted">{r.mobile}</td>
                  <td className="whitespace-nowrap">{r.paymentType}</td>
                  <td>{r.instalment}</td>
                  <td className="text-right text-muted">{r.percentage ?? "—"}</td>
                  <td className="money text-right">{formatINR(r.basic)}</td>
                  <td className="money text-right text-muted">{formatINR(r.cgst)}</td>
                  <td className="money text-right text-muted">{formatINR(r.sgst)}</td>
                  <td className="money text-right text-muted">{formatINR(r.other)}</td>
                  <td className="money text-right text-muted">{formatINR(r.doc)}</td>
                  <td className="money text-right font-medium text-due">{formatINR(r.total)}</td>
                  <td className="text-right">{r.projected ? "—" : r.daysOverdue}</td>
                  <td className="text-muted">{r.loanBank || "—"}</td>
                  <td className="text-muted">{r.loanBranch || "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-hairline bg-canvas font-medium">
                <td colSpan={9}>Total</td>
                <td className="money text-right">{formatINR(t.basic)}</td>
                <td className="money text-right">{formatINR(t.cgst)}</td>
                <td className="money text-right">{formatINR(t.sgst)}</td>
                <td className="money text-right">{formatINR(t.other)}</td>
                <td className="money text-right">{formatINR(t.doc)}</td>
                <td className="money text-right">{formatINR(t.total)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "due" }) {
  return (
    <div className="card p-4">
      <p className="text-xs tracking-wide text-muted">{label}</p>
      <p className={`money mt-1 text-xl font-medium ${tone === "due" ? "text-due" : "text-ink"}`}>{value}</p>
    </div>
  );
}
