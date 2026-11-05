/** Loaders for agents: the reports, and the all-time numbers shown in the directory. Grouping is in report-calc.ts. */
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { agentPayments, agents, bookings, brokeragePlans, payments, propertyCosts, rewardPlans } from "@/db/schema";
import type { ExportTable } from "./export-types";
import { activeProjectId, inProject } from "./project-scope";
import type { Period } from "./report-filters";
import { agentBrokerageTable, agentSalesTable, type AgentAmount, type AgentRef } from "./report-calc";
import { earnedOn, rewardOn } from "./agent-rates";

export type AgentWithRow = AgentRef & { row: typeof agents.$inferSelect; planId: string | null; rewardId: string | null };

/** The agents of the active project (inactive ones too: they may still have records). */
export async function projectAgents(): Promise<AgentWithRow[]> {
  const pid = await activeProjectId();
  const [rows, bPlans, rPlans] = await Promise.all([
    db.select().from(agents).where(inProject(agents.projectId, pid)).orderBy(asc(agents.agentCode), asc(agents.name)),
    db.select().from(brokeragePlans),
    db.select().from(rewardPlans),
  ]);
  return rows.map((a) => {
    const bp = bPlans.find((p) => p.id === a.brokeragePlanId);
    const rp = rPlans.find((p) => p.id === a.rewardPlanId);
    return {
      id: a.id,
      name: a.name,
      mobile: a.mobile,
      bps: a.commissionBps,
      plan: bp ? { name: bp.name, defaultBps: bp.defaultBps, perType: bp.perType } : null,
      reward: rp ? { name: rp.name, kind: rp.kind, value: rp.value } : null,
      group: a.userGroup,
      row: a,
      planId: a.brokeragePlanId,
      rewardId: a.rewardPlanId,
    };
  });
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
      .select({ agentId: bookings.agentId, type: bookings.propertyType, date: payments.paymentDate, amount: payments.amount, gst: payments.gstAmount, other: payments.maintenanceAmount, doc: payments.documentationAmount })
      .from(payments)
      .innerJoin(bookings, eq(payments.bookingId, bookings.id))
      .where(inArray(bookings.agentId, ids)),
    db.select({ agentId: agentPayments.agentId, date: agentPayments.paymentDate, amount: agentPayments.amount, kind: agentPayments.kind }).from(agentPayments).where(inArray(agentPayments.agentId, ids)),
  ]);
  return {
    list,
    sold: sold.filter((r) => r.agentId).map((r): AgentAmount => ({ agentId: r.agentId!, date: r.date, amount: r.amount ?? 0n })),
    collected: pays.filter((r) => r.agentId).map((r): AgentAmount => ({ agentId: r.agentId!, date: r.date, amount: r.amount })),
    // Brokerage is on the basic part of each payment (not GST, maintenance or document charges).
    basic: pays.filter((r) => r.agentId).map((r): AgentAmount => ({ agentId: r.agentId!, date: r.date, amount: r.amount - r.gst - r.other - r.doc, type: r.type })),
    paid,
  };
}

export async function agentReportTable(period: Period): Promise<ExportTable> {
  const d = await agentRows();
  return agentSalesTable(d.list.filter((a) => !a.row.archived), d.sold, d.collected, period);
}

export async function agentBrokerageReport(period: Period): Promise<ExportTable> {
  const d = await agentRows();
  return agentBrokerageTable(d.list.filter((a) => !a.row.archived), d.basic, d.sold, d.paid, period);
}

/** All-time numbers per agent for the directory, plus recent payments. */
export async function agentSummary() {
  const d = await agentRows();
  const history = d.list.length
    ? await db.select().from(agentPayments).where(inArray(agentPayments.agentId, d.list.map((a) => a.id))).orderBy(desc(agentPayments.paymentDate)).limit(40)
    : [];
  const paidOf = (id: string, kind: "brokerage" | "reward") => d.paid.filter((p) => p.agentId === id && p.kind === kind).reduce((s, p) => s + p.amount, 0n);
  return {
    agents: d.list.map((a) => {
      const earned = earnedOn(a.plan, a.bps, d.basic.filter((x) => x.agentId === a.id).map((x) => ({ type: x.type ?? "", amount: x.amount })));
      const reward = rewardOn(a.reward, d.sold.filter((x) => x.agentId === a.id).map((x) => x.amount));
      return {
        ...a,
        units: d.sold.filter((x) => x.agentId === a.id).length,
        earned,
        paid: paidOf(a.id, "brokerage"),
        due: earned - paidOf(a.id, "brokerage"),
        rewardDue: reward - paidOf(a.id, "reward"),
      };
    }),
    history,
  };
}
