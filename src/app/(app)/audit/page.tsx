import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "audit:view")) {
    return (
      <div>
        <h1 className="text-2xl font-medium">Audit log</h1>
        <p className="mt-2 rounded-md bg-due-bg px-3 py-2 text-sm text-due">
          Only administrators can view the audit log.
        </p>
      </div>
    );
  }

  const rows = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      timestamp: auditLog.timestamp,
      beforeJson: auditLog.beforeJson,
      afterJson: auditLog.afterJson,
      userName: users.name,
      userEmail: users.email,
    })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.userId, users.id))
    .orderBy(desc(auditLog.timestamp))
    .limit(500);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-medium">Audit log</h1>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No audit entries yet.</p>
      ) : (
        <div className="overflow-hidden rounded border border-hairline bg-white">
          <table className="w-full text-sm">
            <thead className="bg-canvas text-left text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">When</th>
                <th className="px-4 py-2 font-medium">User</th>
                <th className="px-4 py-2 font-medium">Action</th>
                <th className="px-4 py-2 font-medium">Entity</th>
                <th className="px-4 py-2 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-hairline align-top">
                  <td className="px-4 py-2 whitespace-nowrap text-muted">
                    {new Date(r.timestamp).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-2">{r.userName ?? r.userEmail ?? "—"}</td>
                  <td className="px-4 py-2">
                    <span className="pill-neutral">{r.action}</span>
                  </td>
                  <td className="px-4 py-2 text-muted">
                    {r.entityType}
                    <span className="block font-mono text-xs text-muted">
                      {r.entityId?.slice(0, 8)}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <details>
                      <summary className="cursor-pointer text-xs text-brass-dark">
                        before / after
                      </summary>
                      <pre className="mt-1 max-w-md overflow-auto rounded bg-canvas p-2 text-xs">
                        {JSON.stringify(
                          { before: r.beforeJson, after: r.afterJson },
                          null,
                          2,
                        )}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
