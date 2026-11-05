/**
 * agent-import.ts — reads an agent sheet in the DaeBuild layout (Agent ID, Title, Full Name, ...)
 * into clean agent records, applying that file's rules. Pure: no file or database access.
 */
export interface AgentFields {
  title?: string;
  name: string;
  companyName?: string;
  mobile?: string;
  phone?: string;
  email?: string;
  smsOptIn?: boolean;
  emailOptIn?: boolean;
  reraNo?: string;
  gstin?: string;
  pan?: string;
  idProofNo?: string;
  address?: string;
  pinCode?: string;
  city?: string;
  state?: string;
  country?: string;
  userGroup?: string;
  active?: boolean;
  notes?: string;
}

export interface ParsedAgent {
  line: number;
  code: string | null; // Agent ID: present = update that agent
  fields: AgentFields;
  brokeragePlanId: string | null;
  rewardPlanId: string | null;
}

export interface ImportProblem {
  line: number;
  message: string;
}

export interface ImportContext {
  /** Lower-cased plan name -> id. */
  brokeragePlans: Map<string, string>;
  rewardPlans: Map<string, string>;
  /** Agent IDs that exist in the project (AG001 ...), lower-cased. */
  existingCodes: Set<string>;
}

/** Column headers of the agent file (used for the import, and for the download). The password is never exported. */
export const AGENT_HEADERS = [
  "Agent ID", "Title", "Full Name", "Company Name", "Mobile No.", "Email", "SMS / WhatsApp Notification", "Email Notification",
  "Phone No.", "RERA Registration No.", "GSTIN", "PAN No.", "ID Proof No.", "Brokerage Plan", "Reward Plan", "Address",
  "Pin Code", "City", "State", "Country", "User Group", "User Status", "More Information",
] as const;

const flat = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** The row that holds the column names (the file has a title and notes around its table). */
export function findAgentHeader(rows: string[][]): number {
  const i = rows.findIndex((r) => r.some((c) => flat(c) === "fullname") && r.some((c) => flat(c) === "agentid"));
  return i >= 0 ? i : rows.findIndex((r) => r.some((c) => flat(c) === "fullname"));
}

const yes = (v: string) => (/^y/i.test(v) ? true : /^n/i.test(v) ? false : undefined);

export function parseAgentRows(rows: string[][], ctx: ImportContext): { agents: ParsedAgent[]; problems: ImportProblem[] } {
  const h = findAgentHeader(rows);
  const agents: ParsedAgent[] = [];
  const problems: ImportProblem[] = [];
  if (h < 0) return { agents, problems: [{ line: 1, message: 'No "Full Name" column found. Is this the agent file?' }] };

  const col = new Map(rows[h].map((c, i) => [flat(c), i]));
  const at = (r: string[], name: string) => (r[col.get(flat(name)) ?? -1] ?? "").trim();
  const seen = new Set<string>();

  rows.slice(h + 1).forEach((r, i) => {
    const line = h + 2 + i;
    if (!r.some((c) => c.trim())) return;
    const code = at(r, "Agent ID") || null;
    const name = at(r, "Full Name");
    if (!name) return void problems.push({ line, message: "No full name" });
    if (code && !ctx.existingCodes.has(code.toLowerCase())) return void problems.push({ line, message: `Agent ID ${code} does not exist (leave it blank to add a new agent)` });
    if (code && seen.has(code.toLowerCase())) return void problems.push({ line, message: `Agent ID ${code} appears twice` });
    if (code) seen.add(code.toLowerCase());
    const mobile = at(r, "Mobile No.");
    const email = at(r, "Email");
    if (!code && !mobile && !email) return void problems.push({ line, message: "Give a mobile number or an email" });

    const planName = at(r, "Brokerage Plan");
    const rewardName = at(r, "Reward Plan");
    const brokeragePlanId = planName ? (ctx.brokeragePlans.get(planName.toLowerCase()) ?? null) : null;
    const rewardPlanId = rewardName ? (ctx.rewardPlans.get(rewardName.toLowerCase()) ?? null) : null;
    if (planName && !brokeragePlanId) return void problems.push({ line, message: `Brokerage plan "${planName}" does not exist; add it under Plans first` });
    if (rewardName && !rewardPlanId) return void problems.push({ line, message: `Reward plan "${rewardName}" does not exist; add it under Plans first` });

    const status = at(r, "User Status");
    const text = (k: string) => at(r, k) || undefined;
    agents.push({
      line,
      code,
      brokeragePlanId,
      rewardPlanId,
      fields: {
        title: text("Title"), name, companyName: text("Company Name"), mobile: mobile || undefined, phone: text("Phone No."),
        email: email || undefined, smsOptIn: yes(at(r, "SMS / WhatsApp Notification")), emailOptIn: yes(at(r, "Email Notification")),
        reraNo: text("RERA Registration No."), gstin: text("GSTIN"), pan: text("PAN No.")?.toUpperCase(), idProofNo: text("ID Proof No."),
        address: text("Address"), pinCode: text("Pin Code"), city: text("City"), state: text("State"), country: text("Country"),
        userGroup: text("User Group"), active: status ? !/^in/i.test(status) : undefined, notes: text("More Information"),
      },
    });
  });
  return { agents, problems };
}
