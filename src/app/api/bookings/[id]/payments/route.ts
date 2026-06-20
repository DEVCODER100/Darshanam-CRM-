import { NextResponse } from "next/server";
import { and, eq, desc, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  payments,
  auditLog,
  bookings,
  propertyCosts,
  paymentSchedule,
} from "@/db/schema";
import { requireAuth, requireCapability } from "@/lib/rbac";
import { auditEntry } from "@/lib/audit";
import { parseBody, genId, jsonError, serializeBigInt } from "@/lib/api";
import { paymentCreateSchema } from "@/lib/validators";
import { rupeesToPaise } from "@/lib/money";
import { calculateReceivable, checkCollectionLimit } from "@/lib/stage";

type Params = { params: { id: string } };

// GET /api/bookings/[id]/payments
export async function GET(_req: Request, { params }: Params) {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;
  const rows = await db
    .select()
    .from(payments)
    .where(eq(payments.bookingId, params.id))
    .orderBy(desc(payments.paymentDate));
  return NextResponse.json(serializeBigInt({ payments: rows }));
}

// POST /api/bookings/[id]/payments — record a payment (payment:create).
export async function POST(req: Request, { params }: Params) {
  const gate = await requireCapability("payment:create");
  if (!gate.ok) return gate.response;

  const parsed = await parseBody(req, paymentCreateSchema);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;
  const amount = rupeesToPaise(input.amount);
  const gstAmount = rupeesToPaise(input.gstAmount);

  const [booking, cost, existingPayments, dueRows] = await Promise.all([
    db.query.bookings.findFirst({ where: eq(bookings.id, params.id) }),
    db.query.propertyCosts.findFirst({
      where: eq(propertyCosts.bookingId, params.id),
    }),
    db.select().from(payments).where(eq(payments.bookingId, params.id)),
    db
      .select()
      .from(paymentSchedule)
      .where(
        and(
          eq(paymentSchedule.bookingId, params.id),
          lte(paymentSchedule.dueDate, input.paymentDate),
        ),
      ),
  ]);
  if (!booking || !cost) return jsonError("Booking or cost not found", 404);

  const scheduleDueTillDate = dueRows.reduce(
    (sum, row) => sum + row.amount,
    0n,
  );
  const receivedBefore = existingPayments.reduce(
    (sum, payment) => sum + payment.amount,
    0n,
  );
  const receivable = calculateReceivable({
    totalCost: cost.totalCost,
    paymentType: booking.paymentType,
    stageBased: booking.stageBased,
    currentStage: booking.currentStage,
    scheduleDueTillDate,
  });
  const limit = checkCollectionLimit(receivable, receivedBefore, amount);
  if (limit.exceedsEligible) {
    if (!input.overrideStageLimit) {
      return NextResponse.json(
        {
          error:
            "Collection exceeds the currently eligible receivable amount. Admin override and reason are required.",
          eligibleReceivable: receivable.toString(),
          alreadyReceived: receivedBefore.toString(),
          remainingEligible: limit.remainingBefore.toString(),
        },
        { status: 409 },
      );
    }
    if (!input.overrideReason) {
      return jsonError("Override reason is required", 422);
    }
  }

  const id = genId();
  const row = {
    id,
    bookingId: params.id,
    paymentDate: input.paymentDate,
    amount,
    gstAmount,
    mode: input.mode,
    stage: input.stage ?? booking.currentStage,
    source: input.source,
    stageLimitOverride: limit.exceedsEligible && input.overrideStageLimit,
    overrideReason:
      limit.exceedsEligible && input.overrideStageLimit
        ? input.overrideReason || null
        : null,
    referenceNumber: input.referenceNumber || null,
    notes: input.notes || null,
    attachmentUrl: input.attachmentUrl || null,
    createdBy: gate.user.id,
  };

  try {
    await db.batch([
      db.insert(payments).values(row),
      db.insert(auditLog).values(
        auditEntry({
          userId: gate.user.id,
          action: "create",
          entityType: "payment",
          entityId: id,
          after: row,
        }),
      ),
    ]);
  } catch (err) {
    console.error(err);
    return jsonError("Failed to record payment", 500);
  }

  return NextResponse.json({ id }, { status: 201 });
}
