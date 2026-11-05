import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLog, brokeragePlans, rewardPlans } from "@/db/schema";
import { requireCapability } from "@/lib/rbac";
import { auditEntry } from "@/lib/audit";
import { parseBody } from "@/lib/api";
import { planSchema } from "@/lib/validators";
import { percentToBps, rupeesToPaise } from "@/lib/money";
import { perTypeBps } from "@/lib/agent-write";
import { needProject } from "@/lib/project-scope";

// POST /api/agent-plans — create a brokerage or reward plan in the selected project (agent:manage).
export async function POST(req: Request) {
  const gate = await requireCapability("agent:manage");
  if (!gate.ok) return gate.response;
  const scope = await needProject();
  if (!scope.ok) return scope.response;
  const parsed = await parseBody(req, planSchema);
  if (!parsed.ok) return parsed.response;
  const p = parsed.data;

  const [row] =
    p.type === "brokerage"
      ? await db.insert(brokeragePlans).values({ projectId: scope.project.id, name: p.name, defaultBps: Number(percentToBps(p.defaultPercent)), perType: perTypeBps(p.perType) }).returning()
      : await db
          .insert(rewardPlans)
          .values({ projectId: scope.project.id, name: p.name, kind: p.kind, value: p.kind === "per_booking" ? rupeesToPaise(p.value) : percentToBps(p.value) })
          .returning();
  await db.insert(auditLog).values(auditEntry({ userId: gate.user.id, action: "create", entityType: "agent", entityId: row.id, after: { plan: p.type, ...row } }));
  return NextResponse.json({ id: row.id }, { status: 201 });
}
