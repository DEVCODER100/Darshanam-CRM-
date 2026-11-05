import Link from "next/link";
import { getCurrentUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { formatINR } from "@/lib/money";
import { agentSummary } from "@/lib/report-agents";
import { callLink, mailLink, smsLink, whatsappLink } from "@/lib/contact-message";
import { getActiveProject } from "@/lib/project-scope";
import type { Params } from "@/lib/report-filters";
import { AgentImport } from "@/components/AgentImport";
import { planChoices } from "@/lib/agent-choices";

export const dynamic = "force-dynamic";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

/** The agent directory: details, plans, group, status and brokerage at a glance, with one-click contact. */
export default async function AgentsPage({ searchParams }: { searchParams: Params }) {
  const user = await getCurrentUser();
  const canManage = !!user && can(user.role, "agent:manage");
  const { agents: all } = await agentSummary();
  const project = (await getActiveProject())?.label ?? "Darshanam";
  const q = one(searchParams.q).toLowerCase();
  const status = one(searchParams.status);
  const group = one(searchParams.group);
  const plan = one(searchParams.plan);
  const city = one(searchParams.city);

  const agents = all.filter((a) => {
    const r = a.row;
    if (q && ![a.name, r.companyName, r.mobile, r.email, r.agentCode, r.city].some((x) => (x ?? "").toLowerCase().includes(q))) return false;
    if (status && (status === "inactive") !== r.archived) return false;
    if (group && r.userGroup !== group) return false;
    if (plan && a.planId !== plan) return false;
    if (city && (r.city ?? "").toLowerCase() !== city.toLowerCase()) return false;
    return true;
  });
  const distinct = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort();
  const plans = await planChoices();
  const btn = "rounded-md border border-hairline px-2 py-1 text-xs hover:bg-canvas";
  const off = "pointer-events-none opacity-40";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium">Agents</h1>
          <p className="text-sm text-muted">Brokers and agents of {project}: contact details, plans, brokerage and reward.</p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {canManage && <Link href="/agents/new" className="btn-primary px-3 py-1.5">+ Add agent</Link>}
          <Link href="/agents/message" className="btn-secondary px-3 py-1.5">Message agents</Link>
          <Link href="/agents/plans" className="btn-secondary px-3 py-1.5">Plans</Link>
          <a href="/api/agents/export" className="btn-secondary px-3 py-1.5">Download</a>
          {canManage && (
            <AgentImport
              brokeragePlans={plans.brokerage.map((p) => [p.name, p.id])}
              rewardPlans={plans.reward.map((p) => [p.name, p.id])}
              codes={all.map((a) => a.row.agentCode).filter((c): c is string => !!c)}
            />
          )}
        </div>
      </div>

      <form method="get" className="card flex flex-wrap items-end gap-3 p-3 text-sm">
        <label className="text-xs text-muted">Search<input name="q" defaultValue={one(searchParams.q)} placeholder="Name, company, mobile, email, ID, city" className="field mt-1 w-72" /></label>
        <label className="text-xs text-muted">Status
          <select name="status" defaultValue={status} className="field mt-1"><option value="">Any</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
        </label>
        <label className="text-xs text-muted">User group
          <select name="group" defaultValue={group} className="field mt-1"><option value="">Any</option>{distinct(all.map((a) => a.row.userGroup)).map((g) => <option key={g}>{g}</option>)}</select>
        </label>
        <label className="text-xs text-muted">Brokerage plan
          <select name="plan" defaultValue={plan} className="field mt-1"><option value="">Any</option>{plans.brokerage.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        </label>
        <label className="text-xs text-muted">City
          <select name="city" defaultValue={city} className="field mt-1"><option value="">Any</option>{distinct(all.map((a) => a.row.city)).map((c) => <option key={c}>{c}</option>)}</select>
        </label>
        <button className="btn-primary px-4 py-2">Search</button>
        <Link href="/agents" className="btn-secondary px-4 py-2">Reset</Link>
        <span className="ml-auto text-muted">{agents.length} of {all.length} agents</span>
      </form>

      <div className="card overflow-x-auto">
        <table className="data-table min-w-[1200px]">
          <thead>
            <tr>
              <th>Agent ID</th><th>Agent</th><th>Contact</th><th>City</th><th>Brokerage plan</th><th>Reward plan</th><th>Group</th><th>Status</th>
              <th className="text-right">Units</th><th className="text-right">Brokerage due</th><th className="text-right">Reward due</th><th>Reach out</th>
            </tr>
          </thead>
          <tbody>
            {agents.length === 0 && <tr><td colSpan={12} className="text-muted">No agents match.</td></tr>}
            {agents.map((a) => {
              const r = a.row;
              const msg = `Dear ${a.name.split(" ")[0]}, `;
              return (
                <tr key={a.id} className={r.archived ? "opacity-60" : ""}>
                  <td className="whitespace-nowrap font-mono text-xs">{r.agentCode ?? "—"}</td>
                  <td>
                    <Link href={`/agents/${a.id}`} className="font-medium text-brass-dark hover:underline">{r.title ? `${r.title} ` : ""}{a.name}</Link>
                    {r.companyName && <p className="text-xs text-muted">{r.companyName}</p>}
                  </td>
                  <td className="text-sm">
                    <p className="whitespace-nowrap">{r.mobile ?? "—"}</p>
                    <p className="text-xs text-muted">{r.email ?? ""}</p>
                  </td>
                  <td className="text-muted">{r.city ?? "—"}</td>
                  <td>{a.plan ? `${a.plan.name} (${a.plan.defaultBps / 100}%)` : r.commissionBps ? `${r.commissionBps / 100}% own` : "—"}</td>
                  <td className="text-muted">{a.reward?.name ?? "—"}</td>
                  <td className="text-muted">{r.userGroup}</td>
                  <td><span className={r.archived ? "pill-neutral" : "pill-paid"}>{r.archived ? "Inactive" : "Active"}</span></td>
                  <td className="text-right">{a.units}</td>
                  <td className={`money text-right ${a.due > 0n ? "text-due" : "text-muted"}`}>{a.due > 0n ? formatINR(a.due, { paise2dp: false }) : "—"}</td>
                  <td className={`money text-right ${a.rewardDue > 0n ? "text-due" : "text-muted"}`}>{a.rewardDue > 0n ? formatINR(a.rewardDue, { paise2dp: false }) : "—"}</td>
                  <td className="whitespace-nowrap">
                    <span className="flex gap-1">
                      <a href={r.mobile ? callLink(r.mobile) : undefined} className={`${btn} ${r.mobile ? "" : off}`}>Call</a>
                      <a href={r.mobile ? whatsappLink(r.mobile, msg) : undefined} target="_blank" rel="noreferrer" className={`${btn} ${r.mobile && r.smsOptIn ? "" : off}`}>WhatsApp</a>
                      <a href={r.mobile ? smsLink(r.mobile, msg) : undefined} className={`${btn} ${r.mobile && r.smsOptIn ? "" : off}`}>SMS</a>
                      <a href={r.email ? mailLink(r.email, `Message from ${project}`, msg) : undefined} className={`${btn} ${r.email && r.emailOptIn ? "" : off}`}>Email</a>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">Brokerage due = earned on the basic amount received on the agent&apos;s bookings, minus brokerage paid. Reports: Reports → Agent Report and Agent Brokerage.</p>
    </div>
  );
}
