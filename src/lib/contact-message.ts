/** Phone cleaning, message templates and click-to-contact links. Pure. */

/** Digits only, +91 added to a 10-digit Indian number: "98765 43210" -> "919876543210". */
export function waNumber(mobile: string): string {
  const d = mobile.replace(/\D/g, "").replace(/^0+/, "");
  return d.length === 10 ? `91${d}` : d;
}

export const TEMPLATES: { key: string; label: string; text: string }[] = [
  {
    key: "reminder",
    label: "Payment reminder",
    text: "Dear {name}, this is a reminder from {project}: the payment due for {unit} ({due}) is pending. Kindly clear it at the earliest. Thank you.",
  },
  {
    key: "greeting",
    label: "Greeting / festival",
    text: "Dear {name}, warm greetings from {project}. Wishing you and your family joy and prosperity.",
  },
  {
    key: "documents",
    label: "Document request",
    text: "Dear {name}, for your booking of {unit} at {project}, please share your pending documents (Aadhaar, PAN, photo, address proof) at the earliest. Thank you.",
  },
  { key: "custom", label: "Custom", text: "Dear {name}, " },
];

export const AGENT_TEMPLATES: typeof TEMPLATES = [
  {
    key: "brokerage",
    label: "Brokerage due",
    text: "Dear {name}, as per our records your brokerage due from {project} is {due}. We will process it shortly. Thank you for your support.",
  },
  {
    key: "greeting",
    label: "Greeting / festival",
    text: "Dear {name}, warm greetings from {project}. Wishing you and your family joy and prosperity.",
  },
  {
    key: "inventory",
    label: "Availability update",
    text: "Dear {name}, units are available for booking at {project}. Please get in touch for the latest availability and rates. Thank you.",
  },
  { key: "custom", label: "Custom", text: "Dear {name}, " },
];

/** Fill {name}, {unit}, {due}, {project}; anything unknown is left as written. */
export function renderMessage(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
}

const q = (s: string) => encodeURIComponent(s);

export const whatsappLink = (mobile: string, text: string) => `https://wa.me/${waNumber(mobile)}?text=${q(text)}`;
export const smsLink = (mobile: string, text: string) => `sms:+${waNumber(mobile)}?body=${q(text)}`;
export const mailLink = (email: string, subject: string, text: string) => `mailto:${email}?subject=${q(subject)}&body=${q(text)}`;
export const callLink = (mobile: string) => `tel:+${waNumber(mobile)}`;
