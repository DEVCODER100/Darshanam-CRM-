import { requireCapability } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { jsonError } from "@/lib/api";
import { todayISO } from "@/lib/dates";
import { formatReportDate, isMonth } from "@/lib/statement";
import {
  describeFilters,
  parseDueFilters,
  parseReceivedFilters,
  resolvePeriod,
  type Params,
} from "@/lib/report-filters";
import { getDueReport, getReceivedReport, getStatement } from "@/lib/statement-data";
import {
  buildStatementCsv,
  buildStatementXlsx,
  dueSheet,
  pdfTable,
  receivedSheet,
  statementSheet,
} from "@/lib/statement-export";
import { buildPdf } from "@/lib/export-pdf";
import { getActiveProject } from "@/lib/project-scope";
import { projectSlug } from "@/lib/project-label";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NAMES: Record<string, string> = {
  received: "Payment-Received-Report",
  due: "Payment-Due-Report",
  statement: "Statement",
};

// GET /api/statements/[type]/export?<same filters as the screen>&format=xlsx|csv|pdf  (report:view)
export async function GET(req: Request, { params }: { params: { type: string } }) {
  const gate = await requireCapability("report:view");
  if (!gate.ok) return gate.response;

  const name = NAMES[params.type];
  if (!name) return jsonError("Unknown report", 404);

  const url = new URL(req.url);
  const sp: Params = Object.fromEntries(url.searchParams.entries());
  const format = url.searchParams.get("format") ?? "xlsx";
  const viewer = { canSeePan: can(gate.user.role, "sensitive:view") };

  // Statement stays month-only; the other two accept a month or a from/to range.
  const month = url.searchParams.get("month");
  if (params.type === "statement" && !isMonth(month)) {
    return jsonError("month must look like 2026-09", 422);
  }
  const period = resolvePeriod(sp);

  let sheet;
  if (params.type === "received") {
    const filters = parseReceivedFilters(sp);
    sheet = receivedSheet(
      await getReceivedReport(period, filters, viewer),
      describeFilters(filters),
    );
  } else if (params.type === "due") {
    const filters = parseDueFilters(sp);
    sheet = dueSheet(await getDueReport(period, filters, viewer), describeFilters(filters));
  } else {
    sheet = statementSheet(await getStatement(month as string));
  }

  // Same naming as the reference files, plus the project: Payment-Received-Report-Splendora-3-…-02-Nov-2026.xlsx
  const project = await getActiveProject();
  const label = project?.label ?? "All projects";
  sheet = { ...sheet, title: `${sheet.title} — ${label}` };
  const stamp = formatReportDate(todayISO()).replace(",", "").replace(/ /g, "-");
  const filename = `${name}-${projectSlug(label)}-${stamp}`;

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
      const buf = await buildPdf(pdfTable(sheet));
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
