/**
 * report-sales.ts — loaders for the sales-side reports. They fetch rows (scoped to the
 * active project) and hand them to the pure builders in report-calc.ts.
 */
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, bookings, customers, paymentSchedule, payments, propertyCosts, users } from "@/db/schema";
import type { Cell, ExportTable } from "./export-types";
import { activeProjectId, inProject } from "./project-scope";
import type { Period } from "./report-filters";
import { formatReportDate } from "./statement";
import { ledgerTable, salesByMonth, salesByStaff, UNASSIGNED, type DatedAmount, type LedgerEntry } from "./report-calc";

// --- loaders ----------------------------------------------------------------

async function salesRows(period: Period) {
  const pid = await activeProjectId();
  const [sold, collected] = await Promise.all([
    db
      .select({ date: bookings.bookingDate, amount: propertyCosts.totalCost, by: customers.salesExecutive })
      .from(bookings)
      .innerJoin(customers, eq(bookings.customerId, customers.id))
      .leftJoin(propertyCosts, eq(propertyCosts.bookingId, bookings.id))
      .where(and(gte(bookings.bookingDate, period.from), lte(bookings.bookingDate, period.to), inProject(bookings.projectId, pid))),
    db
      .select({ date: payments.paymentDate, amount: payments.amount, by: customers.salesExecutive })
      .from(payments)
      .innerJoin(bookings, eq(payments.bookingId, bookings.id))
      .innerJoin(customers, eq(bookings.customerId, customers.id))
      .where(and(gte(payments.paymentDate, period.from), lte(payments.paymentDate, period.to), inProject(bookings.projectId, pid))),
  ]);
  const fix = (r: { date: string; amount: bigint | null; by: string | null }): DatedAmount => ({ date: r.date, amount: r.amount ?? 0n, by: r.by || UNASSIGNED });
  return { sold: sold.map(fix), collected: collected.map(fix) };
}

export async function monthlySalesTable(period: Period) {
  const { sold, collected } = await salesRows(period);
  return salesByMonth(sold, collected, period);
}

export async function staffSalesTable(period: Period) {
  const { sold, collected } = await salesRows(period);
  return salesByStaff(sold, collected, period);
}

/** The clients of the active project, for the ledger's picker. */
export async function ledgerClients() {
  return db
    .select({ id: customers.id, name: customers.fullName, code: customers.clientCode })
    .from(customers)
    .where(inProject(customers.projectId, await activeProjectId()))
    .orderBy(asc(customers.fullName));
}

export async function clientLedgerTable(period: Period, clientId: string | undefined): Promise<ExportTable> {
  const empty = ledgerTable("Client ledger: choose a client", 0n, []);
  if (!clientId) return { ...empty, rows: [], footer: undefined };
  const client = await db.query.customers.findFirst({ where: eq(customers.id, clientId), columns: { fullName: true, clientCode: true } });
  if (!client) return { ...empty, rows: [], footer: undefined };

  const [schedule, paid] = await Promise.all([
    db
      .select({ date: paymentSchedule.dueDate, label: paymentSchedule.label, amount: paymentSchedule.amount, type: bookings.propertyType, number: bookings.propertyNumber })
      .from(paymentSchedule)
      .innerJoin(bookings, eq(paymentSchedule.bookingId, bookings.id))
      .where(eq(bookings.customerId, clientId)),
    db
      .select({ date: payments.paymentDate, amount: payments.amount, para: payments.paymentFor, mode: payments.mode, type: bookings.propertyType, number: bookings.propertyNumber })
      .from(payments)
      .innerJoin(bookings, eq(payments.bookingId, bookings.id))
      .where(eq(bookings.customerId, clientId)),
  ]);
  const unit = (r: { type: string; number: string | null }) => `${r.type}${r.number ? ` ${r.number}` : ""}`;
  const all: LedgerEntry[] = [
    ...schedule.map((r) => ({ date: r.date, particulars: r.label ?? "Instalment due", unit: unit(r), due: r.amount, received: 0n })),
    ...paid.map((r) => ({ date: r.date, particulars: `Payment received${r.para ? `: ${r.para}` : ""} (${r.mode.replace("_", " ")})`, unit: unit(r), due: 0n, received: r.amount })),
  ];
  const opening = all.filter((e) => e.date < period.from).reduce((b, e) => b + e.due - e.received, 0n);
  return ledgerTable(
    `Client ledger: ${client.fullName}${client.clientCode ? ` (${client.clientCode})` : ""}, ${formatReportDate(period.from)} to ${formatReportDate(period.to)}`,
    opening,
    all.filter((e) => e.date >= period.from && e.date <= period.to),
  );
}

export async function staffActivityTable(period: Period): Promise<ExportTable> {
  const rows = await db
    .select({ at: auditLog.timestamp, who: users.name, action: auditLog.action, entity: auditLog.entityType })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.userId))
    .where(and(gte(auditLog.timestamp, new Date(`${period.from}T00:00:00Z`)), lte(auditLog.timestamp, new Date(`${period.to}T23:59:59Z`))))
    .orderBy(desc(auditLog.timestamp))
    .limit(2000);
  return {
    title: `Staff activity ${formatReportDate(period.from)} to ${formatReportDate(period.to)}`,
    columns: [{ header: "When" }, { header: "Who" }, { header: "Action" }, { header: "What" }],
    rows: rows.map((r): Cell[] => [r.at.toISOString().slice(0, 16).replace("T", " "), r.who ?? "System", r.action, r.entity.replace("_", " ")]),
  };
}
