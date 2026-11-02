import Link from "next/link";
import { formatReportDate, monthRange, shiftMonth } from "@/lib/statement";

/**
 * Month picker + download buttons shared by the month-wise reports.
 * Server component: prev/next are plain links and the picker is a GET form.
 */
export function MonthBar({
  basePath,
  month,
  exportType,
}: {
  basePath: string; // e.g. "/reports/received"
  month: string; // YYYY-MM
  exportType: "received" | "due" | "statement";
}) {
  const { from, to } = monthRange(month);
  const dl = (format: string) =>
    `/api/statements/${exportType}/export?month=${month}&format=${format}`;

  return (
    <div className="card flex flex-wrap items-center gap-3 p-3">
      <Link href={`${basePath}?month=${shiftMonth(month, -1)}`} className="btn-secondary px-3 py-1.5">
        ← Prev
      </Link>
      <form method="get" className="flex items-center gap-2">
        <input type="month" name="month" defaultValue={month} className="field w-auto" />
        <button className="btn-secondary px-3 py-1.5">Show</button>
      </form>
      <Link href={`${basePath}?month=${shiftMonth(month, 1)}`} className="btn-secondary px-3 py-1.5">
        Next →
      </Link>
      <span className="text-sm text-muted">
        {formatReportDate(from)} to {formatReportDate(to)}
      </span>
      <span className="ml-auto flex gap-2">
        <a href={dl("xlsx")} className="btn-primary px-3 py-1.5">Excel</a>
        <a href={dl("csv")} className="btn-secondary px-3 py-1.5">CSV</a>
        <a href={dl("pdf")} className="btn-secondary px-3 py-1.5">PDF</a>
      </span>
    </div>
  );
}
