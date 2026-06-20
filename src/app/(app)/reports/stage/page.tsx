import { Forbidden } from "@/components/ReportForbidden";
import { ReportExport } from "@/components/ReportExport";
import { formatINR } from "@/lib/money";
import { can } from "@/lib/permissions";
import { getStageCollectionReport } from "@/lib/reports";
import { getCurrentUser } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function StageReportPage() {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "report:view")) return <Forbidden />;
  const rows = await getStageCollectionReport();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-medium">Stage-wise collection report</h1>
      <ReportExport type="stage" />
      <div className="card overflow-hidden">
        <table className="data-table">
          <thead><tr><th>Stage</th><th>Percentage</th><th>Units</th><th className="text-right">Receivable</th><th className="text-right">Received</th><th className="text-right">Pending</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.stage}>
                <td>{row.stage}</td>
                <td>{row.percentage}%</td>
                <td>{row.units}</td>
                <td className="money text-right">{formatINR(row.receivable)}</td>
                <td className="money text-right text-paid">{formatINR(row.received)}</td>
                <td className="money text-right text-due">{formatINR(row.pending)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
