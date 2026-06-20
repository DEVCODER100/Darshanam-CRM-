import Link from "next/link";

/** Download links for a report's Excel/PDF exports (server component, plain anchors). */
export function ReportExport({ type }: { type: string }) {
  return (
    <div className="flex gap-2">
      <a href={`/api/reports/${type}/export?format=xlsx`} className="btn-secondary">
        Excel
      </a>
      <a href={`/api/reports/${type}/export?format=pdf`} className="btn-secondary">
        PDF
      </a>
      <Link href="/reports" className="ml-auto self-center text-sm text-brass-dark hover:underline">
        ← All reports
      </Link>
    </div>
  );
}
