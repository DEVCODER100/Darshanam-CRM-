import Link from "next/link";
import { getCurrentUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { Forbidden } from "@/components/ReportForbidden";
import { ReportFilterBar } from "@/components/ReportFilterBar";
import { formatINR } from "@/lib/money";
import { formatReportDate } from "@/lib/statement";
import { activeCount, parseReceivedFilters, resolvePeriod, type Params } from "@/lib/report-filters";
import { getReceivedReport } from "@/lib/statement-data";

export const dynamic = "force-dynamic";

export default async function ReceivedReportPage({ searchParams }: { searchParams: Params }) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "report:view")) return <Forbidden />;

  const period = resolvePeriod(searchParams);
  const filters = parseReceivedFilters(searchParams);
  const report = await getReceivedReport(period, filters, {
    canSeePan: can(user.role, "sensitive:view"),
  });
  const t = report.totals;
  const missingPan = report.rows.filter((r) => r.panMissing).length;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/reports" className="text-sm text-brass-dark hover:underline">← All reports</Link>
        <h1 className="mt-2 text-2xl font-medium">Payment received</h1>
        <p className="text-sm text-muted">Money received in the period, split into basic, GST and other charges.</p>
      </div>

      <ReportFilterBar
        kind="received"
        sp={searchParams}
        period={period}
        shown={report.rows.length}
        total={report.unfilteredCount}
        active={activeCount(filters)}
        options={{ banks: report.options.banks }}
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Basic received" value={formatINR(t.basic, { paise2dp: false })} />
        <Stat label="CGST received" value={formatINR(t.cgst, { paise2dp: false })} />
        <Stat label="SGST received" value={formatINR(t.sgst, { paise2dp: false })} />
        <Stat label="Other charges" value={formatINR(t.maintenance, { paise2dp: false })} />
        <Stat label="Document charges" value={formatINR(t.documentation, { paise2dp: false })} />
        <Stat label="Total received" value={formatINR(t.total, { paise2dp: false })} tone="paid" />
      </section>
      {missingPan > 0 ? (
        <p className="text-sm text-danger">
          {missingPan} payment{missingPan === 1 ? "" : "s"} below {missingPan === 1 ? "has" : "have"} no PAN on file.
        </p>
      ) : null}

      {report.rows.length === 0 ? (
        <p className="text-sm text-muted">
          {report.unfilteredCount > 0
            ? "No payments match these filters."
            : "No payments were received in this period."}
        </p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="data-table min-w-[1500px]">
            <thead>
              <tr>
                <th>No.</th><th>Date</th><th>Unit</th><th>Client</th><th>PAN</th><th>Mobile</th>
                <th>Payment no.</th><th>Receipt / ref.</th><th>Payment type</th><th>From</th>
                <th>Mode</th><th>Instrument date</th><th>Bank</th>
                <th className="text-right">Basic</th><th className="text-right">CGST</th>
                <th className="text-right">SGST</th><th className="text-right">Other</th>
                <th className="text-right">Doc</th><th className="text-right">Total</th><th>Payment for</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((r) => (
                <tr key={`${r.no}-${r.paymentId}`}>
                  <td>{r.no}</td>
                  <td className="whitespace-nowrap">{formatReportDate(r.date)}</td>
                  <td>
                    <Link href={`/bookings/${r.bookingId}`} className="text-brass-dark hover:underline">{r.unit}</Link>
                  </td>
                  <td>{r.customer}</td>
                  <td className="whitespace-nowrap font-mono text-xs">
                    {r.panMissing ? <span className="pill-due">PAN missing</span> : r.pan}
                  </td>
                  <td className="whitespace-nowrap text-muted">{r.mobile}</td>
                  <td className="whitespace-nowrap font-mono text-xs text-muted">{r.paymentNumber}</td>
                  <td className="text-muted">{r.receiptNo}</td>
                  <td className="whitespace-nowrap">{r.paymentType}</td>
                  <td>{r.paidBy}</td>
                  <td className="whitespace-nowrap">{r.mode}</td>
                  <td className="whitespace-nowrap text-muted">
                    {r.instrumentDate ? formatReportDate(r.instrumentDate) : "—"}
                  </td>
                  <td className="text-muted">{r.bank || "—"}</td>
                  <td className="money text-right">{formatINR(r.basic)}</td>
                  <td className="money text-right text-muted">{formatINR(r.cgst)}</td>
                  <td className="money text-right text-muted">{formatINR(r.sgst)}</td>
                  <td className="money text-right text-muted">{formatINR(r.maintenance)}</td>
                  <td className="money text-right text-muted">{formatINR(r.documentation)}</td>
                  <td className="money text-right font-medium text-paid">{formatINR(r.total)}</td>
                  <td className="text-muted">{r.paymentFor}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-hairline bg-canvas font-medium">
                <td colSpan={13}>Total</td>
                <td className="money text-right">{formatINR(t.basic)}</td>
                <td className="money text-right">{formatINR(t.cgst)}</td>
                <td className="money text-right">{formatINR(t.sgst)}</td>
                <td className="money text-right">{formatINR(t.maintenance)}</td>
                <td className="money text-right">{formatINR(t.documentation)}</td>
                <td className="money text-right">{formatINR(t.total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "paid" }) {
  return (
    <div className="card p-4">
      <p className="text-xs tracking-wide text-muted">{label}</p>
      <p className={`money mt-1 text-xl font-medium ${tone === "paid" ? "text-paid" : "text-ink"}`}>{value}</p>
    </div>
  );
}
