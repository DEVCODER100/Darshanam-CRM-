import Link from "next/link";
import { getCurrentUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { Forbidden } from "@/components/ReportForbidden";
import { MonthBar } from "@/components/MonthBar";
import { todayISO } from "@/lib/booking-detail";
import { formatINR } from "@/lib/money";
import { formatReportDate, isMonth } from "@/lib/statement";
import { getDueReport } from "@/lib/statement-data";

export const dynamic = "force-dynamic";

export default async function DueReportPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "report:view")) return <Forbidden />;

  const month = isMonth(searchParams.month) ? searchParams.month : todayISO().slice(0, 7);
  const report = await getDueReport(month);
  const t = report.totals;
  const overdue = report.rows.filter((r) => !r.projected);
  const projected = report.rows.filter((r) => r.projected);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/reports" className="text-sm text-brass-dark hover:underline">← All reports</Link>
        <h1 className="mt-2 text-2xl font-medium">Payment due</h1>
        <p className="text-sm text-muted">
          Unpaid instalments falling due in the month, as of {formatReportDate(report.asOf)}.
          Projected dues (not yet due) are highlighted.
        </p>
      </div>

      <MonthBar basePath="/reports/due" month={month} exportType="due" />

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
        <p className="text-sm text-muted">Nothing is due in this month.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="data-table min-w-[1150px]">
            <thead>
              <tr>
                <th>No.</th><th>Due date</th><th>Unit</th><th>Client</th><th>Mobile</th>
                <th>Payment type</th><th>Instalment</th><th className="text-right">%</th>
                <th className="text-right">Installment</th><th className="text-right">CGST</th>
                <th className="text-right">SGST</th><th className="text-right">Other</th>
                <th className="text-right">Doc</th>
                <th className="text-right">Total due</th><th className="text-right">Days</th>
                <th>Loan bank</th>
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
                  <td className="text-muted">{r.loanBank}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-hairline bg-canvas font-medium">
                <td colSpan={8}>Total</td>
                <td className="money text-right">{formatINR(t.basic)}</td>
                <td className="money text-right">{formatINR(t.cgst)}</td>
                <td className="money text-right">{formatINR(t.sgst)}</td>
                <td className="money text-right">{formatINR(t.other)}</td>
                <td className="money text-right">{formatINR(t.doc)}</td>
                <td className="money text-right">{formatINR(t.total)}</td>
                <td colSpan={2} />
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
