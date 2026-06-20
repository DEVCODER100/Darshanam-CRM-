import { Forbidden } from "@/components/ReportForbidden";
import { ReportExport } from "@/components/ReportExport";
import { formatINR } from "@/lib/money";
import { can } from "@/lib/permissions";
import { getPaymentReport } from "@/lib/reports";
import { getCurrentUser } from "@/lib/rbac";
import { stageLabel } from "@/lib/stage";

export const dynamic = "force-dynamic";

export default async function PaymentReportPage() {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "report:view")) return <Forbidden />;
  const rows = await getPaymentReport();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-medium">Payment report</h1>
      <ReportExport type="payment" />
      <div className="card overflow-hidden">
        <table className="data-table">
          <thead><tr><th>Date</th><th>Customer</th><th>Unit</th><th>Stage</th><th>Source</th><th>Method</th><th className="text-right">Amount</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.transactionId}>
                <td>{row.paymentDate}</td>
                <td>{row.customerName}</td>
                <td>{row.unitType} {row.unitNumber ?? ""}</td>
                <td>{stageLabel(row.stage)}</td>
                <td>{row.source}</td>
                <td>{row.mode}</td>
                <td className="money text-right text-paid">{formatINR(row.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
