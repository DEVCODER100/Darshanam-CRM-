import { NextResponse } from "next/server";
import { and, eq, lte, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  payments,
  auditLog,
  bookings,
  propertyCosts,
  paymentSchedule,
} from "@/db/schema";
import { requireCapability } from "@/lib/rbac";
import { auditEntry } from "@/lib/audit";
import { parseBody, jsonError } from "@/lib/api";
import { paymentUpdateSchema } from "@/lib/validators";
import { rupeesToPaise } from "@/lib/money";
import { calculateReceivable, checkCollectionLimit } from "@/lib/stage";

type Params = { params: { id: string; paymentId: string } };

// PATCH /api/bookings/[id]/payments/[paymentId] — edit a payment (payment:edit).
export async function PATCH(req: Request, { params }: Params) {
  const gate = await requireCapability("payment:edit");
  if (!gate.ok) return gate.response;

  const parsed = await parseBody(req, paymentUpdateSchema);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  const before = await db.query.payments.findFirst({
    where: and(eq(payments.id, params.paymentId), eq(payments.bookingId, params.id)),
  });
  if (!before) return jsonError("Payment not found", 404);

  const effectiveDate = input.paymentDate ?? before.paymentDate;
  const effectiveAmount =
    input.amount !== undefined ? rupeesToPaise(input.amount) : before.amount;
  const [booking, cost, otherPayments, dueRows] = await Promise.all([
    db.query.bookings.findFirst({ where: eq(bookings.id, params.id) }),
    db.query.propertyCosts.findFirst({
      where: eq(propertyCosts.bookingId, params.id),
    }),
    db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.bookingId, params.id),
          ne(payments.id, params.paymentId),
        ),
      ),
    db
      .select()
      .from(paymentSchedule)
      .where(
        and(
          eq(paymentSchedule.bookingId, params.id),
          lte(paymentSchedule.dueDate, effectiveDate),
        ),
      ),
  ]);
  if (!booking || !cost) return jsonError("Booking or cost not found", 404);
  const receivedBefore = otherPayments.reduce(
    (sum, payment) => sum + payment.amount,
    0n,
  );
  const receivable = calculateReceivable({
    totalCost: cost.totalCost,
    paymentType: booking.paymentType,
    stageBased: booking.stageBased,
    currentStage: booking.currentStage,
    scheduleDueTillDate: dueRows.reduce((sum, row) => sum + row.amount, 0n),
  });
  const limit = checkCollectionLimit(
    receivable,
    receivedBefore,
    effectiveAmount,
  );
  if (limit.exceedsEligible && !input.overrideStageLimit) {
    return jsonError(
      "Updated payment exceeds the eligible receivable amount. Admin override is required.",
      409,
    );
  }
  if (limit.exceedsEligible && !input.overrideReason) {
    return jsonError("Override reason is required", 422);
  }

  const update: Partial<typeof payments.$inferInsert> = {};
  if (input.paymentDate !== undefined) update.paymentDate = input.paymentDate;
  if (input.amount !== undefined) update.amount = rupeesToPaise(input.amount);
  if (input.gstAmount !== undefined)
    update.gstAmount = rupeesToPaise(input.gstAmount);
  if (input.mode !== undefined) update.mode = input.mode;
  if (input.stage !== undefined) update.stage = input.stage;
  if (input.source !== undefined) update.source = input.source;
  if (input.overrideStageLimit !== undefined)
    update.stageLimitOverride =
      limit.exceedsEligible && input.overrideStageLimit;
  if (input.overrideReason !== undefined)
    update.overrideReason =
      limit.exceedsEligible && input.overrideStageLimit
        ? input.overrideReason || null
        : null;
  if (input.referenceNumber !== undefined)
    update.referenceNumber = input.referenceNumber || null;
  if (input.notes !== undefined) update.notes = input.notes || null;
  if (input.attachmentUrl !== undefined)
    update.attachmentUrl = input.attachmentUrl || null;

  if (Object.keys(update).length === 0) {
    return jsonError("No payment fields provided", 422);
  }

  const after = { ...before, ...update };

  try {
    await db.batch([
      db.update(payments).set(update).where(eq(payments.id, params.paymentId)),
      db.insert(auditLog).values(
        auditEntry({
          userId: gate.user.id,
          action: "update",
          entityType: "payment",
          entityId: params.paymentId,
          before,
          after,
        }),
      ),
    ]);
  } catch (err) {
    console.error(err);
    return jsonError("Failed to update payment", 500);
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/bookings/[id]/payments/[paymentId] — delete (payment:delete).
// Outstanding recomputes on read; nothing stored to migrate (PRD §12.6).
export async function DELETE(_req: Request, { params }: Params) {
  const gate = await requireCapability("payment:delete");
  if (!gate.ok) return gate.response;

  const before = await db.query.payments.findFirst({
    where: and(eq(payments.id, params.paymentId), eq(payments.bookingId, params.id)),
  });
  if (!before) return jsonError("Payment not found", 404);

  try {
    await db.batch([
      db.delete(payments).where(eq(payments.id, params.paymentId)),
      db.insert(auditLog).values(
        auditEntry({
          userId: gate.user.id,
          action: "delete",
          entityType: "payment",
          entityId: params.paymentId,
          before,
        }),
      ),
    ]);
  } catch (err) {
    console.error(err);
    return jsonError("Failed to delete payment", 500);
  }

  return NextResponse.json({ ok: true });
}
