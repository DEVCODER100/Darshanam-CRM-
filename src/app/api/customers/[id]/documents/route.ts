import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, documents } from "@/db/schema";
import { auditEntry } from "@/lib/audit";
import { genId, jsonError, parseBody } from "@/lib/api";
import { requireAuth, requireCapability } from "@/lib/rbac";
import { documentCreateSchema } from "@/lib/validators";

type Params = { params: { id: string } };

export async function GET(_request: Request, { params }: Params) {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;
  const rows = await db
    .select()
    .from(documents)
    .where(eq(documents.customerId, params.id))
    .orderBy(desc(documents.createdAt));
  return NextResponse.json({ documents: rows });
}

export async function POST(request: Request, { params }: Params) {
  const gate = await requireCapability("document:upload");
  if (!gate.ok) return gate.response;
  const parsed = await parseBody(request, documentCreateSchema);
  if (!parsed.ok) return parsed.response;

  const id = genId();
  const row = {
    id,
    customerId: params.id,
    bookingId: parsed.data.bookingId ?? null,
    documentType: parsed.data.documentType,
    fileName: parsed.data.fileName,
    fileUrl: parsed.data.fileUrl,
    createdBy: gate.user.id,
  };
  try {
    await db.batch([
      db.insert(documents).values(row),
      db.insert(auditLog).values(
        auditEntry({
          userId: gate.user.id,
          action: "create",
          entityType: "document",
          entityId: id,
          after: row,
        }),
      ),
    ]);
  } catch (error) {
    console.error(error);
    return jsonError("Failed to save document", 500);
  }
  return NextResponse.json({ id }, { status: 201 });
}
