import { NextResponse } from "next/server";
import { db } from "@/db";
import { agents, auditLog } from "@/db/schema";
import { requireCapability } from "@/lib/rbac";
import { auditEntry } from "@/lib/audit";
import { parseBody, jsonError } from "@/lib/api";
import { agentSchema } from "@/lib/validators";
import { agentColumns } from "@/lib/agent-write";
import { nextCode } from "@/lib/codes";
import { needProject } from "@/lib/project-scope";

// POST /api/agents — add an agent to the selected project (agent:manage).
export async function POST(req: Request) {
  const gate = await requireCapability("agent:manage");
  if (!gate.ok) return gate.response;
  const scope = await needProject();
  if (!scope.ok) return scope.response;

  const parsed = await parseBody(req, agentSchema);
  if (!parsed.ok) return parsed.response;

  let cols;
  try {
    cols = agentColumns(parsed.data);
  } catch (err) {
    console.error(err);
    return jsonError("PAN storage is not configured on the server (PAN_ENCRYPTION_KEY).", 500);
  }
  const codes = (await db.select({ c: agents.agentCode }).from(agents)).map((r) => r.c);
  const [row] = await db
    .insert(agents)
    .values({ ...cols, name: parsed.data.name, projectId: scope.project.id, agentCode: nextCode("AG", codes), createdBy: gate.user.id })
    .returning();
  await db.insert(auditLog).values(auditEntry({ userId: gate.user.id, action: "create", entityType: "agent", entityId: row.id, after: { ...row, panEncrypted: undefined, idProofEncrypted: undefined } }));
  return NextResponse.json({ id: row.id }, { status: 201 });
}
