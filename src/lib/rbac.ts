/**
 * rbac.ts — server-side role enforcement (PRD §2, §3).
 *
 * The "Hard rule": roles are enforced on the server for every mutating route,
 * never by hiding UI. Capabilities are centralised here as a role -> capability
 * matrix so each API route just asks `requireCapability("payment:create")`.
 *
 * Reads are open to any authenticated staff member in Phase 1; the capabilities
 * gate MUTATIONS and sensitive reads (unmasking Aadhaar/PAN, financial reports).
 */
import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { can, type Capability, type Role } from "@/lib/permissions";

export { can };
export type { Capability, Role, AuditAction, AuditEntity } from "@/lib/permissions";

export interface CurrentUser {
  id: string;
  clerkUserId: string;
  name: string;
  email: string;
  role: Role;
}

/** Emails listed in ADMIN_EMAILS (comma-separated) are always admins. */
function isAdminEmail(email: string): boolean {
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

/**
 * Resolve the current staff user, syncing a row from the Clerk identity.
 * Admin assignment: any email in ADMIN_EMAILS is promoted to `admin` on sign-in.
 * Otherwise the very first user to sign in becomes `admin` (bootstrap) and
 * everyone after defaults to least-privilege `manager` until promoted.
 * Returns null when there is no Clerk session.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return null;

  const existing = await db.query.users.findFirst({
    where: eq(users.clerkUserId, clerkUserId),
  });
  if (existing) {
    // Auto-heal: an allowlisted email that isn't admin yet gets promoted.
    if (isAdminEmail(existing.email) && existing.role !== "admin") {
      await db.update(users).set({ role: "admin" }).where(eq(users.id, existing.id));
      existing.role = "admin";
    }
    return {
      id: existing.id,
      clerkUserId: existing.clerkUserId,
      name: existing.name,
      email: existing.email,
      role: existing.role,
    };
  }

  // First sign-in for this Clerk account: provision a row.
  const clerk = await currentUser();
  const email =
    clerk?.emailAddresses?.[0]?.emailAddress ?? `${clerkUserId}@unknown.local`;
  const name =
    [clerk?.firstName, clerk?.lastName].filter(Boolean).join(" ") || email;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users);
  const role: Role = isAdminEmail(email)
    ? "admin"
    : count === 0
      ? "admin"
      : "manager";

  const [created] = await db
    .insert(users)
    .values({ clerkUserId, name, email, role })
    .onConflictDoUpdate({
      target: users.clerkUserId,
      set: { name, email },
    })
    .returning();

  return {
    id: created.id,
    clerkUserId: created.clerkUserId,
    name: created.name,
    email: created.email,
    role: created.role,
  };
}

// --- API route guards -------------------------------------------------------

type Gate =
  | { ok: true; user: CurrentUser }
  | { ok: false; response: NextResponse };

const unauthorized = (): Gate => ({
  ok: false,
  response: NextResponse.json({ error: "Unauthenticated" }, { status: 401 }),
});

const forbidden = (): Gate => ({
  ok: false,
  response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
});

/** Require a signed-in staff user (any role). */
export async function requireAuth(): Promise<Gate> {
  const user = await getCurrentUser();
  return user ? { ok: true, user } : unauthorized();
}

/** Require a signed-in user whose role holds the given capability. */
export async function requireCapability(
  capability: Capability,
): Promise<Gate> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!can(user.role, capability)) return forbidden();
  return { ok: true, user };
}
