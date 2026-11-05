import { requireAuth, can } from "@/lib/rbac";
import { jsonError } from "@/lib/api";
import { AGENT_HEADERS } from "@/lib/agent-import";
import { buildXlsx } from "@/lib/export-xlsx";
import { revealText } from "@/lib/pan";
import { projectAgents } from "@/lib/report-agents";
import { getActiveProject } from "@/lib/project-scope";
import { projectSlug } from "@/lib/project-label";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/agents/export — the agents of the selected project in the agent-file layout (no passwords).
// Full PAN and ID proof only for roles that may see them.
export async function GET() {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;
  const canSee = can(gate.user.role, "sensitive:view");
  const label = (await getActiveProject())?.label ?? "All projects";
  const list = await projectAgents();
  try {
    const buf = await buildXlsx({
      title: `Agent data — ${label}`,
      landscape: true,
      columns: AGENT_HEADERS.map((header) => ({ header })),
      rows: list.map(({ row: a, plan, reward }) => [
        a.agentCode ?? "", a.title ?? "", a.name, a.companyName ?? "", a.mobile ?? "", a.email ?? "", a.smsOptIn ? "Yes" : "No", a.emailOptIn ? "Yes" : "No",
        a.phone ?? "", a.reraNo ?? "", a.gstin ?? "", revealText(a.panEncrypted, canSee, a.panMasked ?? ""), revealText(a.idProofEncrypted, canSee),
        plan?.name ?? "", reward?.name ?? "", a.address ?? "", a.pinCode ?? "", a.city ?? "", a.state ?? "", a.country ?? "", a.userGroup,
        a.archived ? "Inactive" : "Active", a.notes ?? "",
      ]),
    });
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Agent-Data-${projectSlug(label)}.xlsx"`,
      },
    });
  } catch (err) {
    console.error(err);
    return jsonError("Export failed", 500);
  }
}
