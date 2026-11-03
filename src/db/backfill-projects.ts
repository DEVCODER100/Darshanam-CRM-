/**
 * backfill-projects.ts — one-off, idempotent: puts every unit, client, booking and
 * map that has no project into "Splendora 3 – Construction Area 2". Run it again
 * after a deploy to catch rows created by the old code during the switch-over.
 *   npx tsx src/db/backfill-projects.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { bookings, customers, projects, siteMaps, units } from "./schema";
import { projectLabel } from "../lib/project-label";

const NAME = "Splendora 3";
const AREA = "Construction Area 2";

(async () => {
  // Units must stay unique by (type, number) inside the project: stop if merging would clash.
  const clashes = await db
    .select({ type: units.unitType, number: units.unitNumber, n: sql<number>`count(*)::int` })
    .from(units)
    .where(isNull(units.projectId))
    .groupBy(units.unitType, units.unitNumber)
    .having(sql`count(*) > 1`);
  if (clashes.length) {
    console.error("These units would clash in one project; rename them first:", clashes);
    process.exit(1);
  }

  let project = (await db.select().from(projects).where(and(eq(projects.name, NAME), eq(projects.area, AREA))))[0];
  if (!project) [project] = await db.insert(projects).values({ name: NAME, area: AREA }).returning();
  const label = projectLabel(project);

  const [u, c, b, m] = await db.batch([
    db.update(units).set({ projectId: project.id, projectName: label }).where(isNull(units.projectId)).returning({ id: units.id }),
    db.update(customers).set({ projectId: project.id }).where(isNull(customers.projectId)).returning({ id: customers.id }),
    db.update(bookings).set({ projectId: project.id, projectName: label }).where(isNull(bookings.projectId)).returning({ id: bookings.id }),
    db.update(siteMaps).set({ projectId: project.id, projectName: label }).where(isNull(siteMaps.projectId)).returning({ id: siteMaps.id }),
  ]);
  console.log(`${label}: moved ${u.length} units, ${c.length} clients, ${b.length} bookings, ${m.length} maps.`);
})();
