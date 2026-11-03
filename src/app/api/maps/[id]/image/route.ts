import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteMaps } from "@/db/schema";
import { requireAuth } from "@/lib/rbac";
import { jsonError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/maps/[id]/image — the map picture (any signed-in staff). A map's image never
// changes once uploaded, so browsers may keep it.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;

  const map = await db.query.siteMaps.findFirst({ where: eq(siteMaps.id, params.id), columns: { imageData: true } });
  if (!map?.imageData) return jsonError("Map not found", 404);
  return new Response(new Uint8Array(Buffer.from(map.imageData, "base64")), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=31536000, immutable" },
  });
}
