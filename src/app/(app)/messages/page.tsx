import { getCurrentUser } from "@/lib/rbac";
import { formatINR } from "@/lib/money";
import { getActiveProject } from "@/lib/project-scope";
import { loadContacts, matchesContact, parseContactFilters } from "@/lib/contacts";
import { UNIT_TYPES } from "@/lib/validators";
import type { Params } from "@/lib/report-filters";
import { MessageCenter } from "@/components/MessageCenter";

export const dynamic = "force-dynamic";

/** Customer contact list: find people, see how to reach them and which unit they own, and message them. */
export default async function MessagesPage({ searchParams }: { searchParams: Params }) {
  await getCurrentUser();
  const filters = parseContactFilters(searchParams);
  const all = await loadContacts();
  const found = all.filter((c) => matchesContact(c, filters));
  const project = (await getActiveProject())?.label ?? "Darshanam";
  const val = (k: string) => (Array.isArray(searchParams[k]) ? searchParams[k]![0] : searchParams[k]) ?? "";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-medium">Messages</h1>
        <p className="text-sm text-muted">
          Customer contacts with their unit and dues. Tick people, write a message (or pick a template) and open it in WhatsApp,
          SMS or email. Messages go from your own phone or mail app; the site does not send them.
        </p>
      </div>

      <form method="get" className="card flex flex-wrap items-end gap-3 p-3 text-sm">
        <label className="text-xs text-muted">
          Search
          <input name="q" defaultValue={val("q")} placeholder="Name, mobile, email, unit, client ID" className="field mt-1 w-72" />
        </label>
        <label className="text-xs text-muted">
          Unit type
          <select name="type" defaultValue={val("type")} className="field mt-1">
            <option value="">Any</option>
            {UNIT_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted">
          Payments
          <select name="due" defaultValue={val("due")} className="field mt-1">
            <option value="">All</option>
            <option value="dues">Has dues</option>
            <option value="clear">No dues</option>
          </select>
        </label>
        <button className="btn-primary px-4 py-2">Search</button>
        <a href="/messages" className="btn-secondary px-4 py-2">Reset</a>
        <span className="ml-auto text-muted">{found.length} of {all.length} customers</span>
      </form>

      <MessageCenter
        project={project}
        rows={found.map((c) => ({
          id: c.id,
          name: c.name,
          clientCode: c.clientCode,
          mobile: c.mobile,
          email: c.email,
          units: c.units.map((u) => u.name),
          dueText: c.due > 0n ? formatINR(c.due, { paise2dp: false }) : "",
          hasDue: c.due > 0n,
          smsOptIn: c.smsOptIn,
          emailOptIn: c.emailOptIn,
        }))}
      />
    </div>
  );
}
