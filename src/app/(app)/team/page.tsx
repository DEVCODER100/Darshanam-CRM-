import { redirect } from "next/navigation";
import { getCurrentUser, can } from "@/lib/rbac";
import { db } from "@/db";
import { users } from "@/db/schema";
import { asc } from "drizzle-orm";
import { TeamTable, type TeamMember } from "@/components/TeamTable";

export const dynamic = "force-dynamic";

const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: "Full access — can create, edit, delete all records and manage the team.",
  accountant: "Can view all reports and unmask Aadhaar/PAN. Read-only otherwise.",
  manager: "Can view reports. Read-only for all other data.",
  sales_executive: "Read-only access. Cannot view reports or sensitive data.",
};

export default async function TeamPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/sign-in");
  if (!can(currentUser.role, "user:manage")) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-medium text-ink">Team</h1>
        <p className="text-sm text-muted">
          You do not have permission to manage team members.
        </p>
      </div>
    );
  }

  const allUsers = await db
    .select()
    .from(users)
    .orderBy(asc(users.createdAt));

  const members: TeamMember[] = allUsers.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-medium text-ink">Team</h1>
        <p className="mt-1 text-sm text-muted">
          Manage your team members and their roles. New members join automatically
          when they sign in for the first time — you can update their role here.
        </p>
      </div>

      {/* Role reference card */}
      <section>
        <h2 className="mb-3 text-lg font-medium text-ink">Role permissions</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(ROLE_DESCRIPTIONS).map(([role, desc]) => (
            <div
              key={role}
              className="rounded-lg border border-hairline bg-surface p-4 shadow-card"
            >
              <p className="font-medium capitalize text-ink">
                {role.replace("_", " ")}
              </p>
              <p className="mt-1 text-sm text-muted">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Members table */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium text-ink">
            Members ({members.length})
          </h2>
          <p className="text-xs text-muted">
            To add a new member, invite them from your{" "}
            <a
              href="https://dashboard.clerk.com"
              target="_blank"
              rel="noreferrer"
              className="text-brass-dark hover:underline"
            >
              Clerk dashboard
            </a>{" "}
            — they&apos;ll appear here after first sign-in.
          </p>
        </div>
        <TeamTable members={members} currentUserId={currentUser.id} />
      </section>
    </div>
  );
}
