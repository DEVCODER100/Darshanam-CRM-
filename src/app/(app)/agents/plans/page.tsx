import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { agents, brokeragePlans, rewardPlans } from "@/db/schema";
import { getCurrentUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { activeProjectId, inProject } from "@/lib/project-scope";
import { bpsToPercentString, paiseToRupeeString } from "@/lib/money";
import { AgentPlans } from "@/components/AgentPlans";

export const dynamic = "force-dynamic";

export default async function AgentPlansPage() {
  const user = await getCurrentUser();
  const pid = await activeProjectId();
  const [bp, rp, people] = await Promise.all([
    db.select().from(brokeragePlans).where(inProject(brokeragePlans.projectId, pid)).orderBy(asc(brokeragePlans.name)),
    db.select().from(rewardPlans).where(inProject(rewardPlans.projectId, pid)).orderBy(asc(rewardPlans.name)),
    db.select({ b: agents.brokeragePlanId, r: agents.rewardPlanId }).from(agents).where(inProject(agents.projectId, pid)),
  ]);
  return (
    <div className="space-y-4">
      <div>
        <Link href="/agents" className="text-sm text-brass-dark hover:underline">← Agents</Link>
        <h1 className="mt-2 text-2xl font-medium">Brokerage and reward plans</h1>
      </div>
      <AgentPlans
        canManage={!!user && can(user.role, "agent:manage")}
        brokerage={bp.map((p) => ({
          id: p.id,
          name: p.name,
          defaultPercent: bpsToPercentString(BigInt(p.defaultBps)),
          perType: Object.fromEntries(Object.entries(p.perType).map(([k, v]) => [k, bpsToPercentString(BigInt(v))])),
          archived: p.archived,
          agents: people.filter((x) => x.b === p.id).length,
        }))}
        reward={rp.map((p) => ({
          id: p.id,
          name: p.name,
          kind: p.kind,
          value: p.kind === "per_booking" ? paiseToRupeeString(p.value) : bpsToPercentString(p.value),
          archived: p.archived,
          agents: people.filter((x) => x.r === p.id).length,
        }))}
      />
    </div>
  );
}
