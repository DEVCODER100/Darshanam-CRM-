import { requireCapability } from "@/lib/rbac";
import { jsonError } from "@/lib/api";
import { todayISO } from "@/lib/booking-detail";
import { formatReportDate, isMonth } from "@/lib/statement";
import { getDueReport, getReceivedReport, getStatement } from "@/lib/statement-data";
import {
  buildStatementCsv,
  buildStatementXlsx,
  dueSheet,
  receivedSheet,
  statementSheet,
} from "@/lib/statement-export";
import { buildPdf } from "@/lib/export-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NAMES: Record<string, string> = {
  received: "Payment-Received-Report",
  due: "Payment-Due-Report",
  statement: "Statement",
};

// GET /api/statements/[type]/export?month=YYYY-MM&format=xlsx|csv|pdf  (report:view)
export async function GET(req: Request, { params }: { params: { type: string } }) {
  const gate = await requireCapability("report:view");
  if (!gate.ok) return gate.response;

  const name = NAMES[params.type];
  if (!name) return jsonError("Unknown report", 404);

  const url = new URL(req.url);
  const month = url.searchParams.get("month");
  if (!isMonth(month)) return jsonError("month must look like 2026-09", 422);
  const format = url.searchParams.get("format") ?? "xlsx";

  const sheet =
    params.type === "received"
      ? receivedSheet(await getReceivedReport(month))
      : params.type === "due"
        ? dueSheet(await getDueReport(month))
        : statementSheet(await getStatement(month));

  // Same naming as the reference files: Payment-Received-Report-02-Nov-2026.xlsx
  const stamp = formatReportDate(todayISO()).replace(",", "").replace(/ /g, "-");
  const filename = `${name}-${stamp}`;

  try {
    if (format === "csv") {
      return new Response("﻿" + buildStatementCsv(sheet), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}.csv"`,
        },
      });
    }
    if (format === "pdf") {
      const buf = await buildPdf(sheet);
      return new Response(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}.pdf"`,
        },
      });
    }
    const buf = await buildStatementXlsx(sheet);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
      },
    });
  } catch (err) {
    console.error(err);
    return jsonError("Export failed", 500);
  }
}
