import { requireAuth } from "@/lib/rbac";
import { jsonError } from "@/lib/api";
import { buildXlsx } from "@/lib/export-xlsx";
import { getActiveProject } from "@/lib/project-scope";
import { projectSlug } from "@/lib/project-label";
import { unitTable } from "@/lib/unit-table";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/units/export?<same filters as the Dashboard> — the filtered units as Excel.
export async function GET(req: Request) {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;

  const label = (await getActiveProject())?.label ?? "All projects";
  try {
    const buf = await buildXlsx(await unitTable(Object.fromEntries(new URL(req.url).searchParams.entries()), label));
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Units-${projectSlug(label)}.xlsx"`,
      },
    });
  } catch (err) {
    console.error(err);
    return jsonError("Export failed", 500);
  }
}
