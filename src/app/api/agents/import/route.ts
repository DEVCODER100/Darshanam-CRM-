import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { agents, auditLog } from "@/db/schema";
import { requireCapability } from "@/lib/rbac";
import { auditEntry } from "@/lib/audit";
import { parseBody, jsonError } from "@/lib/api";
import { agentBase } from "@/lib/validators";
import { agentColumns } from "@/lib/agent-write";
import { nextCode } from "@/lib/codes";
import { needProject } from "@/lib/project-scope";

const importSchema = z.object({
  rows: z
    .array(z.object({ code: z.string().nullable(), fields: agentBase, brokeragePlanId: z.string().uuid().nullable(), rewardPlanId: z.string().uuid().nullable() }))
    .min(1, "Nothing to import")
    .max(1000),
});

// POST /api/agents/import — add agents (no Agent ID) or update them (with an Agent ID) (agent:manage).
export async function POST(req: Request) {
  const gate = await requireCapability("agent:manage");
  if (!gate.ok) return gate.response;
  const scope = await needProject();
  if (!scope.ok) return scope.response;
  const parsed = await parseBody(req, importSchema);
  if (!parsed.ok) return parsed.response;

  const existing = await db.select({ id: agents.id, code: agents.agentCode, projectId: agents.projectId }).from(agents);
  const codes = existing.map((a) => a.code);
  let created = 0;
  let updated = 0;
  try {
    for (const r of parsed.data.rows) {
      const cols = {
        ...agentColumns(r.fields),
        ...(r.brokeragePlanId && { brokeragePlanId: r.brokeragePlanId }),
        ...(r.rewardPlanId && { rewardPlanId: r.rewardPlanId }),
      };
      if (r.code) {
        const hit = await db.query.agents.findFirst({ where: and(eq(agents.agentCode, r.code), eq(agents.projectId, scope.project.id)), columns: { id: true } });
        if (!hit) return jsonError(`Agent ID ${r.code} was not found in this project`, 422);
        await db.update(agents).set(cols).where(eq(agents.id, hit.id));
        updated++;
      } else {
        const code = nextCode("AG", codes);
        codes.push(code);
        await db.insert(agents).values({ ...cols, name: r.fields.name, projectId: scope.project.id, agentCode: code, createdBy: gate.user.id });
        created++;
      }
    }
  } catch (err) {
    console.error(err);
    return jsonError("The import stopped part-way (is PAN_ENCRYPTION_KEY set?). Run it again; agents already added keep their IDs.", 500);
  }
  await db.insert(auditLog).values(auditEntry({ userId: gate.user.id, action: "create", entityType: "agent", entityId: null, after: { import: { created, updated }, project: scope.project.label } }));
  return NextResponse.json({ created, updated }, { status: 201 });
}
