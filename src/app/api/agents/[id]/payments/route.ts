import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agentPayments, agents, auditLog } from "@/db/schema";
import { requireCapability } from "@/lib/rbac";
import { auditEntry } from "@/lib/audit";
import { parseBody, jsonError } from "@/lib/api";
import { agentPaymentSchema } from "@/lib/validators";
import { rupeesToPaise } from "@/lib/money";

// POST /api/agents/[id]/payments — record brokerage paid to an agent (agent:manage).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const gate = await requireCapability("agent:manage");
  if (!gate.ok) return gate.response;
  const parsed = await parseBody(req, agentPaymentSchema);
  if (!parsed.ok) return parsed.response;
  if (!(await db.query.agents.findFirst({ where: eq(agents.id, params.id), columns: { id: true } }))) return jsonError("Agent not found", 404);

  const d = parsed.data;
  const amount = rupeesToPaise(d.amount);
  if (amount <= 0n) return jsonError("Amount must be more than zero", 422);
  const [row] = await db
    .insert(agentPayments)
    .values({ agentId: params.id, paymentDate: d.paymentDate, amount, mode: d.mode, reference: d.reference || null, note: d.note || null, createdBy: gate.user.id })
    .returning();
  await db.insert(auditLog).values(auditEntry({ userId: gate.user.id, action: "create", entityType: "agent", entityId: params.id, after: row }));
  return NextResponse.json({ id: row.id }, { status: 201 });
}
