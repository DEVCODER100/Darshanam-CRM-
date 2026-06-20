import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { customers, auditLog } from "@/db/schema";
import { requireAuth, requireCapability } from "@/lib/rbac";
import { auditEntry } from "@/lib/audit";
import { parseBody, genId, jsonError } from "@/lib/api";
import { customerCreateSchema } from "@/lib/validators";
import { maskSensitive } from "@/lib/masking";

// GET /api/customers — list (any authenticated staff).
export async function GET() {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;

  const rows = await db
    .select()
    .from(customers)
    .orderBy(desc(customers.createdAt));
  return NextResponse.json({ customers: rows });
}

// POST /api/customers — create (customer:create).
export async function POST(req: Request) {
  const gate = await requireCapability("customer:create");
  if (!gate.ok) return gate.response;

  const parsed = await parseBody(req, customerCreateSchema);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  const id = genId();
  const row = {
    id,
    fullName: input.fullName,
    mobile: input.mobile,
    alternateMobile: input.alternateMobile || null,
    email: input.email || null,
    panMasked: input.panNumber ? maskSensitive(input.panNumber) : null,
    aadhaarMasked: input.aadhaarNumber
      ? maskSensitive(input.aadhaarNumber)
      : null,
    address: input.address || null,
    salesExecutive: input.salesExecutive || null,
    notes: input.notes || null,
    createdBy: gate.user.id,
  };

  try {
    // Mutation + audit row run atomically as one Neon HTTP transaction.
    await db.batch([
      db.insert(customers).values(row),
      db.insert(auditLog).values(
        auditEntry({
          userId: gate.user.id,
          action: "create",
          entityType: "customer",
          entityId: id,
          after: row,
        }),
      ),
    ]);
  } catch (err) {
    console.error(err);
    return jsonError("Failed to create customer", 500);
  }

  return NextResponse.json({ id }, { status: 201 });
}
