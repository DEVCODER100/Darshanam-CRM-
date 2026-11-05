import { redirect } from "next/navigation";
import { queryString } from "@/lib/query-string";
import type { Params } from "@/lib/report-filters";

// Old report links (/reports/received, /reports/due ...) open the matching tab of the Reports page.
export default function OldReportLink({ params, searchParams }: { params: { tab: string }; searchParams: Params }) {
  redirect(`/reports?${queryString(searchParams, { r: params.tab })}`);
}
