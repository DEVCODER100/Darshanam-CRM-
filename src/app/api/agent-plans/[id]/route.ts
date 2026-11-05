import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, brokeragePlans, rewardPlans } from "@/db/schema";
import { requireCapability } from "@/lib/rbac";
import { auditEntry } from "@/lib/audit";
import { parseBody, jsonError } from "@/lib/api";
import { planPatchSchema } from "@/lib/validators";
import { percentToBps, rupeesToPaise } from "@/lib/money";
import { perTypeBps } from "@/lib/agent-write";

// PATCH /api/agent-plans/[id] — edit or archive a plan (agent:manage).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const gate = await requireCapability("agent:manage");
  if (!gate.ok) return gate.response;
  const parsed = await parseBody(req, planPatchSchema);
  if (!parsed.ok) return parsed.response;
  const d = parsed.data;

  try {
    if (d.type === "brokerage") {
      await db.update(brokeragePlans).set({
        ...(d.name && { name: d.name }),
        ...(d.defaultPercent !== undefined && { defaultBps: Number(percentToBps(d.defaultPercent || "0")) }),
        ...(d.perType && { perType: perTypeBps(d.perType) }),
        ...(d.archived !== undefined && { archived: d.archived }),
      }).where(eq(brokeragePlans.id, params.id));
    } else {
      const kind = d.kind;
      await db.update(rewardPlans).set({
        ...(d.name && { name: d.name }),
        ...(kind && { kind }),
        ...(d.value !== undefined && kind && { value: kind === "per_booking" ? rupeesToPaise(d.value || "0") : percentToBps(d.value || "0") }),
        ...(d.archived !== undefined && { archived: d.archived }),
      }).where(eq(rewardPlans.id, params.id));
    }
  } catch {
    return jsonError("Those values are not valid", 422);
  }
  await db.insert(auditLog).values(auditEntry({ userId: gate.user.id, action: "update", entityType: "agent", entityId: params.id, after: { plan: d } }));
  return NextResponse.json({ ok: true });
}
