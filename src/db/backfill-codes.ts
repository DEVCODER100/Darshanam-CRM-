/**
 * backfill-codes.ts — one-off, idempotent: gives every client (CL001..), booking
 * (BI001..) and payment (PAY2609-XXXXXX) a code if it has none.
 *   npx tsx src/db/backfill-codes.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { asc, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import { bookings, customers, payments } from "./schema";
import { newPaymentNumber, nextCode } from "../lib/codes";

(async () => {
  // clients
  const allCustomers = await db.select().from(customers).orderBy(asc(customers.createdAt));
  const clientCodes = allCustomers.map((c) => c.clientCode);
  let c = 0;
  for (const row of allCustomers.filter((r) => !r.clientCode)) {
    const code = nextCode("CL", clientCodes);
    clientCodes.push(code);
    await db.update(customers).set({ clientCode: code }).where(eq(customers.id, row.id));
    c++;
  }
  // bookings
  const allBookings = await db.select().from(bookings).orderBy(asc(bookings.createdAt));
  const bookingCodes = allBookings.map((b) => b.bookingCode);
  let b = 0;
  for (const row of allBookings.filter((r) => !r.bookingCode)) {
    const code = nextCode("BI", bookingCodes);
    bookingCodes.push(code);
    await db.update(bookings).set({ bookingCode: code }).where(eq(bookings.id, row.id));
    b++;
  }
  // payments
  const missing = await db.select().from(payments).where(isNull(payments.paymentNumber));
  const used = new Set<string>();
  let p = 0;
  for (const row of missing) {
    let num = newPaymentNumber(row.paymentDate);
    while (used.has(num)) num = newPaymentNumber(row.paymentDate);
    used.add(num);
    await db.update(payments).set({ paymentNumber: num }).where(eq(payments.id, row.id));
    p++;
  }
  console.log(`codes added: clients ${c}, bookings ${b}, payments ${p}`);
})();
