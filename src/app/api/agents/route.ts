import { NextResponse } from "next/server";
import { db } from "@/db";
import { agents, auditLog } from "@/db/schema";
import { requireCapability } from "@/lib/rbac";
import { auditEntry } from "@/lib/audit";
import { parseBody } from "@/lib/api";
import { agentSchema } from "@/lib/validators";
import { maskPan, normalizePan } from "@/lib/pan-format";
import { needProject } from "@/lib/project-scope";
import { percentToBps } from "@/lib/money";

// POST /api/agents — add an agent to the selected project (agent:manage).
export async function POST(req: Request) {
  const gate = await requireCapability("agent:manage");
  if (!gate.ok) return gate.response;
  const scope = await needProject();
  if (!scope.ok) return scope.response;

  const parsed = await parseBody(req, agentSchema);
  if (!parsed.ok) return parsed.response;
  const { name, mobile, pan, commissionPercent } = parsed.data;

  const [row] = await db
    .insert(agents)
    .values({
      projectId: scope.project.id,
      name,
      mobile: mobile || null,
      panMasked: pan ? maskPan(normalizePan(pan)) : null,
      commissionBps: Number(percentToBps(commissionPercent)),
    })
    .returning();
  await db.insert(auditLog).values(auditEntry({ userId: gate.user.id, action: "create", entityType: "agent", entityId: row.id, after: row }));
  return NextResponse.json({ id: row.id }, { status: 201 });
}
