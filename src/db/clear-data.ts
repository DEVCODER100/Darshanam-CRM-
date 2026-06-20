/**
 * clear-data.ts — wipes all business data (customers, bookings, costs,
 * schedules, payments, loans) for a clean test slate. KEEPS users (admins) and
 * the audit_log. Deletes child rows first so it works regardless of cascade.
 *
 *   npx tsx src/db/clear-data.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import * as schema from "./schema";

const db = drizzle(neon(process.env.DATABASE_URL!), { schema });

async function count(table: any): Promise<number> {
  const [r] = await db.select({ c: sql<number>`count(*)::int` }).from(table);
  return r.c;
}

async function main() {
  const before = {
    customers: await count(schema.customers),
    bookings: await count(schema.bookings),
    payments: await count(schema.payments),
  };
  console.log("Before:", before);

  // Child rows first, then parents.
  await db.delete(schema.payments);
  await db.delete(schema.paymentSchedule);
  await db.delete(schema.propertyCosts);
  await db.delete(schema.loans);
  await db.delete(schema.bookings);
  await db.delete(schema.customers);

  const after = {
    customers: await count(schema.customers),
    bookings: await count(schema.bookings),
    payments: await count(schema.payments),
    users_kept: await count(schema.users),
  };
  console.log("After: ", after);
  console.log("Done. Business data cleared; users (admins) preserved.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
