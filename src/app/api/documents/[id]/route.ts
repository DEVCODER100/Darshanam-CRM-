import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, documents } from "@/db/schema";
import { auditEntry } from "@/lib/audit";
import { jsonError } from "@/lib/api";
import { requireCapability } from "@/lib/rbac";

type Params = { params: { id: string } };

export async function DELETE(_request: Request, { params }: Params) {
  const gate = await requireCapability("document:delete");
  if (!gate.ok) return gate.response;
  const before = await db.query.documents.findFirst({
    where: eq(documents.id, params.id),
  });
  if (!before) return jsonError("Document not found", 404);
  await db.batch([
    db.delete(documents).where(eq(documents.id, params.id)),
    db.insert(auditLog).values(
      auditEntry({
        userId: gate.user.id,
        action: "delete",
        entityType: "document",
        entityId: params.id,
        before,
      }),
    ),
  ]);
  return NextResponse.json({ ok: true });
}
