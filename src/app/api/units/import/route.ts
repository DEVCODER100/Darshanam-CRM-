import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { units, auditLog } from "@/db/schema";
import { requireCapability } from "@/lib/rbac";
import { auditEntry } from "@/lib/audit";
import { parseBody, jsonError } from "@/lib/api";
import { unitImportSchema } from "@/lib/validators";
import { planImport } from "@/lib/unit-import";

export const dynamic = "force-dynamic";

const CHUNK = 100;

// POST /api/units/import — preview (dryRun) or apply a unit list (unit:manage).
// New units are created and area/floor of existing ones updated; nothing is ever
// deleted and booking/blocking state is never touched.
export async function POST(req: Request) {
  const gate = await requireCapability("unit:manage");
  if (!gate.ok) return gate.response;

  const parsed = await parseBody(req, unitImportSchema);
  if (!parsed.ok) return parsed.response;
  const { rows, dryRun } = parsed.data;

  const existing = await db.select().from(units);
  const plan = planImport(
    rows,
    existing.map((u) => ({
      id: u.id,
      project: u.projectName,
      type: u.unitType,
      number: u.unitNumber,
      area: u.areaSqft,
      floor: u.floor,
    })),
  );
  const summary = { create: plan.create.length, update: plan.update.length, unchanged: plan.unchanged };
  if (dryRun) return NextResponse.json({ ...summary, plan });

  try {
    for (let i = 0; i < plan.create.length; i += CHUNK) {
      await db
        .insert(units)
        .values(
          plan.create.slice(i, i + CHUNK).map((r) => ({
            projectName: r.project,
            unitType: r.type,
            unitNumber: r.number,
            areaSqft: r.area,
            floor: r.floor,
          })),
        )
        .onConflictDoNothing();
    }
    for (let i = 0; i < plan.update.length; i += CHUNK) {
      const [first, ...rest] = plan.update.slice(i, i + CHUNK).map((u) =>
        db
          .update(units)
          .set({
            ...(u.row.area !== null && { areaSqft: u.row.area }),
            ...(u.row.floor !== null && { floor: u.row.floor }),
          })
          .where(eq(units.id, u.id)),
      );
      await db.batch([first, ...rest]);
    }
    await db.insert(auditLog).values(
      auditEntry({
        userId: gate.user.id,
        action: "create",
        entityType: "unit",
        entityId: null,
        after: { import: summary },
      }),
    );
  } catch (err) {
    console.error(err);
    return jsonError("Import failed part-way. Run it again; units already added are skipped.", 500);
  }
  return NextResponse.json(summary, { status: 201 });
}
