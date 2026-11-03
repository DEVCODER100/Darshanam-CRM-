import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteMaps, units, auditLog } from "@/db/schema";
import { requireCapability } from "@/lib/rbac";
import { auditEntry } from "@/lib/audit";
import { parseBody, jsonError } from "@/lib/api";
import { mapBoxesSchema } from "@/lib/validators";
import { UNPLACED } from "@/lib/map-boxes";
import { unitKey } from "@/lib/unit-import";

export const dynamic = "force-dynamic";

const CHUNK = 100;

// PUT /api/maps/[id]/boxes — replace where units sit on this map (unit:manage).
// A box either points at an existing unit or creates a new one. Units dropped
// from the list are simply taken off the map; no unit is ever deleted here.
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const gate = await requireCapability("unit:manage");
  if (!gate.ok) return gate.response;

  const parsed = await parseBody(req, mapBoxesSchema);
  if (!parsed.ok) return parsed.response;

  const map = await db.query.siteMaps.findFirst({
    where: eq(siteMaps.id, params.id),
    columns: { id: true, name: true, projectName: true, projectId: true },
  });
  if (!map) return jsonError("Map not found", 404);

  // A box that names a unit already in the database links to it instead of duplicating it.
  const existing = await db
    .select({ id: units.id, p: units.projectName, t: units.unitType, n: units.unitNumber })
    .from(units)
    .where(map.projectId ? eq(units.projectId, map.projectId) : undefined);
  const idByKey = new Map(existing.map((u) => [unitKey(u.p, u.t, u.n), u.id]));
  const place = new Map<string, { x: number; y: number; w: number; h: number }>();
  const fresh = new Map<string, { project: string; type: string; number: string; at: { x: number; y: number; w: number; h: number } }>();
  for (const b of parsed.data.boxes) {
    const at = { x: b.x, y: b.y, w: b.w, h: b.h };
    if (b.unitId) place.set(b.unitId, at);
    else if (b.create) {
      const project = map.projectName; // new units belong to the map's project
      const key = unitKey(project, b.create.type, b.create.number);
      const known = idByKey.get(key);
      if (known) place.set(known, at);
      else fresh.set(key, { project, type: b.create.type, number: b.create.number, at });
    }
  }

  const set = (id: string, a: { x: number; y: number; w: number; h: number }) =>
    db.update(units).set({ mapId: map.id, mapX: a.x, mapY: a.y, mapW: a.w, mapH: a.h }).where(eq(units.id, id));
  const updates = [...place].map(([id, a]) => set(id, a));

  try {
    // Clear this map, then place every box (clear rides with the first chunk so a refresh never sees an empty map).
    const clear = db.update(units).set(UNPLACED).where(eq(units.mapId, map.id));
    await db.batch([clear, ...updates.slice(0, CHUNK)]);
    for (let i = CHUNK; i < updates.length; i += CHUNK) {
      const [first, ...rest] = updates.slice(i, i + CHUNK);
      await db.batch([first, ...rest]);
    }
    const created = [...fresh.values()];
    for (let i = 0; i < created.length; i += CHUNK) {
      await db
        .insert(units)
        .values(
          created.slice(i, i + CHUNK).map((u) => ({
            projectId: map.projectId,
            projectName: u.project,
            unitType: u.type,
            unitNumber: u.number,
            mapId: map.id,
            mapX: u.at.x,
            mapY: u.at.y,
            mapW: u.at.w,
            mapH: u.at.h,
          })),
        )
        .onConflictDoNothing();
    }
    await db.insert(auditLog).values(
      auditEntry({
        userId: gate.user.id,
        action: "update",
        entityType: "unit",
        entityId: null,
        after: { siteMap: map.name, placed: place.size, createdUnits: created.length },
      }),
    );
  } catch (err) {
    console.error(err);
    return jsonError("Could not save the boxes. Try again.", 500);
  }
  return NextResponse.json({ placed: place.size + fresh.size, created: fresh.size });
}
