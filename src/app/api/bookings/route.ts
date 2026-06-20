import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { bookings, propertyCosts, auditLog } from "@/db/schema";
import { requireAuth, requireCapability } from "@/lib/rbac";
import { auditEntry } from "@/lib/audit";
import { parseBody, genId, jsonError } from "@/lib/api";
import { bookingCreateSchema } from "@/lib/validators";
import { computeCost } from "@/lib/cost";
import { rupeesToPaise, percentToBps } from "@/lib/money";

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

  const cost = computeCost({
    baseCost: rupeesToPaise(input.baseCost),
    extraCharges: rupeesToPaise(input.extraCharges),
    discount: rupeesToPaise(input.discount),
    gstPercentBps: Number(percentToBps(input.gstPercent)),
    maintenanceCharge: rupeesToPaise(input.maintenanceCharge),
    documentationPercentBps: Number(percentToBps(input.documentationPercent)),
  });

  const bookingId = genId();
  const bookingRow = {
    id: bookingId,
    customerId: input.customerId,
    bookingDate: input.bookingDate,
    projectName: input.projectName || null,
    propertyType: input.propertyType,
    propertyNumber: input.propertyNumber || null,
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
