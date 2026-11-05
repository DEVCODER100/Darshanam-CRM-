/** The customer contact list behind the Messages page: who, how to reach them, which units, what is due. */
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, customers } from "@/db/schema";
import { activeProjectId, inProject } from "./project-scope";
import { loadAccounts } from "./statement-data";
import { todayISO } from "./dates";
import type { Params } from "./report-filters";

export interface Contact {
  id: string;
  name: string;
  clientCode: string | null;
  mobile: string;
  altMobile: string | null;
  email: string | null;
  units: { name: string; type: string }[];
  due: bigint; // overdue right now across their bookings
  smsOptIn: boolean;
  emailOptIn: boolean;
}

export interface ContactFilters {
  q?: string;
  type?: string;
  due?: "dues" | "clear";
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

export const parseContactFilters = (sp: Params): ContactFilters => ({
  q: one(sp.q),
  type: one(sp.type),
  due: one(sp.due) === "dues" ? "dues" : one(sp.due) === "clear" ? "clear" : undefined,
});

export function matchesContact(c: Contact, f: ContactFilters): boolean {
  if (f.q) {
    const q = f.q.toLowerCase();
    const hay = [c.name, c.mobile, c.altMobile, c.email, c.clientCode, ...c.units.map((u) => u.name)];
    if (!hay.some((h) => (h ?? "").toLowerCase().includes(q))) return false;
  }
  if (f.type && !c.units.some((u) => u.type === f.type)) return false;
  if (f.due === "dues" && c.due <= 0n) return false;
  if (f.due === "clear" && c.due > 0n) return false;
  return true;
}

export async function loadContacts(): Promise<Contact[]> {
  const pid = await activeProjectId();
  const [people, books, accounts] = await Promise.all([
    db.select().from(customers).where(inProject(customers.projectId, pid)).orderBy(asc(customers.fullName)),
    db
      .select({ id: bookings.id, customerId: bookings.customerId, type: bookings.propertyType, number: bookings.propertyNumber })
      .from(bookings)
      .where(inProject(bookings.projectId, pid)),
    loadAccounts(todayISO()),
  ]);
  return people.map((p) => {
    const mine = books.filter((b) => b.customerId === p.id);
    return {
      id: p.id,
      name: p.fullName,
      clientCode: p.clientCode,
      mobile: p.mobile,
      altMobile: p.alternateMobile,
      email: p.email,
      units: mine.map((b) => ({ name: `${b.type}${b.number ? ` ${b.number}` : ""}`, type: b.type })),
      due: mine.reduce((s, b) => s + (accounts.get(b.id)?.dueNow ?? 0n), 0n),
      smsOptIn: p.profile.notifySms !== "No",
      emailOptIn: p.profile.notifyEmail !== "No",
    };
  });
}
