import { asc, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, customers, projects, units } from "@/db/schema";
import { getCurrentUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { ProjectsAdmin } from "@/components/ProjectsAdmin";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const user = await getCurrentUser();
  const countBy = (table: typeof units | typeof customers | typeof bookings) =>
    db.select({ id: table.projectId, n: sql<number>`count(*)::int` }).from(table).groupBy(table.projectId);
  const [list, u, c, b] = await Promise.all([
    db.select().from(projects).orderBy(asc(projects.name), asc(projects.area)),
    countBy(units),
    countBy(customers),
    countBy(bookings),
  ]);
  const count = (rows: { id: string | null; n: number }[], id: string) => rows.find((r) => r.id === id)?.n ?? 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-medium">Projects</h1>
        <p className="text-sm text-muted">
          Each construction area is its own project with its own units, clients, bookings, maps and reports. Switch
          between them with the Project box at the top.
        </p>
      </div>
      <ProjectsAdmin
        canManage={!!user && can(user.role, "project:manage")}
        rows={list.map((p) => ({ ...p, units: count(u, p.id), clients: count(c, p.id), bookings: count(b, p.id) }))}
      />
    </div>
  );
}
