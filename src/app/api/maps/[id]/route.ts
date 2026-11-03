import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteMaps, units, auditLog } from "@/db/schema";
import { requireCapability } from "@/lib/rbac";
import { auditEntry } from "@/lib/audit";
import { jsonError } from "@/lib/api";
import { UNPLACED } from "@/lib/map-boxes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DELETE /api/maps/[id] — remove a map; its units stay, just no longer placed (unit:manage).
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const gate = await requireCapability("unit:manage");
  if (!gate.ok) return gate.response;

  const map = await db.query.siteMaps.findFirst({ where: eq(siteMaps.id, params.id), columns: { id: true, name: true } });
  if (!map) return jsonError("Map not found", 404);

  await db.batch([
    db.update(units).set(UNPLACED).where(eq(units.mapId, map.id)),
    db.delete(siteMaps).where(eq(siteMaps.id, map.id)),
    db.insert(auditLog).values(
      auditEntry({ userId: gate.user.id, action: "delete", entityType: "unit", entityId: null, before: { siteMap: map.name } }),
    ),
  ]);
  return NextResponse.json({ ok: true });
}
