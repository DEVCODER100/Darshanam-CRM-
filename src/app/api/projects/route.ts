import { NextResponse } from "next/server";
import { db } from "@/db";
import { projects, auditLog } from "@/db/schema";
import { requireCapability } from "@/lib/rbac";
import { auditEntry } from "@/lib/audit";
import { parseBody, jsonError } from "@/lib/api";
import { projectSchema } from "@/lib/validators";

// POST /api/projects — create a project (project:manage).
export async function POST(req: Request) {
  const gate = await requireCapability("project:manage");
  if (!gate.ok) return gate.response;

  const parsed = await parseBody(req, projectSchema);
  if (!parsed.ok) return parsed.response;

  const [row] = await db.insert(projects).values(parsed.data).onConflictDoNothing().returning();
  if (!row) return jsonError("A project with that name and area already exists", 409);
  await db.insert(auditLog).values(
    auditEntry({ userId: gate.user.id, action: "create", entityType: "project", entityId: row.id, after: row }),
  );
  return NextResponse.json({ id: row.id }, { status: 201 });
}
