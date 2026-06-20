import Link from "next/link";
import { getCurrentUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { getGstTracker } from "@/lib/gst";
import { formatINR } from "@/lib/money";
import { Forbidden } from "@/components/ReportForbidden";

export const dynamic = "force-dynamic";

export default async function GstTrackerPage() {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "report:view")) return <Forbidden />;

  const { rows, totals } = await getGstTracker();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium">GST tracker</h1>
        <Link href="/reports" className="text-sm text-brass-dark hover:underline">
          ← All reports
        </Link>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="GST collected" value={formatINR(totals.collected, { paise2dp: false })} tone="paid" />
        <Stat label="GST due on collection" value={formatINR(totals.dueOnCollection, { paise2dp: false })} />
        <Stat label="GST shortfall (payable now)" value={formatINR(totals.shortfall, { paise2dp: false })} tone="due" />
      </section>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">No GST-bearing bookings yet.</p>
      ) : (
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Unit</th>
                <th>GST %</th>
                <th className="text-right">Basic collected</th>
                <th className="text-right">GST collected</th>
                <th className="text-right">GST due on coll.</th>
                <th className="text-right">Shortfall</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.bookingId}>
                  <td>{r.customerName}</td>
                  <td>
                    <Link href={`/bookings/${r.bookingId}`} className="text-brass-dark hover:underline">
                      {r.booking}
                    </Link>
                  </td>
                  <td>{r.gstPercent}%</td>
                  <td className="money text-right">{formatINR(r.basicCollected)}</td>
                  <td className="money text-right text-paid">{formatINR(r.gstCollected)}</td>
                  <td className="money text-right">{formatINR(r.gstDueOnCollection)}</td>
                  <td className="money text-right font-medium text-due">{formatINR(r.gstShortfall)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-hairline bg-canvas font-medium">
                <td colSpan={4}>Total</td>
                <td className="money text-right">{formatINR(totals.collected)}</td>
                <td className="money text-right">{formatINR(totals.dueOnCollection)}</td>
                <td className="money text-right">{formatINR(totals.shortfall)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "paid" | "due";
}) {
  return (
    <div className="card p-4">
      <p className="text-xs tracking-wide text-muted">{label}</p>
      <p
        className={`money mt-1 text-xl font-medium ${
          tone === "paid" ? "text-paid" : tone === "due" ? "text-due" : "text-ink"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
