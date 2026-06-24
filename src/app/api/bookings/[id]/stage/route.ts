import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, stageHistory, auditLog } from "@/db/schema";
import { requireCapability } from "@/lib/rbac";
import { auditEntry } from "@/lib/audit";
import { parseBody, jsonError } from "@/lib/api";
import { stageUpdateSchema } from "@/lib/validators";

type Params = { params: { id: string } };

// PATCH /api/bookings/[id]/stage — update the construction stage (booking:edit).
// Marks the booking stage-based, logs a stage-history row, recalcs on read.
export async function PATCH(req: Request, { params }: Params) {
  const gate = await requireCapability("booking:edit");
  if (!gate.ok) return gate.response;

  const parsed = await parseBody(req, stageUpdateSchema);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  const before = await db.query.bookings.findFirst({
    where: eq(bookings.id, params.id),
  });
  if (!before) return jsonError("Booking not found", 404);

  if (before.currentStage === input.currentStage && before.stageBased) {
    return jsonError("Booking is already at this stage", 422);
  }

  const update = { currentStage: input.currentStage, stageBased: true };
  const after = { ...before, ...update };

  try {
    await db.batch([
      db.update(bookings).set(update).where(eq(bookings.id, params.id)),
      db.insert(stageHistory).values({
        bookingId: params.id,
        previousStage: before.currentStage,
        newStage: input.currentStage,
        remarks: input.remarks || null,
        changedBy: gate.user.id,
      }),
      db.insert(auditLog).values(
        auditEntry({
          userId: gate.user.id,
          action: "update",
          entityType: "booking",
          entityId: params.id,
          before,
          after,
        }),
      ),
    ]);
  } catch (err) {
    console.error(err);
    return jsonError("Failed to update stage", 500);
  }

  return NextResponse.json({ ok: true });
}
