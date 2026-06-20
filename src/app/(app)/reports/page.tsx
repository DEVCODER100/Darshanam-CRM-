import Link from "next/link";
import { getCurrentUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { Forbidden } from "@/components/ReportForbidden";

export const dynamic = "force-dynamic";

const REPORTS = [
  ["/reports/outstanding", "Outstanding", "All bookings with dues outstanding, highest first."],
  ["/reports/customer", "Customer", "Every customer with bookings and full payment history."],
  ["/reports/unit", "Unit", "Booked units, project, status, value, stage and payment type."],
  ["/reports/payment", "Payment", "Transaction-level payment history across all units."],
  ["/reports/loan", "Loan", "Loan status across all bookings."],
  ["/reports/stage", "Stage-wise collection", "Receivable, received and pending by construction stage."],
  ["/reports/gst", "GST tracker", "GST receivable, collected and due per unit."],
  ["/reports/monthly", "Monthly collection", "Payments received, grouped by month."],
] as const;

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "report:view")) {
    return <Forbidden />;
  }
  return (
    <div>
      <h1 className="mb-4 text-2xl font-medium">Reports</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {REPORTS.map(([href, title, desc]) => (
          <Link key={href} href={href} className="rounded-lg border border-hairline bg-white p-4 hover:border-blue-300">
            <p className="font-medium text-brass-dark">{title}</p>
            <p className="mt-1 text-sm text-muted">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
