import { getCurrentUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { getCustomerReport } from "@/lib/reports";
import { formatINR } from "@/lib/money";
import { ReportExport } from "@/components/ReportExport";
import { Forbidden } from "@/components/ReportForbidden";

export const dynamic = "force-dynamic";

const MODE_LABELS: Record<string, string> = {
  bank_transfer: "Bank transfer",
  cheque: "Cheque",
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  other: "Other",
};

export default async function CustomerReportPage() {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "report:view")) return <Forbidden />;

  const entries = await getCustomerReport();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-medium">Customer report</h1>
      <ReportExport type="customer" />
      {entries.length === 0 ? (
        <p className="text-sm text-muted">No customers.</p>
      ) : (
        <div className="space-y-6">
          {entries.map((c, i) => (
            <div key={i} className="rounded border border-hairline bg-white p-4">
              <div className="flex items-baseline justify-between">
                <h2 className="font-medium">{c.customerName}</h2>
                <span className="text-sm text-muted">{c.mobile}</span>
              </div>
              {c.bookings.length === 0 ? (
                <p className="mt-2 text-sm text-muted">No bookings.</p>
              ) : (
                <div className="mt-3 space-y-4">
                  {c.bookings.map((b, j) => (
                    <div key={j} className="rounded border border-hairline p-3">
                      <div className="flex flex-wrap gap-4 text-sm">
                        <span className="font-medium">{b.booking}</span>
                        <span className="money text-muted">Total {formatINR(b.totalCost)}</span>
                        <span className="money text-muted">Paid {formatINR(b.paid)}</span>
                        <span className={`money ${b.outstanding > 0n ? "text-due" : "text-paid"}`}>
                          {b.outstanding < 0n
                            ? `Advance ${formatINR(-b.outstanding)}`
                            : `Outstanding ${formatINR(b.outstanding)}`}
                        </span>
                      </div>
                      {b.payments.length > 0 && (
                        <table className="mt-2 w-full text-xs">
                          <thead className="text-left text-muted">
                            <tr>
                              <th className="py-1 font-medium">Date</th>
                              <th className="py-1 text-right font-medium">Amount</th>
                              <th className="py-1 font-medium">Mode</th>
                              <th className="py-1 font-medium">Reference</th>
                            </tr>
                          </thead>
                          <tbody>
                            {b.payments.map((p, k) => (
                              <tr key={k} className="border-t border-gray-50">
                                <td className="py-1">{p.date}</td>
                                <td className="py-1 text-right">{formatINR(p.amount)}</td>
                                <td className="py-1">{MODE_LABELS[p.mode] ?? p.mode}</td>
                                <td className="py-1 text-muted">{p.reference ?? "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
