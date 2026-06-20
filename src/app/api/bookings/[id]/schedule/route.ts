import { NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { paymentSchedule, auditLog } from "@/db/schema";
import { requireAuth, requireCapability } from "@/lib/rbac";
import { auditEntry } from "@/lib/audit";
import { parseBody, genId, jsonError, serializeBigInt } from "@/lib/api";
import { scheduleReplaceSchema } from "@/lib/validators";
import { rupeesToPaise } from "@/lib/money";

type Params = { params: { id: string } };

// GET /api/bookings/[id]/schedule
export async function GET(_req: Request, { params }: Params) {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;
  const rows = await db
    .select()
    .from(paymentSchedule)
    .where(eq(paymentSchedule.bookingId, params.id))
    .orderBy(asc(paymentSchedule.dueDate));
  return NextResponse.json(serializeBigInt({ schedule: rows }));
}

// PUT /api/bookings/[id]/schedule — replace the whole instalment plan
// (schedule:edit). Recompute on read means edits after payments are safe (PRD §5).
export async function PUT(req: Request, { params }: Params) {
  const gate = await requireCapability("schedule:edit");
  if (!gate.ok) return gate.response;

  const parsed = await parseBody(req, scheduleReplaceSchema);
  if (!parsed.ok) return parsed.response;

  const before = await db
    .select()
    .from(paymentSchedule)
    .where(eq(paymentSchedule.bookingId, params.id))
    .orderBy(asc(paymentSchedule.dueDate));

  const newRows = parsed.data.rows.map((r, index) => ({
    id: genId(),
    bookingId: params.id,
    dueDate: r.dueDate,
    amount: rupeesToPaise(r.amount),
    label: r.label || null,
    installmentNumber: r.installmentNumber ?? index + 1,
  }));

  const audit = db.insert(auditLog).values(
    auditEntry({
      userId: gate.user.id,
      action: "update",
      entityType: "payment_schedule",
      entityId: params.id,
      before,
      after: newRows,
    }),
  );
  const clear = db
    .delete(paymentSchedule)
    .where(eq(paymentSchedule.bookingId, params.id));

  try {
    if (newRows.length > 0) {
      await db.batch([clear, db.insert(paymentSchedule).values(newRows), audit]);
    } else {
      await db.batch([clear, audit]);
    }
  } catch (err) {
    console.error(err);
    return jsonError("Failed to update schedule", 500);
  }

  return NextResponse.json({ ok: true });
}
