import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { agentPayments, agents, bookings, customers, payments, propertyCosts } from "@/db/schema";
import { getCurrentUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { formatINR } from "@/lib/money";
import { revealText } from "@/lib/pan";
import { planChoices } from "@/lib/agent-choices";
import { earnedOn } from "@/lib/agent-rates";
import { projectAgents } from "@/lib/report-agents";
import { AgentForm } from "@/components/AgentForm";
import { AgentPaymentForm } from "@/components/AgentPaymentForm";

export const dynamic = "force-dynamic";

export default async function AgentProfilePage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const a = await db.query.agents.findFirst({ where: eq(agents.id, params.id) });
  if (!a) notFound();
  const canManage = !!user && can(user.role, "agent:manage");
  const canSee = !!user && can(user.role, "sensitive:view");
  const plans = await planChoices();
  const me = (await projectAgents()).find((x) => x.id === a.id);

  const [books, pays, paid] = await Promise.all([
    db
      .select({ id: bookings.id, type: bookings.propertyType, number: bookings.propertyNumber, client: customers.fullName, date: bookings.bookingDate, cost: propertyCosts.totalCost })
      .from(bookings)
      .innerJoin(customers, eq(bookings.customerId, customers.id))
      .leftJoin(propertyCosts, eq(propertyCosts.bookingId, bookings.id))
      .where(eq(bookings.agentId, a.id))
      .orderBy(desc(bookings.bookingDate)),
    db
      .select({ bookingId: payments.bookingId, amount: payments.amount, gst: payments.gstAmount, other: payments.maintenanceAmount, doc: payments.documentationAmount })
      .from(payments)
      .innerJoin(bookings, eq(payments.bookingId, bookings.id))
      .where(eq(bookings.agentId, a.id)),
    db.select().from(agentPayments).where(eq(agentPayments.agentId, a.id)).orderBy(desc(agentPayments.paymentDate)),
  ]);
  const rows = books.map((b) => {
    const basic = pays.filter((p) => p.bookingId === b.id).reduce((s, p) => s + p.amount - p.gst - p.other - p.doc, 0n);
    return { ...b, basic, earned: earnedOn(me?.plan, a.commissionBps, [{ type: b.type, amount: basic }]) };
  });
  const earned = rows.reduce((s, r) => s + r.earned, 0n);
  const paidBrokerage = paid.filter((p) => p.kind === "brokerage").reduce((s, p) => s + p.amount, 0n);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/agents" className="text-sm text-brass-dark hover:underline">← Agents</Link>
        <h1 className="mt-2 text-2xl font-medium">
          {a.title ? `${a.title} ` : ""}{a.name} <span className="font-mono text-base text-muted">{a.agentCode}</span>
        </h1>
        <p className="text-sm text-muted">
          {a.companyName ? `${a.companyName} · ` : ""}{a.userGroup} · {a.archived ? "Inactive" : "Active"} · PAN {a.panMasked ?? "—"}
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-4">
        {[
          ["Units brought", String(rows.length)],
          ["Brokerage earned", formatINR(earned, { paise2dp: false })],
          ["Brokerage paid", formatINR(paidBrokerage, { paise2dp: false })],
          ["Brokerage due", formatINR(earned - paidBrokerage, { paise2dp: false })],
        ].map(([l, v]) => (
          <div key={l} className="card p-4">
            <p className="text-xs text-muted">{l}</p>
            <p className="money mt-1 text-xl font-medium">{v}</p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">Bookings brought</h2>
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Unit</th><th>Client</th><th>Booked</th>
                <th className="text-right">Sales value</th><th className="text-right">Basic received</th><th className="text-right">Brokerage earned</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={6} className="text-muted">No bookings are tagged to this agent yet. Choose the agent on a booking.</td></tr>}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><Link href={`/bookings/${r.id}`} className="text-brass-dark hover:underline">{r.type} {r.number ?? ""}</Link></td>
                  <td>{r.client}</td>
                  <td className="whitespace-nowrap text-muted">{r.date}</td>
                  <td className="money text-right">{formatINR(r.cost ?? 0n)}</td>
                  <td className="money text-right">{formatINR(r.basic)}</td>
                  <td className="money text-right font-medium">{formatINR(r.earned)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Payments to the agent</h2>
        {canManage && <AgentPaymentForm agentId={a.id} />}
        {paid.length > 0 && (
          <div className="card overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Date</th><th>For</th><th>Mode</th><th>Reference</th><th className="text-right">Amount</th></tr></thead>
              <tbody>
                {paid.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap">{p.paymentDate}</td>
                    <td>{p.kind === "reward" ? "Reward" : "Brokerage"}</td>
                    <td className="text-muted">{p.mode.replace("_", " ")}</td>
                    <td className="text-muted">{p.reference ?? "—"}</td>
                    <td className="money text-right">{formatINR(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canManage && (
        <section>
          <h2 className="mb-2 text-lg font-medium">Agent details</h2>
          <AgentForm
            agentId={a.id}
            brokeragePlans={plans.brokerage}
            rewardPlans={plans.reward}
            initial={{
              title: a.title ?? "", name: a.name, companyName: a.companyName ?? "", mobile: a.mobile ?? "", email: a.email ?? "", phone: a.phone ?? "",
              smsOptIn: a.smsOptIn ? "Yes" : "No", emailOptIn: a.emailOptIn ? "Yes" : "No", reraNo: a.reraNo ?? "", gstin: a.gstin ?? "",
              pan: revealText(a.panEncrypted, canSee), idProofNo: revealText(a.idProofEncrypted, canSee),
              brokeragePlanId: a.brokeragePlanId ?? "", rewardPlanId: a.rewardPlanId ?? "", commissionPercent: String(a.commissionBps / 100),
              address: a.address ?? "", pinCode: a.pinCode ?? "", city: a.city ?? "", state: a.state ?? "", country: a.country ?? "",
              userGroup: a.userGroup, status: a.archived ? "Inactive" : "Active", notes: a.notes ?? "",
            }}
          />
        </section>
      )}
    </div>
  );
}
