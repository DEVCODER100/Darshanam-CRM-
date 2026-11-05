import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agents, auditLog } from "@/db/schema";
import { requireCapability } from "@/lib/rbac";
import { auditEntry } from "@/lib/audit";
import { parseBody, jsonError } from "@/lib/api";
import { agentPatchSchema } from "@/lib/validators";
import { agentColumns } from "@/lib/agent-write";

// PATCH /api/agents/[id] — edit any agent field, or set Inactive (agent:manage).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const gate = await requireCapability("agent:manage");
  if (!gate.ok) return gate.response;
  const parsed = await parseBody(req, agentPatchSchema);
  if (!parsed.ok) return parsed.response;
  const before = await db.query.agents.findFirst({ where: eq(agents.id, params.id) });
  if (!before) return jsonError("Agent not found", 404);

  let update;
  try {
    update = agentColumns(parsed.data);
  } catch (err) {
    console.error(err);
    return jsonError("PAN storage is not configured on the server (PAN_ENCRYPTION_KEY).", 500);
  }
  const hide = (a: object) => ({ ...a, panEncrypted: undefined, idProofEncrypted: undefined, panHash: undefined });
  await db.batch([
    db.update(agents).set(update).where(eq(agents.id, before.id)),
    db.insert(auditLog).values(auditEntry({ userId: gate.user.id, action: "update", entityType: "agent", entityId: before.id, before: hide(before), after: hide({ ...before, ...update }) })),
  ]);
  return NextResponse.json({ ok: true });
}
