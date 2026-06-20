/**
 * seed-more.ts — adds ~21 sample bookings (villas, flats, shops) across several
 * customers with realistic Indian real-estate numbers, instalment plans, and a
 * spread of payment states (fully paid / partial / overdue / advance / none).
 * Idempotent-ish: safe to run once. Requires DATABASE_URL in .env.local.
 *
 *   npx tsx src/db/seed-more.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";
import { computeCost } from "../lib/cost";
import { rupeesToPaise, percentToBps } from "../lib/money";

const db = drizzle(neon(process.env.DATABASE_URL!), { schema });

interface CustomerSeed {
  fullName: string;
  mobile: string;
  aadhaarPanMasked: string;
  address: string;
}

const customers: CustomerSeed[] = [
  { fullName: "Anil Sharma", mobile: "9810012345", aadhaarPanMasked: "XXXXXXXX4521", address: "Banjara Hills, Hyderabad" },
  { fullName: "Priya Nair", mobile: "9820045678", aadhaarPanMasked: "XXXXXXXX8890", address: "Indiranagar, Bengaluru" },
  { fullName: "Mohan Reddy", mobile: "9830078901", aadhaarPanMasked: "XXXXXX7765F", address: "Gachibowli, Hyderabad" },
  { fullName: "Sunita Patel", mobile: "9840023456", aadhaarPanMasked: "XXXXXXXX1102", address: "Satellite, Ahmedabad" },
  { fullName: "Imran Khan", mobile: "9850067890", aadhaarPanMasked: "XXXXXX4432K", address: "Madhapur, Hyderabad" },
  { fullName: "Lakshmi Iyer", mobile: "9860011223", aadhaarPanMasked: "XXXXXXXX9087", address: "Adyar, Chennai" },
  { fullName: "Vikram Singh", mobile: "9870034455", aadhaarPanMasked: "XXXXXX1190S", address: "Kondapur, Hyderabad" },
  { fullName: "Deepa Menon", mobile: "9880056677", aadhaarPanMasked: "XXXXXXXX3321", address: "Whitefield, Bengaluru" },
  { fullName: "Rohit Gupta", mobile: "9890078899", aadhaarPanMasked: "XXXXXX6654G", address: "Kukatpally, Hyderabad" },
  { fullName: "Fatima Sheikh", mobile: "9900090011", aadhaarPanMasked: "XXXXXXXX5540", address: "Begumpet, Hyderabad" },
  { fullName: "Suresh Rao", mobile: "9911002233", aadhaarPanMasked: "XXXXXX2218R", address: "Jubilee Hills, Hyderabad" },
  { fullName: "Neha Joshi", mobile: "9922004455", aadhaarPanMasked: "XXXXXXXX7763", address: "Koramangala, Bengaluru" },
];

interface BookingSeed {
  cust: number; // index into customers
  type: "Villa" | "Flat" | "Shop";
  number: string;
  base: string; // rupees
  gst: string; // percent
  maint: string; // rupees
  doc: string; // percent
  finance: "self_funded" | "loan";
  date: string;
  schedule: { due: string; amt: string; label: string }[];
  payments: { date: string; amt: string }[];
}

// Reference "today" for the app is 2026-06-17.
const bookings: BookingSeed[] = [
  // ---- Villas ----
  { cust: 0, type: "Villa", number: "V-101", base: "15000000", gst: "5", maint: "600000", doc: "5.9", finance: "loan", date: "2025-09-10",
    schedule: [{ due: "2025-09-15", amt: "3000000", label: "Booking" }, { due: "2026-01-20", amt: "6000000", label: "Slab" }, { due: "2026-09-10", amt: "8517000", label: "Handover" }],
    payments: [{ date: "2025-09-14", amt: "3000000" }, { date: "2026-01-22", amt: "6000000" }] },
  { cust: 2, type: "Villa", number: "V-102", base: "18000000", gst: "5", maint: "700000", doc: "5.9", finance: "loan", date: "2025-11-05",
    schedule: [{ due: "2025-11-10", amt: "4000000", label: "Booking" }, { due: "2026-05-15", amt: "7000000", label: "Slab" }, { due: "2026-12-01", amt: "9762000", label: "Handover" }],
    payments: [{ date: "2025-11-09", amt: "4000000" }] },
  { cust: 6, type: "Villa", number: "V-103", base: "12500000", gst: "5", maint: "500000", doc: "5", finance: "self_funded", date: "2026-02-01",
    schedule: [{ due: "2026-02-05", amt: "5000000", label: "Booking" }, { due: "2026-07-10", amt: "8750000", label: "Handover" }],
    payments: [{ date: "2026-02-04", amt: "5000000" }, { date: "2026-03-01", amt: "2000000" }] },
  { cust: 10, type: "Villa", number: "V-104", base: "19500000", gst: "5", maint: "800000", doc: "5.9", finance: "loan", date: "2026-03-12",
    schedule: [{ due: "2026-03-18", amt: "5000000", label: "Booking" }, { due: "2026-08-20", amt: "8000000", label: "Slab" }, { due: "2027-01-15", amt: "8425000", label: "Handover" }],
    payments: [{ date: "2026-03-17", amt: "5000000" }] },
  { cust: 1, type: "Villa", number: "V-105", base: "14000000", gst: "5", maint: "550000", doc: "5", finance: "self_funded", date: "2026-05-02",
    schedule: [{ due: "2026-05-08", amt: "4000000", label: "Booking" }, { due: "2026-11-10", amt: "10250000", label: "Handover" }],
    payments: [{ date: "2026-05-07", amt: "6000000" }] },
  { cust: 7, type: "Villa", number: "V-106", base: "16500000", gst: "5", maint: "650000", doc: "5.9", finance: "loan", date: "2026-06-01",
    schedule: [{ due: "2026-06-25", amt: "5000000", label: "Booking" }, { due: "2026-12-20", amt: "12798500", label: "Handover" }],
    payments: [] },
  // ---- Flats ----
  { cust: 3, type: "Flat", number: "F-201", base: "6500000", gst: "5", maint: "200000", doc: "1", finance: "loan", date: "2025-08-15",
    schedule: [{ due: "2025-08-20", amt: "1500000", label: "Booking" }, { due: "2026-02-20", amt: "2500000", label: "Slab" }, { due: "2026-08-15", amt: "2990000", label: "Handover" }],
    payments: [{ date: "2025-08-19", amt: "1500000" }, { date: "2026-02-21", amt: "2500000" }] },
  { cust: 5, type: "Flat", number: "F-202", base: "8500000", gst: "5", maint: "250000", doc: "1", finance: "loan", date: "2025-10-10",
    schedule: [{ due: "2025-10-15", amt: "2000000", label: "Booking" }, { due: "2026-04-15", amt: "3500000", label: "Slab" }, { due: "2026-10-10", amt: "3510000", label: "Handover" }],
    payments: [{ date: "2025-10-14", amt: "2000000" }] },
  { cust: 8, type: "Flat", number: "F-203", base: "4800000", gst: "5", maint: "150000", doc: "1", finance: "self_funded", date: "2026-01-20",
    schedule: [{ due: "2026-01-25", amt: "1500000", label: "Booking" }, { due: "2026-06-30", amt: "3438000", label: "Handover" }],
    payments: [{ date: "2026-01-24", amt: "1500000" }] },
  { cust: 11, type: "Flat", number: "F-204", base: "7200000", gst: "5", maint: "220000", doc: "1", finance: "loan", date: "2026-03-05",
    schedule: [{ due: "2026-03-10", amt: "2000000", label: "Booking" }, { due: "2026-09-15", amt: "5652000", label: "Handover" }],
    payments: [{ date: "2026-03-09", amt: "2000000" }] },
  { cust: 4, type: "Flat", number: "F-205", base: "9000000", gst: "5", maint: "300000", doc: "1", finance: "loan", date: "2026-04-18",
    schedule: [{ due: "2026-04-25", amt: "2500000", label: "Booking" }, { due: "2026-10-25", amt: "7250000", label: "Handover" }],
    payments: [{ date: "2026-04-24", amt: "2500000" }, { date: "2026-05-20", amt: "1000000" }] },
  { cust: 9, type: "Flat", number: "F-206", base: "5500000", gst: "5", maint: "180000", doc: "1", finance: "self_funded", date: "2026-05-22",
    schedule: [{ due: "2026-05-28", amt: "1800000", label: "Booking" }, { due: "2026-11-28", amt: "4035000", label: "Handover" }],
    payments: [{ date: "2026-05-27", amt: "1800000" }] },
  { cust: 1, type: "Flat", number: "F-207", base: "7800000", gst: "5", maint: "240000", doc: "1", finance: "loan", date: "2026-06-05",
    schedule: [{ due: "2026-06-30", amt: "2200000", label: "Booking" }, { due: "2026-12-30", amt: "6068000", label: "Handover" }],
    payments: [] },
  // ---- Shops ----
  { cust: 2, type: "Shop", number: "S-11", base: "3500000", gst: "12", maint: "120000", doc: "1", finance: "self_funded", date: "2025-07-12",
    schedule: [{ due: "2025-07-18", amt: "1000000", label: "Booking" }, { due: "2026-01-18", amt: "3155000", label: "Handover" }],
    payments: [{ date: "2025-07-17", amt: "1000000" }, { date: "2026-01-19", amt: "3155000" }] },
  { cust: 4, type: "Shop", number: "S-12", base: "5000000", gst: "12", maint: "150000", doc: "1", finance: "loan", date: "2025-12-01",
    schedule: [{ due: "2025-12-05", amt: "1500000", label: "Booking" }, { due: "2026-06-05", amt: "4300000", label: "Handover" }],
    payments: [{ date: "2025-12-04", amt: "1500000" }] },
  { cust: 6, type: "Shop", number: "S-13", base: "2800000", gst: "12", maint: "100000", doc: "1", finance: "self_funded", date: "2026-02-14",
    schedule: [{ due: "2026-02-20", amt: "900000", label: "Booking" }, { due: "2026-08-20", amt: "2564000", label: "Handover" }],
    payments: [{ date: "2026-02-19", amt: "900000" }] },
  { cust: 9, type: "Shop", number: "S-14", base: "6200000", gst: "12", maint: "200000", doc: "1", finance: "loan", date: "2026-03-28",
    schedule: [{ due: "2026-04-02", amt: "1800000", label: "Booking" }, { due: "2026-10-02", amt: "5206000", label: "Handover" }],
    payments: [{ date: "2026-04-01", amt: "1800000" }] },
  { cust: 11, type: "Shop", number: "S-15", base: "4200000", gst: "12", maint: "140000", doc: "1", finance: "self_funded", date: "2026-05-10",
    schedule: [{ due: "2026-05-16", amt: "1300000", label: "Booking" }, { due: "2026-11-16", amt: "3686000", label: "Handover" }],
    payments: [{ date: "2026-05-15", amt: "1300000" }] },
  { cust: 5, type: "Shop", number: "S-16", base: "3000000", gst: "12", maint: "110000", doc: "1", finance: "self_funded", date: "2026-06-08",
    schedule: [{ due: "2026-06-14", amt: "1000000", label: "Booking" }, { due: "2026-12-14", amt: "2470000", label: "Handover" }],
    payments: [{ date: "2026-06-13", amt: "1500000" }] },
  { cust: 10, type: "Shop", number: "S-17", base: "5800000", gst: "12", maint: "190000", doc: "1", finance: "loan", date: "2026-06-12",
    schedule: [{ due: "2026-07-01", amt: "1700000", label: "Booking" }, { due: "2027-01-01", amt: "4986000", label: "Handover" }],
    payments: [] },
];

async function main() {
  console.log(`Seeding ${customers.length} customers and ${bookings.length} bookings...`);

  // Insert customers, keep their generated ids by index.
  const customerIds: string[] = [];
  for (const c of customers) {
    const [row] = await db
      .insert(schema.customers)
      .values({ ...c, createdBy: null })
      .returning({ id: schema.customers.id });
    customerIds.push(row.id);
  }

  let count = 0;
  for (const b of bookings) {
    const [bk] = await db
      .insert(schema.bookings)
      .values({
        customerId: customerIds[b.cust],
        bookingDate: b.date,
        propertyType: b.type,
        propertyNumber: b.number,
        financeType: b.finance,
        createdBy: null,
      })
      .returning({ id: schema.bookings.id });

    const cost = computeCost({
      baseCost: rupeesToPaise(b.base),
      gstPercentBps: Number(percentToBps(b.gst)),
      maintenanceCharge: rupeesToPaise(b.maint),
      documentationPercentBps: Number(percentToBps(b.doc)),
    });
    await db.insert(schema.propertyCosts).values({
      bookingId: bk.id,
      baseCost: cost.baseCost,
      gstPercentBps: cost.gstPercentBps,
      gstAmount: cost.gstAmount,
      maintenanceCharge: cost.maintenanceCharge,
      documentationPercentBps: cost.documentationPercentBps,
      documentationAmount: cost.documentationAmount,
      totalCost: cost.totalCost,
    });

    if (b.schedule.length) {
      await db.insert(schema.paymentSchedule).values(
        b.schedule.map((s) => ({
          bookingId: bk.id,
          dueDate: s.due,
          amount: rupeesToPaise(s.amt),
          label: s.label,
        })),
      );
    }
    if (b.payments.length) {
      await db.insert(schema.payments).values(
        b.payments.map((p, i) => ({
          bookingId: bk.id,
          paymentDate: p.date,
          amount: rupeesToPaise(p.amt),
          mode: "bank_transfer" as const,
          referenceNumber: `NEFT-${b.number}-${i + 1}`,
          createdBy: null,
        })),
      );
    }
    count += 1;
  }

  console.log(`Done. Inserted ${customers.length} customers and ${count} bookings.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
