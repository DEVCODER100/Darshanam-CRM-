import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, auditLog } from "@/db/schema";
import { requireAuth, requireCapability } from "@/lib/rbac";
import { auditEntry } from "@/lib/audit";
import { parseBody, jsonError, serializeBigInt } from "@/lib/api";
import { bookingUpdateSchema } from "@/lib/validators";
import { loadBookingDetail } from "@/lib/booking-detail";
import { rupeesToPaise } from "@/lib/money";

type Params = { params: { id: string } };

// GET /api/bookings/[id] — full detail incl. computed outstanding.
export async function GET(req: Request, { params }: Params) {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const asOf = url.searchParams.get("asOf") ?? undefined;
  const detail = await loadBookingDetail(params.id, asOf);
  if (!detail) return jsonError("Booking not found", 404);

  return NextResponse.json(serializeBigInt({ booking: detail }));
}

// PATCH /api/bookings/[id] — edit booking fields (booking:edit).
export async function PATCH(req: Request, { params }: Params) {
  const gate = await requireCapability("booking:edit");
  if (!gate.ok) return gate.response;

  const parsed = await parseBody(req, bookingUpdateSchema);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  const before = await db.query.bookings.findFirst({
    where: eq(bookings.id, params.id),
  });
  if (!before) return jsonError("Booking not found", 404);

  const update: Partial<typeof bookings.$inferInsert> = {};
  if (input.bookingDate !== undefined) update.bookingDate = input.bookingDate;
  if (input.projectName !== undefined)
    update.projectName = input.projectName || null;
  if (input.propertyType !== undefined) update.propertyType = input.propertyType;
  if (input.propertyNumber !== undefined)
    update.propertyNumber = input.propertyNumber || null;
  if (input.bookingAddress !== undefined)
    update.bookingAddress = input.bookingAddress || null;
  if (input.unitStatus !== undefined) update.unitStatus = input.unitStatus;
  if (input.paymentType !== undefined) {
    update.paymentType = input.paymentType;
    update.financeType =
      input.paymentType === "bank_loan" ? "loan" : "self_funded";
  }
  if (input.stageBased !== undefined) update.stageBased = input.stageBased;
  if (input.currentStage !== undefined)
    update.currentStage = input.currentStage ?? null;
  if (input.downPayment !== undefined)
    update.downPayment = rupeesToPaise(input.downPayment);
  if (input.installmentCount !== undefined)
    update.installmentCount = input.installmentCount ?? null;
  if (input.installmentFrequency !== undefined)
    update.installmentFrequency = input.installmentFrequency ?? null;

  if (Object.keys(update).length === 0) {
    return jsonError("No editable booking fields provided", 422);
  }

  const after = { ...before, ...update };

  try {
    await db.batch([
      db.update(bookings).set(update).where(eq(bookings.id, params.id)),
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
    return jsonError("Failed to update booking", 500);
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/bookings/[id] — delete (booking:delete, admin). Cascades cost,
// schedule, payments, loan via FK ON DELETE CASCADE.
export async function DELETE(_req: Request, { params }: Params) {
  const gate = await requireCapability("booking:delete");
  if (!gate.ok) return gate.response;

  const before = await db.query.bookings.findFirst({
    where: eq(bookings.id, params.id),
  });
  if (!before) return jsonError("Booking not found", 404);

  try {
    await db.batch([
      db.delete(bookings).where(eq(bookings.id, params.id)),
      db.insert(auditLog).values(
        auditEntry({
          userId: gate.user.id,
          action: "delete",
          entityType: "booking",
          entityId: params.id,
          before,
        }),
      ),
    ]);
  } catch (err) {
    console.error(err);
    return jsonError("Failed to delete booking", 500);
  }

  return NextResponse.json({ ok: true });
}
