/**
 * backfill-units.ts — one-off, idempotent: creates a unit for every booking that
 * has none, and links the booking to it. Safe to run more than once.
 *   npx tsx src/db/backfill-units.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import { bookings, units } from "./schema";

(async () => {
  const todo = await db.select().from(bookings).where(isNull(bookings.unitId));
  let created = 0;
  let linked = 0;
  for (const b of todo) {
    const project = b.projectName ?? "";
    const number = b.propertyNumber ?? `(${b.id.slice(0, 6)})`;
    let unit = (
      await db
        .select()
        .from(units)
        .where(
          and(
            eq(units.projectName, project),
            eq(units.unitType, b.propertyType),
            eq(units.unitNumber, number),
          ),
        )
    )[0];
    if (!unit) {
      [unit] = await db
        .insert(units)
        .values({ projectName: project, unitType: b.propertyType, unitNumber: number })
        .returning();
      created++;
    }
    await db.update(bookings).set({ unitId: unit.id }).where(eq(bookings.id, b.id));
    linked++;
  }
  console.log(`bookings without a unit: ${todo.length}; units created: ${created}; bookings linked: ${linked}`);
})();
