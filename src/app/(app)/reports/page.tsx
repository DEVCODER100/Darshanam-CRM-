import Link from "next/link";
import { getCurrentUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { Forbidden } from "@/components/ReportForbidden";
import { ReportTableTab } from "@/components/ReportTableTab";
import { TABS, tabOf } from "@/lib/report-hub";
import type { Params } from "@/lib/report-filters";
import ReceivedReport from "./_tabs/received";
import DueReport from "./_tabs/due";
import StatementReport from "./_tabs/statement";
import GstTracker from "./_tabs/gst";

export const dynamic = "force-dynamic";

const CUSTOM = { received: ReceivedReport, due: DueReport, statement: StatementReport, gst: GstTracker } as const;

/** One Reports page: the tab buttons on top, the chosen report (with its date filter) below. */
export default async function ReportsPage({ searchParams }: { searchParams: Params }) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "report:view")) return <Forbidden />;

  const visible = TABS.filter((t) => !t.capability || can(user.role, t.capability));
  const first = Array.isArray(searchParams.r) ? searchParams.r[0] : searchParams.r;
  const tab = visible.find((t) => t.key === first) ?? visible[0];
  const Custom = tab.custom ? CUSTOM[tab.key as keyof typeof CUSTOM] : null;
  const month = (Array.isArray(searchParams.month) ? searchParams.month[0] : searchParams.month) ?? "";

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h1 className="sr-only">Reports</h1>
        {[1, 2].map((row) => (
          <nav key={row} className="flex flex-wrap gap-2">
            {visible.filter((t) => t.row === row).map((t) => (
              <Link
                key={t.key}
                href={`/reports?r=${t.key}${month && t.key === tab.key ? `&month=${month}` : ""}`}
                className={`rounded-md border px-4 py-2 text-sm ${
                  t.key === tab.key ? "border-ink bg-ink font-medium text-white" : "border-hairline bg-surface text-muted hover:text-ink"
                }`}
              >
                {t.label}
              </Link>
            ))}
          </nav>
        ))}
      </div>

      {Custom ? <Custom searchParams={searchParams} /> : <ReportTableTab tab={tab} sp={searchParams} />}
    </div>
  );
}
