/** Loaders for the agent reports; the grouping itself is in report-calc.ts. */
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { agentPayments, agents, bookings, payments, propertyCosts } from "@/db/schema";
import type { ExportTable } from "./export-types";
import { activeProjectId, inProject } from "./project-scope";
import type { Period } from "./report-filters";
import { agentBrokerageTable, agentSalesTable, commission, type AgentAmount, type AgentRef } from "./report-calc";

/** The agents of the active project (archived ones only matter if they have records). */
export async function projectAgents(): Promise<(AgentRef & { archived: boolean })[]> {
  const rows = await db
    .select()
    .from(agents)
    .where(inProject(agents.projectId, await activeProjectId()))
    .orderBy(asc(agents.name));
  return rows.map((a) => ({ id: a.id, name: a.name, mobile: a.mobile, bps: a.commissionBps, archived: a.archived }));
}

async function agentRows() {
  const list = await projectAgents();
  const ids = list.map((a) => a.id);
  if (!ids.length) return { list, sold: [], collected: [], basic: [], paid: [] };
  const [sold, pays, paid] = await Promise.all([
    db
      .select({ agentId: bookings.agentId, date: bookings.bookingDate, amount: propertyCosts.totalCost })
      .from(bookings)
      .leftJoin(propertyCosts, eq(propertyCosts.bookingId, bookings.id))
      .where(inArray(bookings.agentId, ids)),
    db
      .select({ agentId: bookings.agentId, date: payments.paymentDate, amount: payments.amount, gst: payments.gstAmount, other: payments.maintenanceAmount, doc: payments.documentationAmount })
      .from(payments)
      .innerJoin(bookings, eq(payments.bookingId, bookings.id))
      .where(inArray(bookings.agentId, ids)),
    db.select({ agentId: agentPayments.agentId, date: agentPayments.paymentDate, amount: agentPayments.amount }).from(agentPayments).where(inArray(agentPayments.agentId, ids)),
  ]);
  const mine = (id: string | null): id is string => !!id;
  return {
    list,
    sold: sold.filter((r) => mine(r.agentId)).map((r): AgentAmount => ({ agentId: r.agentId!, date: r.date, amount: r.amount ?? 0n })),
    collected: pays.filter((r) => mine(r.agentId)).map((r): AgentAmount => ({ agentId: r.agentId!, date: r.date, amount: r.amount })),
    // Commission is on the basic part of each payment (not GST, maintenance or document charges).
    basic: pays.filter((r) => mine(r.agentId)).map((r): AgentAmount => ({ agentId: r.agentId!, date: r.date, amount: r.amount - r.gst - r.other - r.doc })),
    paid,
  };
}

export async function agentReportTable(period: Period): Promise<ExportTable> {
  const d = await agentRows();
  return agentSalesTable(d.list, d.sold, d.collected, period);
}

export async function agentBrokerageReport(period: Period): Promise<ExportTable> {
  const d = await agentRows();
  return agentBrokerageTable(d.list, d.basic, d.paid, period);
}

/** All-time brokerage per agent, plus the payments made, for the Agents page. */
export async function agentSummary() {
  const d = await agentRows();
  const sum = (xs: AgentAmount[], id: string) => xs.filter((x) => x.agentId === id).reduce((s, x) => s + x.amount, 0n);
  const [panRows, history] = await Promise.all([
    db.select({ id: agents.id, pan: agents.panMasked }).from(agents),
    d.list.length
      ? db.select().from(agentPayments).where(inArray(agentPayments.agentId, d.list.map((a) => a.id))).orderBy(desc(agentPayments.paymentDate)).limit(30)
      : [],
  ]);
  return {
    agents: d.list.map((a) => {
      const earned = commission(sum(d.basic, a.id), a.bps);
      const paid = sum(d.paid, a.id);
      return { ...a, pan: panRows.find((p) => p.id === a.id)?.pan ?? null, earned, paid, due: earned - paid };
    }),
    history,
  };
}
