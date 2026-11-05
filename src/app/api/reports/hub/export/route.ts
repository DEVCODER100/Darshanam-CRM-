import { requireCapability } from "@/lib/rbac";
import { jsonError } from "@/lib/api";
import { TABS, loadTable } from "@/lib/report-hub";
import { shapeTable } from "@/lib/report-period";
import { buildXlsx } from "@/lib/export-xlsx";
import { buildPdf } from "@/lib/export-pdf";
import { buildStatementCsv } from "@/lib/statement-export";
import { getActiveProject } from "@/lib/project-scope";
import { projectSlug } from "@/lib/project-label";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/reports/hub/export?r=<tab>&<the tab's filters>&format=xlsx|csv|pdf (report:view)
export async function GET(req: Request) {
  const gate = await requireCapability("report:view");
  if (!gate.ok) return gate.response;

  const sp = Object.fromEntries(new URL(req.url).searchParams.entries());
  const tab = TABS.find((t) => t.key === sp.r && !t.custom);
  if (!tab) return jsonError("Unknown report", 404);
  if (tab.capability && !(await requireCapability(tab.capability)).ok) return jsonError("Not allowed", 403);

  const label = (await getActiveProject())?.label ?? "All projects";
  const base = await loadTable(tab.key, sp);
  // Same row order as on screen, all rows.
  const order = Number.isInteger(Number(sp.order)) && sp.order ? Number(sp.order) : undefined;
  const rows = shapeTable(base, { order, dir: sp.dir === "desc" ? "desc" : "asc" }).rows;
  const table = { ...base, title: `${base.title} — ${label}`, rows };
  const file = `${tab.label.replace(/[^A-Za-z0-9]+/g, "-")}-${projectSlug(label)}`;

  try {
    if (sp.format === "csv") {
      return new Response("﻿" + buildStatementCsv({ ...table, tip: "" }), {
        headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${file}.csv"` },
      });
    }
    if (sp.format === "pdf") {
      return new Response(new Uint8Array(await buildPdf(table)), {
        headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${file}.pdf"` },
      });
    }
    return new Response(new Uint8Array(await buildXlsx(table)), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${file}.xlsx"`,
      },
    });
  } catch (err) {
    console.error(err);
    return jsonError("Export failed", 500);
  }
}
