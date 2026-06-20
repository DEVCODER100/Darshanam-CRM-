import { getCurrentUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { getLoanReport } from "@/lib/reports";
import { formatINR } from "@/lib/money";
import { ReportExport } from "@/components/ReportExport";
import { Forbidden } from "@/components/ReportForbidden";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  not_applicable: "Not applicable",
  pending_docs: "Pending docs",
  applied: "Applied",
  approved: "Approved",
  disbursed: "Disbursed",
  rejected: "Rejected",
};

export default async function LoanReportPage() {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "report:view")) return <Forbidden />;

  const rows = await getLoanReport();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-medium">Loan report</h1>
      <ReportExport type="loan" />
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No loans recorded.</p>
      ) : (
        <div className="overflow-hidden rounded border border-hairline bg-white">
          <table className="w-full text-sm">
            <thead className="bg-canvas text-left text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Customer</th>
                <th className="px-4 py-2 font-medium">Booking</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Loan amount</th>
                <th className="px-4 py-2 font-medium">Bank</th>
                <th className="px-4 py-2 font-medium">Approved</th>
                <th className="px-4 py-2 font-medium">Disbursed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-hairline">
                  <td className="px-4 py-2">{r.customerName}</td>
                  <td className="px-4 py-2 text-muted">{r.booking}</td>
                  <td className="px-4 py-2">{STATUS_LABEL[r.status] ?? r.status}</td>
                  <td className="px-4 py-2 text-right">{r.loanAmount ? formatINR(r.loanAmount) : "—"}</td>
                  <td className="px-4 py-2">{r.bankName ?? "—"}</td>
                  <td className="px-4 py-2">{r.approvalDate ?? "—"}</td>
                  <td className="px-4 py-2">{r.disbursementDate ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
