import { eq } from "drizzle-orm";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { jsonError } from "@/lib/api";
import { canOpen } from "@/lib/document-rules";
import { can, requireAuth } from "@/lib/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/documents/[id]/file — the stored file, for signed-in staff. Aadhaar, PAN and
// address proof additionally need sensitive:view. Never cached.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;

  const doc = await db.query.documents.findFirst({
    where: eq(documents.id, params.id),
    columns: { data: true, mimeType: true, fileName: true, documentType: true },
  });
  if (!doc?.data) return jsonError("File not found", 404);
  if (!canOpen(doc.documentType, can(gate.user.role, "sensitive:view"))) {
    return jsonError("Only admin and accountant can open this document", 403);
  }
  return new Response(new Uint8Array(Buffer.from(doc.data, "base64")), {
    headers: {
      "Content-Type": doc.mimeType ?? "application/octet-stream",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
