import Link from "next/link";
import { formatINR } from "@/lib/money";
import { AGENT_TEMPLATES } from "@/lib/contact-message";
import { agentSummary } from "@/lib/report-agents";
import { getActiveProject } from "@/lib/project-scope";
import { MessageCenter } from "@/components/MessageCenter";

export const dynamic = "force-dynamic";

/** Bulk-contact agents: tick people, pick a template, open it in WhatsApp / SMS / email. */
export default async function MessageAgentsPage() {
  const { agents } = await agentSummary();
  const project = (await getActiveProject())?.label ?? "Darshanam";
  return (
    <div className="space-y-4">
      <div>
        <Link href="/agents" className="text-sm text-brass-dark hover:underline">← Agents</Link>
        <h1 className="mt-2 text-2xl font-medium">Message agents</h1>
        <p className="text-sm text-muted">Messages open in your own WhatsApp, SMS or email app; the site does not send them.</p>
      </div>
      <MessageCenter
        project={project}
        templates={AGENT_TEMPLATES}
        unitsHeader="Company / plan"
        dueHeader="Brokerage due"
        linkBase="/agents"
        rows={agents
          .filter((a) => !a.row.archived && (a.row.mobile || a.row.email))
          .map((a) => ({
            id: a.id,
            name: a.name,
            clientCode: a.row.agentCode,
            mobile: a.row.mobile ?? "",
            email: a.row.email,
            units: [a.row.companyName, a.plan?.name].filter((x): x is string => !!x),
            dueText: a.due > 0n ? formatINR(a.due, { paise2dp: false }) : "",
            hasDue: a.due > 0n,
            smsOptIn: a.row.smsOptIn && !!a.row.mobile,
            emailOptIn: a.row.emailOptIn,
          }))}
      />
    </div>
  );
}
