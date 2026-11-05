/** The Agent form as data (like customer-profile.ts): the form, profile and import all read this. */
export interface AgentField {
  key: string;
  label: string;
  type?: "text" | "area" | "select" | "yesno" | "brokeragePlan" | "rewardPlan";
  options?: string[];
  required?: boolean;
  hint?: string;
}

export const TITLES = ["Mr.", "Mrs.", "Miss.", "Dr.", "Ms.", "M/S.", "Prof."];

export const AGENT_SECTIONS: { title: string; fields: AgentField[] }[] = [
  {
    title: "Agent details",
    fields: [
      { key: "title", label: "Title", type: "select", options: TITLES },
      { key: "name", label: "Full name", required: true },
      { key: "companyName", label: "Company name" },
    ],
  },
  {
    title: "Contact details",
    fields: [
      { key: "mobile", label: "Mobile", hint: "Mobile or email is required" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone (landline)" },
      { key: "smsOptIn", label: "SMS / WhatsApp notifications", type: "yesno" },
      { key: "emailOptIn", label: "Email notifications", type: "yesno" },
    ],
  },
  {
    title: "Registrations",
    fields: [
      { key: "reraNo", label: "RERA registration no." },
      { key: "gstin", label: "GSTIN" },
      { key: "pan", label: "PAN number", hint: "Stored encrypted" },
      { key: "idProofNo", label: "ID proof no.", hint: "Aadhaar or passport; stored encrypted" },
    ],
  },
  {
    title: "Brokerage and reward",
    fields: [
      { key: "brokeragePlanId", label: "Brokerage plan", type: "brokeragePlan" },
      { key: "rewardPlanId", label: "Reward plan", type: "rewardPlan" },
      { key: "commissionPercent", label: "Own commission % (used only with no brokerage plan)" },
    ],
  },
  {
    title: "Address",
    fields: [
      { key: "address", label: "Address", type: "area" },
      { key: "pinCode", label: "Pin code" },
      { key: "city", label: "City" },
      { key: "state", label: "State" },
      { key: "country", label: "Country" },
    ],
  },
  {
    title: "Group and status",
    fields: [
      { key: "userGroup", label: "User group" },
      { key: "status", label: "User status", type: "select", options: ["Active", "Inactive"] },
      { key: "notes", label: "More information", type: "area" },
    ],
  },
];

export const AGENT_FIELDS = AGENT_SECTIONS.flatMap((s) => s.fields);
