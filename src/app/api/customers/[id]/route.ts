import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { customers, auditLog } from "@/db/schema";
import { panColumns } from "@/lib/pan";
import { publicCustomer } from "@/lib/customer-public";
import { requireAuth, requireCapability } from "@/lib/rbac";
import { auditEntry } from "@/lib/audit";
import { parseBody, jsonError } from "@/lib/api";
import { customerUpdateSchema } from "@/lib/validators";
import { extraColumns } from "@/lib/customer-write";

type Params = { params: { id: string } };

// GET /api/customers/[id]
export async function GET(_req: Request, { params }: Params) {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;

  const row = await db.query.customers.findFirst({
    where: eq(customers.id, params.id),
  });
  if (!row) return jsonError("Customer not found", 404);
  return NextResponse.json({ customer: publicCustomer(row) });
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
  // PAN: blank means "leave it as it is". A new PAN is encrypted and replaces the
  // old one; with no PAN at all, a reason is required.
  if (input.panNumber) {
    try {
      const cols = panColumns(input.panNumber);
      const dup = await db.query.customers.findFirst({
        where: and(
          eq(customers.panHash, cols.panHash),
          before.projectId ? eq(customers.projectId, before.projectId) : undefined,
        ),
        columns: { id: true, fullName: true },
      });
      if (dup && dup.id !== params.id)
        return jsonError(`This PAN is already on file for ${dup.fullName}.`, 409);
      Object.assign(update, cols, { panExemptReason: null });
    } catch (err) {
      console.error(err);
      return jsonError("PAN storage is not configured on the server (PAN_ENCRYPTION_KEY).", 500);
    }
  } else if (input.noPanReason) {
    Object.assign(update, {
      panEncrypted: null,
      panHash: null,
      panMasked: null,
      panExemptReason: input.noPanReason,
    });
  }
  Object.assign(update, extraColumns(input));
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
