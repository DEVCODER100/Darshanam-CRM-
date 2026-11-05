import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, bookings, documents } from "@/db/schema";
import { auditEntry } from "@/lib/audit";
import { genId, jsonError } from "@/lib/api";
import { canOpen, checkFile, isDocumentType } from "@/lib/document-rules";
import { can, requireAuth, requireCapability } from "@/lib/rbac";

export const runtime = "nodejs";
type Params = { params: { id: string } };

// GET /api/customers/[id]/documents — the list (never the file bytes). Staff without
// sensitive access get no link for Aadhaar / PAN / address proof.
export async function GET(_request: Request, { params }: Params) {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;
  const rows = await db
    .select({
      id: documents.id,
      documentType: documents.documentType,
      fileName: documents.fileName,
      fileUrl: documents.fileUrl,
      note: documents.note,
      sizeBytes: documents.sizeBytes,
      bookingId: documents.bookingId,
      createdAt: documents.createdAt,
    })
    .from(documents)
    .where(eq(documents.customerId, params.id))
    .orderBy(desc(documents.createdAt));
  const sensitive = can(gate.user.role, "sensitive:view");
  return NextResponse.json({
    documents: rows.map((d) => (canOpen(d.documentType, sensitive) ? d : { ...d, fileUrl: null })),
  });
}

// POST /api/customers/[id]/documents — multipart: file, documentType, bookingId?, note? (document:upload).
export async function POST(request: Request, { params }: Params) {
  const gate = await requireCapability("document:upload");
  if (!gate.ok) return gate.response;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const documentType = form?.get("documentType");
  const bookingId = String(form?.get("bookingId") ?? "") || null;
  if (!(file instanceof File)) return jsonError("Choose a file to upload", 422);
  if (!isDocumentType(documentType)) return jsonError("Choose a document type", 422);
  const problem = checkFile(file);
  if (problem) return jsonError(problem, 422);
  if (bookingId) {
    const own = await db.query.bookings.findFirst({
      where: and(eq(bookings.id, bookingId), eq(bookings.customerId, params.id)),
      columns: { id: true },
    });
    if (!own) return jsonError("That booking does not belong to this customer", 422);
  }

  const id = genId();
  const meta = {
    id,
    customerId: params.id,
    bookingId,
    documentType,
    fileName: file.name.slice(0, 200),
    fileUrl: `/api/documents/${id}/file`,
    mimeType: file.type,
    sizeBytes: file.size,
    note: String(form?.get("note") ?? "").trim().slice(0, 300) || null,
    createdBy: gate.user.id,
  };
  try {
    await db.batch([
      db.insert(documents).values({ ...meta, data: Buffer.from(await file.arrayBuffer()).toString("base64") }),
      db.insert(auditLog).values(
        auditEntry({ userId: gate.user.id, action: "create", entityType: "document", entityId: id, after: meta }),
      ),
    ]);
  } catch (error) {
    console.error(error);
    return jsonError("Failed to save document", 500);
  }
  return NextResponse.json({ id }, { status: 201 });
}
