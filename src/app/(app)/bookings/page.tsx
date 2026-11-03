import Link from "next/link";
import { and, desc, eq, gte, ilike, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { bookings, customers } from "@/db/schema";
import { formatINR } from "@/lib/money";
import { ACCOUNT_STATUS_LABELS } from "@/lib/report-filters";
import { activeProjectId, inProject } from "@/lib/project-scope";
import { loadAccounts } from "@/lib/statement-data";
import { todayISO } from "@/lib/dates";
import { CONSTRUCTION_STAGES, PAYMENT_TYPES } from "@/lib/stage";
import type { ConstructionStage, PaymentType } from "@/lib/stage";

export const dynamic = "force-dynamic";

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    stage?: string;
    paymentType?: string;
    due?: string;
    status?: string;
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
  conditions.push(inProject(bookings.projectId, await activeProjectId()));
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

  const accounts = await loadAccounts(todayISO());
  const dueOf = (id: string) => accounts.get(id)?.outstanding ?? 0n;
  const rows = rawRows.filter((row) => {
    if (searchParams.status && accounts.get(row.id)?.status !== searchParams.status) return false;
    if (searchParams.due === "due") return dueOf(row.id) > 0n;
    if (searchParams.due === "paid") return dueOf(row.id) <= 0n;
    return true;
  });

  return (
    <div>
      <h1 className="mb-4 text-2xl font-medium">Bookings</h1>
      <form className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <input name="q" className="field" placeholder="Customer, mobile or unit" defaultValue={q} />
        <select name="stage" className="field" defaultValue={searchParams.stage}>
          <option value="">All stages</option>
          {CONSTRUCTION_STAGES.map((stage) => (
            <option key={stage.value} value={stage.value}>{stage.label}</option>
          ))}
        </select>
        <select name="paymentType" className="field" defaultValue={searchParams.paymentType}>
          <option value="">All payment types</option>
          {Object.entries(PAYMENT_TYPES).map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
        <select name="due" className="field" defaultValue={searchParams.due}>
          <option value="">All due statuses</option>
          <option value="due">Amount due</option>
          <option value="paid">Paid / advance</option>
        </select>
        <select name="status" className="field" defaultValue={searchParams.status}>
          <option value="">All account statuses</option>
          {Object.entries(ACCOUNT_STATUS_LABELS).map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
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
                    {dueOf(row.id) > 0n ? formatINR(dueOf(row.id)) : "₹0"}
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
