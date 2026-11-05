import Link from "next/link";
import { planChoices } from "@/lib/agent-choices";
import { AgentForm } from "@/components/AgentForm";

export const dynamic = "force-dynamic";

export default async function NewAgentPage() {
  const plans = await planChoices();
  return (
    <div>
      <Link href="/agents" className="text-sm text-brass-dark hover:underline">← Agents</Link>
      <h1 className="mb-4 mt-2 text-2xl font-medium">Add agent</h1>
      <AgentForm initial={{}} brokeragePlans={plans.brokerage} rewardPlans={plans.reward} />
    </div>
  );
}
