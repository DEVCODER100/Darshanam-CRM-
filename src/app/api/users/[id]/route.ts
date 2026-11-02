import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, auditLog } from "@/db/schema";
import { requireCapability } from "@/lib/rbac";
import { auditEntry } from "@/lib/audit";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  role: z.enum(["admin", "accountant", "sales_executive", "manager"]),
});

/** PATCH /api/users/[id] — change a user's role (admin only) */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const gate = await requireCapability("user:manage");
  if (!gate.ok) return gate.response;

  // Prevent admin from downgrading themselves
  if (params.id === gate.user.id) {
    return NextResponse.json(
      { error: "You cannot change your own role." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid role value." }, { status: 400 });
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.id, params.id),
  });
  if (!existing) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const [updated] = await db
    .update(users)
    .set({ role: parsed.data.role })
    .where(eq(users.id, params.id))
    .returning();

  await db.insert(auditLog).values(
    auditEntry({
      userId: gate.user.id,
      action: "update",
      entityType: "user",
      entityId: params.id,
      before: { role: existing.role },
      after: { role: parsed.data.role },
    })
  );

  return NextResponse.json(updated);
}

/** DELETE /api/users/[id] — remove a team member (admin only) */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const gate = await requireCapability("user:manage");
  if (!gate.ok) return gate.response;

  if (params.id === gate.user.id) {
    return NextResponse.json(
      { error: "You cannot remove yourself." },
      { status: 400 }
    );
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.id, params.id),
  });
  if (!existing) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  await db.delete(users).where(eq(users.id, params.id));

  await db.insert(auditLog).values(
    auditEntry({
      userId: gate.user.id,
      action: "delete",
      entityType: "user",
      entityId: params.id,
      before: { name: existing.name, email: existing.email, role: existing.role },
      after: null,
    })
  );

  return NextResponse.json({ ok: true });
}
