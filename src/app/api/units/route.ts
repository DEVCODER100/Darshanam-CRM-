import { NextResponse } from "next/server";
import { db } from "@/db";
import { units, auditLog } from "@/db/schema";
import { requireCapability } from "@/lib/rbac";
import { auditEntry } from "@/lib/audit";
import { parseBody } from "@/lib/api";
import { unitCreateSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

// POST /api/units — add one unit, or many at once (count + start). Admin only.
// Existing units with the same project + type + number are skipped, not duplicated.
export async function POST(req: Request) {
  const gate = await requireCapability("unit:manage");
  if (!gate.ok) return gate.response;

  const parsed = await parseBody(req, unitCreateSchema);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  const numbers: string[] = input.count
    ? Array.from({ length: input.count }, (_, i) => String(input.start + i))
    : [input.unitNumber as string];

  const created = await db
    .insert(units)
    .values(
      numbers.map((unitNumber) => ({
        projectName: input.projectName,
        unitType: input.unitType,
        unitNumber,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: units.id });

  await db.insert(auditLog).values(
    auditEntry({
      userId: gate.user.id,
      action: "create",
      entityType: "unit",
      entityId: created[0]?.id ?? null,
      after: {
        projectName: input.projectName,
        unitType: input.unitType,
        requested: numbers.length,
        created: created.length,
      },
    }),
  );

  return NextResponse.json(
    { requested: numbers.length, created: created.length },
    { status: 201 },
  );
}
