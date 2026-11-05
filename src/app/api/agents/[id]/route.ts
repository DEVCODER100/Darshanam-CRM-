import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agents, auditLog } from "@/db/schema";
import { requireCapability } from "@/lib/rbac";
import { auditEntry } from "@/lib/audit";
import { parseBody, jsonError } from "@/lib/api";
import { agentPatchSchema } from "@/lib/validators";
import { maskPan, normalizePan } from "@/lib/pan-format";
import { percentToBps } from "@/lib/money";

// PATCH /api/agents/[id] — edit name, mobile, PAN, commission or archive (agent:manage).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const gate = await requireCapability("agent:manage");
  if (!gate.ok) return gate.response;
  const parsed = await parseBody(req, agentPatchSchema);
  if (!parsed.ok) return parsed.response;
  const before = await db.query.agents.findFirst({ where: eq(agents.id, params.id) });
  if (!before) return jsonError("Agent not found", 404);

  const d = parsed.data;
  const update: Partial<typeof agents.$inferInsert> = {
    ...(d.name !== undefined && { name: d.name }),
    ...(d.mobile !== undefined && { mobile: d.mobile || null }),
    ...(d.pan && { panMasked: maskPan(normalizePan(d.pan)) }),
    ...(d.commissionPercent !== undefined && { commissionBps: Number(percentToBps(d.commissionPercent)) }),
    ...(d.archived !== undefined && { archived: d.archived }),
  };
  await db.batch([
    db.update(agents).set(update).where(eq(agents.id, before.id)),
    db.insert(auditLog).values(auditEntry({ userId: gate.user.id, action: "update", entityType: "agent", entityId: before.id, before, after: { ...before, ...update } })),
  ]);
  return NextResponse.json({ ok: true });
}
