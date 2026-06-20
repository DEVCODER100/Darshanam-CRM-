import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { loans, auditLog } from "@/db/schema";
import { requireAuth, requireCapability } from "@/lib/rbac";
import { auditEntry } from "@/lib/audit";
import { parseBody, genId, jsonError, serializeBigInt } from "@/lib/api";
import { loanUpsertSchema } from "@/lib/validators";
import { rupeesToPaise } from "@/lib/money";

type Params = { params: { id: string } };

// GET /api/bookings/[id]/loan
export async function GET(_req: Request, { params }: Params) {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;
  const loan = await db.query.loans.findFirst({
    where: eq(loans.bookingId, params.id),
  });
  return NextResponse.json(serializeBigInt({ loan: loan ?? null }));
}

// PUT /api/bookings/[id]/loan — create or update the loan record (loan:edit).
export async function PUT(req: Request, { params }: Params) {
  const gate = await requireCapability("loan:edit");
  if (!gate.ok) return gate.response;

  const parsed = await parseBody(req, loanUpsertSchema);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  const existing = await db.query.loans.findFirst({
    where: eq(loans.bookingId, params.id),
  });

  const fields = {
    status: input.status,
    loanAmount: input.loanAmount ? rupeesToPaise(input.loanAmount) : null,
    customerContribution: input.customerContribution
      ? rupeesToPaise(input.customerContribution)
      : null,
    amountReleased: input.amountReleased
      ? rupeesToPaise(input.amountReleased)
      : 0n,
    bankName: input.bankName || null,
    referenceNumber: input.referenceNumber || null,
    sanctionDate: input.sanctionDate || null,
    approvalDate: input.approvalDate || null,
    disbursementDate: input.disbursementDate || null,
  };

  try {
    if (existing) {
      const after = { ...existing, ...fields };
      await db.batch([
        db.update(loans).set(fields).where(eq(loans.bookingId, params.id)),
        db.insert(auditLog).values(
          auditEntry({
            userId: gate.user.id,
            action: "update",
            entityType: "loan",
            entityId: existing.id,
            before: existing,
            after,
          }),
        ),
      ]);
    } else {
      const id = genId();
      const row = { id, bookingId: params.id, ...fields };
      await db.batch([
        db.insert(loans).values(row),
        db.insert(auditLog).values(
          auditEntry({
            userId: gate.user.id,
            action: "create",
            entityType: "loan",
            entityId: id,
            after: row,
          }),
        ),
      ]);
    }
  } catch (err) {
    console.error(err);
    return jsonError("Failed to save loan", 500);
  }

  return NextResponse.json({ ok: true });
}
