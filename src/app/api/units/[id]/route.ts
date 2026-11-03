import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, units, auditLog } from "@/db/schema";
import { requireCapability } from "@/lib/rbac";
import { auditEntry } from "@/lib/audit";
import { parseBody, jsonError } from "@/lib/api";
import { unitPatchSchema } from "@/lib/validators";
import { CLEAR_BLOCK } from "@/lib/unit-block";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

async function isBooked(unitId: string): Promise<boolean> {
  const b = await db.query.bookings.findFirst({
    where: eq(bookings.unitId, unitId),
    columns: { id: true },
  });
  return !!b;
}

// PATCH /api/units/[id] — block a unit for someone, or release it (unit:manage).
// A booked unit can't be blocked: it is already taken.
export async function PATCH(req: Request, { params }: Params) {
  const gate = await requireCapability("unit:manage");
  if (!gate.ok) return gate.response;

  const parsed = await parseBody(req, unitPatchSchema);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  const before = await db.query.units.findFirst({ where: eq(units.id, params.id) });
  if (!before) return jsonError("Unit not found", 404);
  if (input.blocked && (await isBooked(params.id))) {
    return jsonError("This unit is booked, so it cannot be blocked", 409);
  }

  const update = input.blocked
    ? {
        blocked: true,
        blockReason: input.blockReason || null,
        blockedAt: new Date(),
        blockCustomerId: input.customerId || null,
        blockName: input.name,
        blockMobile: input.mobile,
        blockedBy: input.blockedBy || gate.user.id,
        unblockOn: input.unblockOn || null,
      }
    : CLEAR_BLOCK;

  await db.batch([
    db.update(units).set(update).where(eq(units.id, params.id)),
    db.insert(auditLog).values(
      auditEntry({
        userId: gate.user.id,
        action: "update",
        entityType: "unit",
        entityId: params.id,
        before,
        after: { ...before, ...update },
      }),
    ),
  ]);

  return NextResponse.json({ ok: true });
}

// DELETE /api/units/[id] — remove an unbooked unit (unit:manage).
export async function DELETE(_req: Request, { params }: Params) {
  const gate = await requireCapability("unit:manage");
  if (!gate.ok) return gate.response;

  const before = await db.query.units.findFirst({ where: eq(units.id, params.id) });
  if (!before) return jsonError("Unit not found", 404);
  if (await isBooked(params.id)) {
    return jsonError("This unit has a booking, so it cannot be deleted", 409);
  }

  await db.batch([
    db.delete(units).where(eq(units.id, params.id)),
    db.insert(auditLog).values(
      auditEntry({
        userId: gate.user.id,
        action: "delete",
        entityType: "unit",
        entityId: params.id,
        before,
      }),
    ),
  ]);

  return NextResponse.json({ ok: true });
}
