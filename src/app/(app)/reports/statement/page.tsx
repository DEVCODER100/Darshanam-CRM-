import Link from "next/link";
import { getCurrentUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { Forbidden } from "@/components/ReportForbidden";
import { MonthBar } from "@/components/MonthBar";
import { todayISO } from "@/lib/booking-detail";
import { formatINR } from "@/lib/money";
import { formatReportDate, isMonth, splitGst, sumComponents } from "@/lib/statement";
import type { Components } from "@/lib/statement";
import { getStatement } from "@/lib/statement-data";
import type { StatementLine } from "@/lib/statement-data";

export const dynamic = "force-dynamic";

export default async function StatementPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "report:view")) return <Forbidden />;

  const month = isMonth(searchParams.month) ? searchParams.month : todayISO().slice(0, 7);
  const s = await getStatement(month);
  const m = s.thisMonth;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/reports" className="text-sm text-brass-dark hover:underline">← All reports</Link>
        <h1 className="mt-2 text-2xl font-medium">Statement</h1>
        <p className="text-sm text-muted">
          Receivable, received and due for installments, GST and other charges. Due is as of{" "}
          {formatReportDate(s.asOf)}. Stage-based units are tracked on the Stages page.
        </p>
      </div>

      <MonthBar basePath="/reports/statement" month={month} exportType="statement" />

      <section>
        <h2 className="mb-3 text-lg font-medium">This month</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="GST receivable" value={m.receivable.gst} />
          <Stat label="GST received" value={m.received.gst} tone="paid" />
          <Stat label="GST due" value={m.due.gst} tone="due" />
          <Stat label="Installment due" value={m.due.basic} tone="due" />
          <Stat label="Other charges due" value={m.due.other} tone="due" />
          <Stat label="Total received" value={sumComponents(m.received)} tone="paid" />
          <Stat label="Total due" value={sumComponents(m.due)} tone="due" />
        </div>
      </section>

      <Block title={`${formatReportDate(s.from)} to ${formatReportDate(s.to)}`} line={s.thisMonth} />
      <Block title="All time" line={s.allTime} />
    </div>
  );
}

function Block({ title, line }: { title: string; line: StatementLine }) {
  const rows: { label: string; k: keyof Components; sub?: boolean }[] = [
    { label: "Installment (basic)", k: "basic" },
    { label: "GST (CGST + SGST)", k: "gst" },
    { label: "Other charges (maintenance)", k: "other" },
  ];
  return (
    <section>
      <h2 className="mb-3 text-lg font-medium">{title}</h2>
      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Category</th>
              <th className="text-right">Receivable</th>
              <th className="text-right">Received</th>
              <th className="text-right">Due</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <>
                <tr key={r.k}>
                  <td>{r.label}</td>
                  <td className="money text-right">{formatINR(line.receivable[r.k])}</td>
                  <td className="money text-right text-paid">{formatINR(line.received[r.k])}</td>
                  <td className="money text-right text-due">{formatINR(line.due[r.k])}</td>
                </tr>
                {r.k === "gst" &&
                  (["CGST", "SGST"] as const).map((half) => {
                    const pick = (c: Components) =>
                      half === "CGST" ? splitGst(c.gst).cgst : splitGst(c.gst).sgst;
                    return (
                      <tr key={half} className="text-xs text-muted">
                        <td className="pl-8">of which {half}</td>
                        <td className="money text-right">{formatINR(pick(line.receivable))}</td>
                        <td className="money text-right">{formatINR(pick(line.received))}</td>
                        <td className="money text-right">{formatINR(pick(line.due))}</td>
                      </tr>
                    );
                  })}
              </>
            ))}
            <tr className="border-t border-hairline bg-canvas font-medium">
              <td>Total</td>
              <td className="money text-right">{formatINR(sumComponents(line.receivable))}</td>
              <td className="money text-right">{formatINR(sumComponents(line.received))}</td>
              <td className="money text-right">{formatINR(sumComponents(line.due))}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: bigint; tone?: "paid" | "due" }) {
  return (
    <div className="card p-4">
      <p className="text-xs tracking-wide text-muted">{label}</p>
      <p
        className={`money mt-1 text-xl font-medium ${
          tone === "paid" ? "text-paid" : tone === "due" ? "text-due" : "text-ink"
        }`}
      >
        {formatINR(value, { paise2dp: false })}
      </p>
    </div>
  );
}
