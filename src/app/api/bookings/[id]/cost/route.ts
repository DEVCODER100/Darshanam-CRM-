import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { propertyCosts, auditLog } from "@/db/schema";
import { requireCapability } from "@/lib/rbac";
import { auditEntry } from "@/lib/audit";
import { parseBody, jsonError } from "@/lib/api";
import { costUpdateSchema } from "@/lib/validators";
import { computeCost } from "@/lib/cost";
import { rupeesToPaise, percentToBps } from "@/lib/money";

type Params = { params: { id: string } };

// PATCH /api/bookings/[id]/cost — edit the cost structure (cost:edit).
// Stores both percent and recomputed amounts (PRD §6).
export async function PATCH(req: Request, { params }: Params) {
  const gate = await requireCapability("cost:edit");
  if (!gate.ok) return gate.response;

  const parsed = await parseBody(req, costUpdateSchema);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  const before = await db.query.propertyCosts.findFirst({
    where: eq(propertyCosts.bookingId, params.id),
  });
  if (!before) return jsonError("Cost structure not found", 404);

  const cost = computeCost({
    baseCost: rupeesToPaise(input.baseCost),
    extraCharges: rupeesToPaise(input.extraCharges),
    discount: rupeesToPaise(input.discount),
    gstPercentBps: Number(percentToBps(input.gstPercent)),
    maintenanceCharge: rupeesToPaise(input.maintenanceCharge),
    documentationPercentBps: Number(percentToBps(input.documentationPercent)),
  });

  const update = {
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
  const after = { ...before, ...update };

  try {
    await db.batch([
      db
        .update(propertyCosts)
        .set(update)
        .where(eq(propertyCosts.bookingId, params.id)),
      db.insert(auditLog).values(
        auditEntry({
          userId: gate.user.id,
          action: "update",
          entityType: "property_cost",
          entityId: before.id,
          before,
          after,
        }),
      ),
    ]);
  } catch (err) {
    console.error(err);
    return jsonError("Failed to update cost", 500);
  }

  return NextResponse.json({ ok: true });
}
