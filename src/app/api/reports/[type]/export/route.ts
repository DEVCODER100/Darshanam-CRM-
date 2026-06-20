import { requireCapability } from "@/lib/rbac";
import { jsonError } from "@/lib/api";
import { getReportTable, REPORT_TYPES, type ReportType } from "@/lib/reports";
import { buildXlsx } from "@/lib/export-xlsx";
import { buildPdf } from "@/lib/export-pdf";

export const runtime = "nodejs";

type Params = { params: { type: string } };

// GET /api/reports/[type]/export?format=xlsx|pdf  (report:view)
export async function GET(req: Request, { params }: Params) {
  const gate = await requireCapability("report:view");
  if (!gate.ok) return gate.response;

  if (!REPORT_TYPES.includes(params.type as ReportType)) {
    return jsonError("Unknown report type", 404);
  }
  const type = params.type as ReportType;
  const format = new URL(req.url).searchParams.get("format") ?? "xlsx";

  const table = await getReportTable(type);

  try {
    if (format === "pdf") {
      const buf = await buildPdf(table);
      return new Response(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${type}-report.pdf"`,
        },
      });
    }
    const buf = await buildXlsx(table);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${type}-report.xlsx"`,
      },
    });
  } catch (err) {
    console.error(err);
    return jsonError("Export failed", 500);
  }
}
