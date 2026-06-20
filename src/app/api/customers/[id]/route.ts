import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { customers, auditLog } from "@/db/schema";
import { requireAuth, requireCapability } from "@/lib/rbac";
import { auditEntry } from "@/lib/audit";
import { parseBody, jsonError } from "@/lib/api";
import { customerUpdateSchema } from "@/lib/validators";
import { maskSensitive } from "@/lib/masking";

type Params = { params: { id: string } };

// GET /api/customers/[id]
export async function GET(_req: Request, { params }: Params) {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;

  const row = await db.query.customers.findFirst({
    where: eq(customers.id, params.id),
  });
  if (!row) return jsonError("Customer not found", 404);
  return NextResponse.json({ customer: row });
}

// PATCH /api/customers/[id] — edit (customer:edit).
export async function PATCH(req: Request, { params }: Params) {
  const gate = await requireCapability("customer:edit");
  if (!gate.ok) return gate.response;

  const parsed = await parseBody(req, customerUpdateSchema);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  const before = await db.query.customers.findFirst({
    where: eq(customers.id, params.id),
  });
  if (!before) return jsonError("Customer not found", 404);

  const update: Partial<typeof customers.$inferInsert> = {};
  if (input.fullName !== undefined) update.fullName = input.fullName;
  if (input.mobile !== undefined) update.mobile = input.mobile;
  if (input.alternateMobile !== undefined)
    update.alternateMobile = input.alternateMobile || null;
  if (input.email !== undefined) update.email = input.email || null;
  if (input.address !== undefined) update.address = input.address || null;
  if (input.panNumber !== undefined)
    update.panMasked = input.panNumber ? maskSensitive(input.panNumber) : null;
  if (input.aadhaarNumber !== undefined)
    update.aadhaarMasked = input.aadhaarNumber
      ? maskSensitive(input.aadhaarNumber)
      : null;
  if (input.salesExecutive !== undefined)
    update.salesExecutive = input.salesExecutive || null;
  if (input.notes !== undefined) update.notes = input.notes || null;

  const after = { ...before, ...update };

  try {
    await db.batch([
      db.update(customers).set(update).where(eq(customers.id, params.id)),
      db.insert(auditLog).values(
        auditEntry({
          userId: gate.user.id,
          action: "update",
          entityType: "customer",
          entityId: params.id,
          before,
          after,
        }),
      ),
    ]);
  } catch (err) {
    console.error(err);
    return jsonError("Failed to update customer", 500);
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/customers/[id] — delete (customer:delete, admin only).
export async function DELETE(_req: Request, { params }: Params) {
  const gate = await requireCapability("customer:delete");
  if (!gate.ok) return gate.response;

  const before = await db.query.customers.findFirst({
    where: eq(customers.id, params.id),
  });
  if (!before) return jsonError("Customer not found", 404);

  try {
    await db.batch([
      db.delete(customers).where(eq(customers.id, params.id)),
      db.insert(auditLog).values(
        auditEntry({
          userId: gate.user.id,
          action: "delete",
          entityType: "customer",
          entityId: params.id,
          before,
        }),
      ),
    ]);
  } catch (err) {
    console.error(err);
    return jsonError("Failed to delete customer", 500);
  }

  return NextResponse.json({ ok: true });
}
