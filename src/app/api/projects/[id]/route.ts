import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projects, units, bookings, siteMaps, auditLog } from "@/db/schema";
import { requireCapability } from "@/lib/rbac";
import { auditEntry } from "@/lib/audit";
import { parseBody, jsonError } from "@/lib/api";
import { projectPatchSchema } from "@/lib/validators";
import { projectLabel } from "@/lib/project-label";

// PATCH /api/projects/[id] — rename or archive a project (project:manage). Projects are
// never deleted: archiving hides one from the switcher and keeps all its records.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const gate = await requireCapability("project:manage");
  if (!gate.ok) return gate.response;

  const parsed = await parseBody(req, projectPatchSchema);
  if (!parsed.ok) return parsed.response;

  const before = await db.query.projects.findFirst({ where: eq(projects.id, params.id) });
  if (!before) return jsonError("Project not found", 404);
  const after = { ...before, ...parsed.data };
  const label = projectLabel(after);

  try {
    await db.batch([
      db.update(projects).set(parsed.data).where(eq(projects.id, before.id)),
      // Keep the display name stored on records in step with a rename.
      db.update(units).set({ projectName: label }).where(eq(units.projectId, before.id)),
      db.update(bookings).set({ projectName: label }).where(eq(bookings.projectId, before.id)),
      db.update(siteMaps).set({ projectName: label }).where(eq(siteMaps.projectId, before.id)),
      db.insert(auditLog).values(
        auditEntry({ userId: gate.user.id, action: "update", entityType: "project", entityId: before.id, before, after }),
      ),
    ]);
  } catch {
    return jsonError("A project with that name and area already exists", 409);
  }
  return NextResponse.json({ ok: true });
}
