import { getCurrentUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { getMonthlyCollection } from "@/lib/reports";
import { formatINR } from "@/lib/money";
import { ReportExport } from "@/components/ReportExport";
import { Forbidden } from "@/components/ReportForbidden";

export const dynamic = "force-dynamic";

function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

export default async function MonthlyReportPage() {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "report:view")) return <Forbidden />;

  const rows = await getMonthlyCollection();
  const total = rows.reduce((s, r) => s + r.total, 0n);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-medium">Monthly collection</h1>
      <ReportExport type="monthly" />
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No payments recorded.</p>
      ) : (
        <div className="overflow-hidden rounded border border-hairline bg-white">
          <table className="w-full text-sm">
            <thead className="bg-canvas text-left text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Month</th>
                <th className="px-4 py-2 text-right font-medium">Payments</th>
                <th className="px-4 py-2 text-right font-medium">Collected</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.month} className="border-t border-hairline">
                  <td className="px-4 py-2">{monthLabel(r.month)}</td>
                  <td className="px-4 py-2 text-right text-muted">{r.count}</td>
                  <td className="px-4 py-2 text-right font-medium">{formatINR(r.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-hairline bg-canvas font-medium">
                <td className="px-4 py-2" colSpan={2}>Total collected</td>
                <td className="px-4 py-2 text-right">{formatINR(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
