/**
 * import-xlsx.ts — one-off importer for the villa tracking spreadsheet.
 * Maps each row to a customer + villa booking + cost (5% GST, 5.9% docs) +
 * the amount collected so far (as one payment) + a loan record when a bank
 * loan is present. Customers are de-duplicated by name.
 *
 *   npx tsx src/db/import-xlsx.ts "C:/Users/hp/Downloads/Untitled spreadsheet-6.xlsx"
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import ExcelJS from "exceljs";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";
import { computeCost } from "../lib/cost";
import { rupeesToPaise } from "../lib/money";

const db = drizzle(neon(process.env.DATABASE_URL!), { schema });
const FILE =
  process.argv[2] ?? "C:/Users/hp/Downloads/Untitled spreadsheet-6.xlsx";

// Column positions (1-based) from the sheet header.
const COL = {
  type: 2,
  unit: 3,
  bookingDate: 4,
  name: 5,
  base: 6,
  doc: 8,
  maint: 9,
  bankLoan: 11,
  collection: 14,
  paymentDate: 18,
  banakhatNo: 21,
  banakhatDate: 22,
};

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v;
  if (typeof v === "object") {
    const r = (v as { result?: unknown }).result;
    return typeof r === "number" ? r : null;
  }
  if (typeof v === "string") {
    const s = v.replace(/,/g, "").trim();
    if (s === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function isoDate(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
    const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m) {
      let [, d, mo, y] = m;
      if (y.length === 2) y = "20" + y;
      return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
  }
  return null;
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "object" && (v as { text?: string }).text)
    return String((v as { text: string }).text).trim();
  const s = String(v).trim();
  return s === "" ? null : s;
}

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(FILE);
  const ws = wb.worksheets[0];

  const customerIds = new Map<string, string>();
  let bookingCount = 0;
  let paymentCount = 0;
  let loanCount = 0;

  for (let n = 2; n <= ws.rowCount; n++) {
    const row = ws.getRow(n);
    const name = str(row.getCell(COL.name).value);
    const base = num(row.getCell(COL.base).value);
    if (!name || !base) continue; // skip header/empty rows

    // Customer (de-duplicate by name).
    let customerId = customerIds.get(name.toLowerCase());
    if (!customerId) {
      const [c] = await db
        .insert(schema.customers)
        .values({ fullName: name, mobile: "—", createdBy: null })
        .returning({ id: schema.customers.id });
      customerId = c.id;
      customerIds.set(name.toLowerCase(), customerId);
    }

    const unit = str(row.getCell(COL.unit).value);
    const type = str(row.getCell(COL.type).value);
    const bookingDate =
      isoDate(row.getCell(COL.bookingDate).value) ?? "2024-01-01";
    const maint = num(row.getCell(COL.maint).value) ?? 0;
    const bankLoan = num(row.getCell(COL.bankLoan).value);
    const collection = num(row.getCell(COL.collection).value) ?? 0;
    const paymentDate =
      isoDate(row.getCell(COL.paymentDate).value) ?? bookingDate;

    const [bk] = await db
      .insert(schema.bookings)
      .values({
        customerId,
        bookingDate,
        propertyType: "Villa",
        propertyNumber: [unit, type].filter(Boolean).join(" · ") || null,
        financeType: bankLoan && bankLoan > 0 ? "loan" : "self_funded",
        createdBy: null,
      })
      .returning({ id: schema.bookings.id });
    bookingCount++;

    // Cost: 5% GST, 5.9% documentation (4.9% + 1%), maintenance deposit.
    const cost = computeCost({
      baseCost: rupeesToPaise(base),
      gstPercentBps: 500,
      maintenanceCharge: rupeesToPaise(maint),
      documentationPercentBps: 590,
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

    // Schedule: full consideration due as of booking date (historical import).
    await db.insert(schema.paymentSchedule).values({
      bookingId: bk.id,
      dueDate: bookingDate,
      amount: cost.totalCost,
      label: "Full consideration",
    });

    // Collected-so-far as one payment.
    if (collection > 0) {
      await db.insert(schema.payments).values({
        bookingId: bk.id,
        paymentDate,
        amount: rupeesToPaise(collection),
        mode: "bank_transfer",
        referenceNumber: str(row.getCell(COL.banakhatNo).value),
        notes: "Imported: collection as on date",
        createdBy: null,
      });
      paymentCount++;
    }

    // Loan record when a bank loan amount is present.
    if (bankLoan && bankLoan > 0) {
      await db.insert(schema.loans).values({
        bookingId: bk.id,
        status: "approved",
        loanAmount: rupeesToPaise(bankLoan),
        referenceNumber: str(row.getCell(COL.banakhatNo).value),
        approvalDate: isoDate(row.getCell(COL.banakhatDate).value),
      });
      loanCount++;
    }
  }

  console.log(
    `Imported: ${customerIds.size} customers, ${bookingCount} bookings, ${paymentCount} payments, ${loanCount} loans.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
