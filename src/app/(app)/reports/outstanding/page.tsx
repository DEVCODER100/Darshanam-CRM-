import { getCurrentUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { getOutstandingReport } from "@/lib/reports";
import { formatINR } from "@/lib/money";
import { ReportExport } from "@/components/ReportExport";
import { Forbidden } from "@/components/ReportForbidden";

export const dynamic = "force-dynamic";

export default async function OutstandingReportPage() {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "report:view")) return <Forbidden />;

  const rows = await getOutstandingReport();
  const total = rows.reduce((s, r) => s + r.outstanding, 0n);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium">Outstanding report</h1>
      </div>
      <ReportExport type="outstanding" />
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No outstanding dues. 🎉</p>
      ) : (
        <div className="overflow-hidden rounded border border-hairline bg-white">
          <table className="w-full text-sm">
            <thead className="bg-canvas text-left text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Customer</th>
                <th className="px-4 py-2 font-medium">Booking</th>
                <th className="px-4 py-2 text-right font-medium">Total cost</th>
                <th className="px-4 py-2 text-right font-medium">Paid</th>
                <th className="px-4 py-2 text-right font-medium">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.bookingId} className="border-t border-hairline">
                  <td className="px-4 py-2">{r.customerName}</td>
                  <td className="px-4 py-2 text-muted">{r.booking}</td>
                  <td className="money px-4 py-2 text-right">{formatINR(r.totalCost)}</td>
                  <td className="money px-4 py-2 text-right">{formatINR(r.paid)}</td>
                  <td className="money px-4 py-2 text-right font-medium text-due">{formatINR(r.outstanding)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-hairline bg-canvas font-medium">
                <td className="px-4 py-2" colSpan={4}>
                  Total outstanding
                </td>
                <td className="px-4 py-2 text-right">{formatINR(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
