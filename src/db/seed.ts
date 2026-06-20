/**
 * seed.ts — sample data mirroring the PRD examples. Requires DATABASE_URL.
 * Run after migrations:  npm run db:migrate && npm run db:seed
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";
import { computeCost } from "../lib/cost";
import { rupeesToPaise } from "../lib/money";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const db = drizzle(neon(url), { schema });

  console.log("Seeding...");

  // No user row is seeded — that would defeat the first-user/admin bootstrap and
  // the ADMIN_EMAILS allowlist. Sample rows are left with no creator.
  const createdBy = null;

  const [customer] = await db
    .insert(schema.customers)
    .values({
      fullName: "Ramesh Kumar",
      mobile: "9876543210",
      email: "ramesh@example.com",
      aadhaarPanMasked: "XXXXXXXX1234",
      address: "Plot 12, Jubilee Hills, Hyderabad",
      createdBy,
    })
    .returning();

  const [booking] = await db
    .insert(schema.bookings)
    .values({
      customerId: customer.id,
      bookingDate: "2026-06-01",
      propertyType: "Villa",
      propertyNumber: "V-204",
      bookingAddress: "Darshanam Greens, Phase 2",
      financeType: "self_funded",
      createdBy,
    })
    .returning();

  // Villa cost (PRD §6): base 1,30,00,000 + GST 5% + maint 5,00,000 + doc 5.9%.
  const cost = computeCost({
    baseCost: rupeesToPaise("13000000"),
    gstPercentBps: 500,
    maintenanceCharge: rupeesToPaise("500000"),
    documentationPercentBps: 590,
  });

  await db.insert(schema.propertyCosts).values({
    bookingId: booking.id,
    baseCost: cost.baseCost,
    gstPercentBps: cost.gstPercentBps,
    gstAmount: cost.gstAmount,
    maintenanceCharge: cost.maintenanceCharge,
    documentationPercentBps: cost.documentationPercentBps,
    documentationAmount: cost.documentationAmount,
    totalCost: cost.totalCost,
  });

  // Schedule: June 20L, October 40L, February 60L.
  await db.insert(schema.paymentSchedule).values([
    { bookingId: booking.id, dueDate: "2026-06-20", amount: rupeesToPaise("2000000"), label: "Booking instalment" },
    { bookingId: booking.id, dueDate: "2026-10-15", amount: rupeesToPaise("4000000"), label: "Slab instalment" },
    { bookingId: booking.id, dueDate: "2027-02-10", amount: rupeesToPaise("6000000"), label: "Handover instalment" },
  ]);

  // One payment of 20L.
  await db.insert(schema.payments).values({
    bookingId: booking.id,
    paymentDate: "2026-06-18",
    amount: rupeesToPaise("2000000"),
    mode: "bank_transfer",
    referenceNumber: "NEFT-0001",
    createdBy,
  });

  console.log("Seed complete. Booking:", booking.id);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
