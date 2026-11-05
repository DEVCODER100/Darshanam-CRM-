import { getCurrentUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { AgentsAdmin } from "@/components/AgentsAdmin";
import { agentSummary } from "@/lib/report-agents";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const user = await getCurrentUser();
  const { agents, history } = await agentSummary();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-medium">Agents</h1>
        <p className="text-sm text-muted">
          Brokers who bring buyers, their commission and the brokerage paid. The reports are in Reports, under Agent Report and Agent Brokerage.
        </p>
      </div>
      <AgentsAdmin
        canManage={!!user && can(user.role, "agent:manage")}
        agents={agents}
        payments={history.map((h) => ({
          id: h.id,
          agentName: agents.find((a) => a.id === h.agentId)?.name ?? "",
          date: h.paymentDate,
          amount: h.amount,
          mode: h.mode,
          reference: h.reference,
        }))}
      />
    </div>
  );
}
