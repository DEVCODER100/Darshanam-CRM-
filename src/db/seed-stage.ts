/**
 * seed-stage.ts — loads the 10 stage-payment test customers from the
 * "Customer Payment Status" PDF. Each villa is bank-loan + stage-based, with
 * property cost = total cost (no GST/charges) so eligible = cost × stage %
 * matches the PDF exactly. Received amount is recorded as one bank-release payment.
 *
 *   npx tsx src/db/seed-stage.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";
import { computeCost } from "../lib/cost";
import { rupeesToPaise } from "../lib/money";
import type { ConstructionStage } from "../lib/stage";

const db = drizzle(neon(process.env.DATABASE_URL!), { schema });

interface Seed {
  name: string;
  villa: string;
  mobile: string;
  cost: string; // rupees
  stage: ConstructionStage;
  received: string; // rupees
}

const DATA: Seed[] = [
  { name: "Alex Patel", villa: "V-101", mobile: "9000000101", cost: "10000000", stage: "ground_floor", received: "4500000" },
  { name: "Rahul Shah", villa: "V-102", mobile: "9000000102", cost: "12000000", stage: "first_floor", received: "6600000" },
  { name: "Priya Mehta", villa: "V-103", mobile: "9000000103", cost: "9500000", stage: "plinth", received: "4275000" },
  { name: "Karan Joshi", villa: "V-104", mobile: "9000000104", cost: "15000000", stage: "second_floor", received: "10500000" },
  { name: "Neha Desai", villa: "V-105", mobile: "9000000105", cost: "8500000", stage: "outside_plaster", received: "7650000" },
  { name: "Arjun Singh", villa: "V-106", mobile: "9000000106", cost: "11000000", stage: "flooring", received: "8000000" },
  { name: "Sneha Verma", villa: "V-107", mobile: "9000000107", cost: "9000000", stage: "finishing", received: "9000000" },
  { name: "Vikram Patel", villa: "V-108", mobile: "9000000108", cost: "13000000", stage: "second_floor", received: "5850000" },
  { name: "Riya Kapoor", villa: "V-109", mobile: "9000000109", cost: "7500000", stage: "ground_floor", received: "4125000" },
  { name: "Mohit Jain", villa: "V-110", mobile: "9000000110", cost: "14000000", stage: "flooring", received: "9800000" },
];

async function main() {
  console.log(`Seeding ${DATA.length} stage-payment customers...`);

  for (const d of DATA) {
    const [customer] = await db
      .insert(schema.customers)
      .values({ fullName: d.name, mobile: d.mobile, createdBy: null })
      .returning({ id: schema.customers.id });

    const [booking] = await db
      .insert(schema.bookings)
      .values({
        customerId: customer.id,
        bookingDate: "2026-01-15",
        propertyType: "Villa",
        propertyNumber: d.villa,
        paymentType: "bank_loan",
        financeType: "loan",
        stageBased: true,
        currentStage: d.stage,
        createdBy: null,
      })
      .returning({ id: schema.bookings.id });

    // Property cost = total cost (no GST/docs/maintenance) so eligible = cost × %.
    const cost = computeCost({
      baseCost: rupeesToPaise(d.cost),
      gstPercentBps: 0,
      maintenanceCharge: 0n,
      documentationPercentBps: 0,
    });
    await db.insert(schema.propertyCosts).values({
      bookingId: booking.id,
      baseCost: cost.baseCost,
      extraCharges: 0n,
      discount: 0n,
      agreementValue: cost.agreementValue,
      gstPercentBps: 0,
      gstAmount: 0n,
      maintenanceCharge: 0n,
      documentationPercentBps: 0,
      documentationAmount: 0n,
      totalCost: cost.totalCost,
    });

    if (rupeesToPaise(d.received) > 0n) {
      await db.insert(schema.payments).values({
        bookingId: booking.id,
        paymentDate: "2026-02-01",
        amount: rupeesToPaise(d.received),
        gstAmount: 0n,
        mode: "bank_transfer",
        source: "bank",
        stage: d.stage,
        referenceNumber: `BANK-${d.villa}`,
        notes: "Stage-wise bank release (seed)",
        createdBy: null,
      });
    }
  }

  console.log(`Done. Inserted ${DATA.length} customers, bookings, costs and payments.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
