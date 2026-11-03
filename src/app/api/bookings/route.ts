import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, propertyCosts, auditLog, units } from "@/db/schema";
import { requireAuth, requireCapability } from "@/lib/rbac";
import { auditEntry } from "@/lib/audit";
import { parseBody, genId, jsonError } from "@/lib/api";
import { bookingCreateSchema } from "@/lib/validators";
import { computeCost } from "@/lib/cost";
import { rupeesToPaise, percentToBps } from "@/lib/money";
import { nextCode } from "@/lib/codes";
import { CLEAR_BLOCK } from "@/lib/unit-block";

// GET /api/bookings — list (any authenticated staff).
export async function GET() {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;
  const rows = await db
    .select()
    .from(bookings)
    .orderBy(desc(bookings.createdAt));
  return NextResponse.json({ bookings: rows });
}

// POST /api/bookings — create booking + its property cost (booking:create).
export async function POST(req: Request) {
  const gate = await requireCapability("booking:create");
  if (!gate.ok) return gate.response;

  const parsed = await parseBody(req, bookingCreateSchema);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  const bookingId = genId();

  // Every booking belongs to one unit. Use the chosen unit, or find/create the
  // unit that matches the typed project + type + number.
  let unit = input.unitId
    ? await db.query.units.findFirst({ where: eq(units.id, input.unitId) })
    : undefined;
  if (input.unitId && !unit) return jsonError("Unit not found", 404);
  if (!unit) {
    const project = input.projectName || "";
    const number = input.propertyNumber || `(${bookingId.slice(0, 6)})`;
    unit = (
      await db
        .select()
        .from(units)
        .where(
          and(
            eq(units.projectName, project),
            eq(units.unitType, input.propertyType),
            eq(units.unitNumber, number),
          ),
        )
    )[0];
    if (!unit) {
      [unit] = await db
        .insert(units)
        .values({ projectName: project, unitType: input.propertyType, unitNumber: number })
        .returning();
    }
  }
  const taken = await db.query.bookings.findFirst({
    where: eq(bookings.unitId, unit.id),
    columns: { id: true },
  });
  if (taken) return jsonError("This unit is already booked.", 409);

  const cost = computeCost({
    baseCost: rupeesToPaise(input.baseCost),
    extraCharges: rupeesToPaise(input.extraCharges),
    discount: rupeesToPaise(input.discount),
    gstPercentBps: Number(percentToBps(input.gstPercent)),
    maintenanceCharge: rupeesToPaise(input.maintenanceCharge),
    documentationPercentBps: Number(percentToBps(input.documentationPercent)),
  });

  const bookingRow = {
    id: bookingId,
    customerId: input.customerId,
    unitId: unit.id,
    bookingCode: nextCode(
      "BI",
      (await db.select({ c: bookings.bookingCode }).from(bookings)).map((r) => r.c),
    ),
    bookingDate: input.bookingDate,
    projectName: unit.projectName || null,
    propertyType: unit.unitType,
    propertyNumber: unit.unitNumber.startsWith("(") ? null : unit.unitNumber,
    bookingAddress: input.bookingAddress || null,
    unitStatus: input.unitStatus,
    paymentType: input.paymentType,
    stageBased: input.stageBased,
    currentStage: input.currentStage ?? null,
    downPayment: rupeesToPaise(input.downPayment),
    installmentCount: input.installmentCount ?? null,
    installmentFrequency: input.installmentFrequency ?? null,
    financeType:
      input.paymentType === "bank_loan" ? ("loan" as const) : ("self_funded" as const),
    createdBy: gate.user.id,
  };
  const costRow = {
    id: genId(),
    bookingId,
    baseCost: cost.baseCost,
    extraCharges: cost.extraCharges,
    discount: cost.discount,
    agreementValue: cost.agreementValue,
    gstPercentBps: cost.gstPercentBps,
    gstAmount: cost.gstAmount,
    maintenanceCharge: cost.maintenanceCharge,
    documentationPercentBps: cost.documentationPercentBps,
    documentationAmount: cost.documentationAmount,
    totalCost: cost.totalCost,
  };

  try {
    await db.batch([
      db.insert(bookings).values(bookingRow),
      // Booking the unit ends any hold on it.
      db.update(units).set(CLEAR_BLOCK).where(eq(units.id, unit.id)),
      db.insert(propertyCosts).values(costRow),
      db.insert(auditLog).values(
        auditEntry({
          userId: gate.user.id,
          action: "create",
          entityType: "booking",
          entityId: bookingId,
          after: bookingRow,
        }),
      ),
      db.insert(auditLog).values(
        auditEntry({
          userId: gate.user.id,
          action: "create",
          entityType: "property_cost",
          entityId: costRow.id,
          after: costRow,
        }),
      ),
    ]);
  } catch (err) {
    console.error(err);
    return jsonError("Failed to create booking", 500);
  }

  return NextResponse.json({ id: bookingId }, { status: 201 });
}
