import Link from "next/link";
import { and, desc, eq, gte, ilike, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { bookings, customers } from "@/db/schema";
import { loadBookingDetail } from "@/lib/booking-detail";
import { formatINR } from "@/lib/money";
import { CONSTRUCTION_STAGES } from "@/lib/stage";
import type { ConstructionStage, PaymentType } from "@/lib/stage";

export const dynamic = "force-dynamic";

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    project?: string;
    stage?: string;
    paymentType?: string;
    due?: string;
    from?: string;
    to?: string;
  };
}) {
  const q = searchParams.q?.trim();
  const conditions = [];
  if (q) {
    conditions.push(
      or(
        ilike(bookings.propertyType, `%${q}%`),
        ilike(bookings.propertyNumber, `%${q}%`),
        ilike(customers.fullName, `%${q}%`),
        ilike(customers.mobile, `%${q}%`),
      ),
    );
  }
  if (searchParams.project)
    conditions.push(ilike(bookings.projectName, `%${searchParams.project}%`));
  if (searchParams.stage)
    conditions.push(
      eq(bookings.currentStage, searchParams.stage as ConstructionStage),
    );
  if (searchParams.paymentType)
    conditions.push(
      eq(bookings.paymentType, searchParams.paymentType as PaymentType),
    );
  if (searchParams.from) conditions.push(gte(bookings.bookingDate, searchParams.from));
  if (searchParams.to) conditions.push(lte(bookings.bookingDate, searchParams.to));

  const rawRows = await db
    .select({
      id: bookings.id,
      projectName: bookings.projectName,
      propertyType: bookings.propertyType,
      propertyNumber: bookings.propertyNumber,
      bookingDate: bookings.bookingDate,
      paymentType: bookings.paymentType,
      currentStage: bookings.currentStage,
      customerName: customers.fullName,
    })
    .from(bookings)
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(bookings.bookingDate));

  const withDue = await Promise.all(
    rawRows.map(async (row) => ({
      ...row,
      detail: await loadBookingDetail(row.id),
    })),
  );
  const rows = withDue.filter((row) => {
    if (searchParams.due === "due")
      return (row.detail?.outstanding.outstanding ?? 0n) > 0n;
    if (searchParams.due === "paid")
      return (row.detail?.outstanding.outstanding ?? 0n) <= 0n;
    return true;
  });

  return (
    <div>
      <h1 className="mb-4 text-2xl font-medium">Bookings</h1>
      <form className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <input name="q" className="field" placeholder="Customer, mobile or unit" defaultValue={q} />
        <input name="project" className="field" placeholder="Project" defaultValue={searchParams.project} />
        <select name="stage" className="field" defaultValue={searchParams.stage}>
          <option value="">All stages</option>
          {CONSTRUCTION_STAGES.map((stage) => (
            <option key={stage.value} value={stage.value}>{stage.label}</option>
          ))}
        </select>
        <select name="paymentType" className="field" defaultValue={searchParams.paymentType}>
          <option value="">All payment types</option>
          <option value="self_finance">Self finance</option>
          <option value="bank_loan">Bank loan</option>
          <option value="installment">Installment</option>
        </select>
        <select name="due" className="field" defaultValue={searchParams.due}>
          <option value="">All due statuses</option>
          <option value="due">Amount due</option>
          <option value="paid">Paid / advance</option>
        </select>
        <input type="date" name="from" className="field" defaultValue={searchParams.from} />
        <input type="date" name="to" className="field" defaultValue={searchParams.to} />
        <button className="btn-primary">Apply filters</button>
      </form>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">No bookings match these filters.</p>
      ) : (
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Unit</th>
                <th>Customer</th>
                <th>Project</th>
                <th>Payment type</th>
                <th>Stage</th>
                <th className="text-right">Due</th>
                <th>Booking date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link href={`/bookings/${row.id}`} className="text-brass-dark hover:underline">
                      {row.propertyType} {row.propertyNumber ?? ""}
                    </Link>
                  </td>
                  <td>{row.customerName}</td>
                  <td>{row.projectName ?? "—"}</td>
                  <td>{row.paymentType.replace("_", " ")}</td>
                  <td>{row.currentStage?.replaceAll("_", " ") ?? "—"}</td>
                  <td className="money text-right text-due">
                    {row.detail?.outstanding.outstanding &&
                    row.detail.outstanding.outstanding > 0n
                      ? formatINR(row.detail.outstanding.outstanding)
                      : "₹0"}
                  </td>
                  <td>{row.bookingDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
