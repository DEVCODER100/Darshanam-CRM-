/**
 * customer-profile.ts — the Register Client form, as data. The form, the
 * detail page and the API all read this one list, so adding a field is a
 * one-line change. `core` fields are real columns; the rest live in the
 * customer's `profile` JSON.
 */
export interface ProfileField {
  key: string;
  label: string;
  type?: "text" | "date" | "area" | "select" | "pan" | "id";
  options?: string[];
  required?: boolean;
  core?: boolean;
  hint?: string;
  def?: string;
}

const YES_NO = ["Yes", "No"];

export const PROFILE_SECTIONS: { title: string; optional?: boolean; fields: ProfileField[] }[] = [
  {
    title: "Basic details",
    fields: [
      { key: "title", label: "Title", type: "select", options: ["Mr.", "Mrs.", "Ms.", "Dr.", "M/s"] },
      { key: "fullName", label: "Full name", required: true, core: true },
      { key: "gender", label: "Gender", type: "select", options: ["Male", "Female", "Other"] },
      { key: "dob", label: "Date of birth", type: "date" },
      { key: "anniversary", label: "Anniversary", type: "date" },
      { key: "relationType", label: "Relation", type: "select", options: ["Father", "Mother", "Spouse", "Guardian"] },
      { key: "relationName", label: "Father's / spouse's name" },
    ],
  },
  {
    title: "Contact details",
    fields: [
      { key: "mobile", label: "Mobile (primary)", required: true, core: true, hint: "e.g. +919800000000" },
      { key: "alternateMobile", label: "Mobile (secondary)", core: true },
      { key: "email", label: "Email (primary)", core: true },
      { key: "emailSecondary", label: "Email (secondary)" },
      { key: "notifySms", label: "SMS / WhatsApp notifications", type: "select", options: YES_NO, def: "Yes" },
      { key: "notifyEmail", label: "Email notifications", type: "select", options: YES_NO, def: "Yes" },
    ],
  },
  {
    title: "Primary address",
    fields: [
      { key: "address", label: "Address", type: "area", required: true, core: true },
      { key: "city", label: "City" },
      { key: "pinCode", label: "Pin code" },
      { key: "state", label: "State" },
      { key: "country", label: "Country", def: "India" },
      { key: "landline", label: "Phone (landline)" },
    ],
  },
  {
    title: "Secondary address",
    optional: true,
    fields: [
      { key: "secAddress", label: "Address", type: "area" },
      { key: "secCity", label: "City" },
      { key: "secPinCode", label: "Pin code" },
      { key: "secState", label: "State" },
      { key: "secCountry", label: "Country" },
      { key: "secLandline", label: "Phone (landline)" },
    ],
  },
  {
    title: "Other details",
    fields: [
      { key: "religion", label: "Religion" },
      { key: "nationality", label: "Nationality", def: "Indian" },
      { key: "panNumber", label: "PAN number", type: "pan", required: true, core: true },
      { key: "idProofNumber", label: "ID proof no.", type: "id", core: true, hint: "Aadhaar or passport number" },
      {
        key: "occupation",
        label: "Occupation",
        type: "select",
        options: ["Salaried", "Business", "Professional", "Self-employed", "Retired", "Homemaker", "Other"],
      },
      {
        key: "engagement",
        label: "Customer engagement",
        type: "select",
        options: ["Walk-in", "Reference", "Website", "Social media", "Broker / agent", "Advertisement", "Other"],
      },
      { key: "salesExecutive", label: "Sales executive", core: true },
    ],
  },
  {
    title: "Company details",
    optional: true,
    fields: [
      { key: "companyName", label: "Company name" },
      { key: "companyType", label: "Type", hint: "e.g. Pvt Ltd" },
      { key: "companyAddress", label: "Company address", type: "area" },
    ],
  },
  {
    title: "Represented by",
    optional: true,
    fields: [
      { key: "repName", label: "Name" },
      { key: "repMobile", label: "Mobile" },
    ],
  },
];

export const ALL_FIELDS = PROFILE_SECTIONS.flatMap((s) => s.fields);
export const PROFILE_KEYS = ALL_FIELDS.filter((f) => !f.core).map((f) => f.key);

/** Primary-address field -> its secondary twin, for "same as primary". */
export const SAME_AS_PRIMARY: [string, string][] = [
  ["address", "secAddress"],
  ["city", "secCity"],
  ["pinCode", "secPinCode"],
  ["state", "secState"],
  ["country", "secCountry"],
  ["landline", "secLandline"],
];

export const RELATIONS = ["Spouse", "Father", "Mother", "Son", "Daughter", "Brother", "Sister", "Other"];

/** Keep only known keys with a value, so stray input never reaches the database. */
export function cleanProfile(input: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of PROFILE_KEYS) {
    const v = input?.[key]?.trim();
    if (v) out[key] = v;
  }
  return out;
}
