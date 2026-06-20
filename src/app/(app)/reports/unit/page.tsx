import { Forbidden } from "@/components/ReportForbidden";
import { ReportExport } from "@/components/ReportExport";
import { can } from "@/lib/permissions";
import { getUnitReport } from "@/lib/reports";
import { getCurrentUser } from "@/lib/rbac";
import { formatINR } from "@/lib/money";
import { stageLabel } from "@/lib/stage";

export const dynamic = "force-dynamic";

export default async function UnitReportPage() {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "report:view")) return <Forbidden />;
  const rows = await getUnitReport();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-medium">Unit report</h1>
      <ReportExport type="unit" />
      <div className="card overflow-hidden">
        <table className="data-table">
          <thead><tr><th>Customer</th><th>Project</th><th>Unit</th><th>Status</th><th>Payment type</th><th>Stage</th><th className="text-right">Agreement value</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.bookingId}>
                <td>{row.customerName}</td>
                <td>{row.projectName ?? "—"}</td>
                <td>{row.unitType} {row.unitNumber ?? ""}</td>
                <td>{row.unitStatus}</td>
                <td>{row.paymentType.replace("_", " ")}</td>
                <td>{stageLabel(row.currentStage)}</td>
                <td className="money text-right">{formatINR(row.agreementValue ?? 0n)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
