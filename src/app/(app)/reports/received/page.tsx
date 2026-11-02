import Link from "next/link";
import { getCurrentUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { Forbidden } from "@/components/ReportForbidden";
import { MonthBar } from "@/components/MonthBar";
import { todayISO } from "@/lib/booking-detail";
import { formatINR } from "@/lib/money";
import { formatReportDate, isMonth } from "@/lib/statement";
import { getReceivedReport } from "@/lib/statement-data";

export const dynamic = "force-dynamic";

export default async function ReceivedReportPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "report:view")) return <Forbidden />;

  const month = isMonth(searchParams.month) ? searchParams.month : todayISO().slice(0, 7);
  const report = await getReceivedReport(month);
  const t = report.totals;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/reports" className="text-sm text-brass-dark hover:underline">← All reports</Link>
        <h1 className="mt-2 text-2xl font-medium">Payment received</h1>
        <p className="text-sm text-muted">Money received in the month, split into basic, GST and other charges.</p>
      </div>

      <MonthBar basePath="/reports/received" month={month} exportType="received" />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Basic received" value={formatINR(t.basic, { paise2dp: false })} />
        <Stat label="CGST received" value={formatINR(t.cgst, { paise2dp: false })} />
        <Stat label="SGST received" value={formatINR(t.sgst, { paise2dp: false })} />
        <Stat label="Other charges" value={formatINR(t.maintenance, { paise2dp: false })} />
        <Stat label="Total received" value={formatINR(t.total, { paise2dp: false })} tone="paid" />
      </section>

      {report.rows.length === 0 ? (
        <p className="text-sm text-muted">No payments were received in this month.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="data-table min-w-[1200px]">
            <thead>
              <tr>
                <th>No.</th><th>Date</th><th>Unit</th><th>Client</th><th>Mobile</th>
                <th>Payment type</th><th>From</th><th>Mode</th><th>Reference</th>
                <th className="text-right">Basic</th><th className="text-right">CGST</th>
                <th className="text-right">SGST</th><th className="text-right">Other</th>
                <th className="text-right">Total</th><th>Payment for</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((r) => (
                <tr key={`${r.no}-${r.bookingId}`}>
                  <td>{r.no}</td>
                  <td className="whitespace-nowrap">{formatReportDate(r.date)}</td>
                  <td>
                    <Link href={`/bookings/${r.bookingId}`} className="text-brass-dark hover:underline">{r.unit}</Link>
                  </td>
                  <td>{r.customer}</td>
                  <td className="whitespace-nowrap text-muted">{r.mobile}</td>
                  <td className="whitespace-nowrap">{r.paymentType}</td>
                  <td>{r.paidBy}</td>
                  <td className="whitespace-nowrap">{r.mode}</td>
                  <td className="text-muted">{r.reference}</td>
                  <td className="money text-right">{formatINR(r.basic)}</td>
                  <td className="money text-right text-muted">{formatINR(r.cgst)}</td>
                  <td className="money text-right text-muted">{formatINR(r.sgst)}</td>
                  <td className="money text-right text-muted">{formatINR(r.maintenance)}</td>
                  <td className="money text-right font-medium text-paid">{formatINR(r.total)}</td>
                  <td className="text-muted">{r.paymentFor}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-hairline bg-canvas font-medium">
                <td colSpan={9}>Total</td>
                <td className="money text-right">{formatINR(t.basic)}</td>
                <td className="money text-right">{formatINR(t.cgst)}</td>
                <td className="money text-right">{formatINR(t.sgst)}</td>
                <td className="money text-right">{formatINR(t.maintenance)}</td>
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
