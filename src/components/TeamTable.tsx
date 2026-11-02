"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Role = "admin" | "accountant" | "sales_executive" | "manager";

const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  accountant: "Accountant",
  sales_executive: "Sales Executive",
  manager: "Manager",
};

const ROLE_COLORS: Record<Role, string> = {
  admin: "pill bg-brass/10 text-brass-dark",
  accountant: "pill bg-blue-50 text-blue-700",
  sales_executive: "pill bg-green-50 text-green-700",
  manager: "pill bg-slate-100 text-slate-600",
};

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
};

export function TeamTable({
  members,
  currentUserId,
}: {
  members: TeamMember[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<Role>("manager");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveRole(id: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: editRole }),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "Failed to update role");
      return;
    }
    setEditingId(null);
    router.refresh();
  }

  async function removeMember(id: string, name: string) {
    if (!confirm(`Remove ${name} from the team? They will lose access immediately.`)) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "Failed to remove member");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Joined</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const isSelf = m.id === currentUserId;
              const isEditing = editingId === m.id;
              return (
                <tr key={m.id}>
                  <td className="font-medium text-ink">
                    {m.name}
                    {isSelf && (
                      <span className="ml-2 text-xs text-muted">(you)</span>
                    )}
                  </td>
                  <td className="text-muted">{m.email}</td>
                  <td>
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <select
                          className="field py-1 text-sm"
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value as Role)}
                          autoFocus
                        >
                          {Object.entries(ROLE_LABELS).map(([val, label]) => (
                            <option key={val} value={val}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => saveRole(m.id)}
                          disabled={busy}
                          className="btn-primary py-1 text-xs"
                        >
                          {busy ? "..." : "Save"}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="btn-secondary py-1 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <span className={ROLE_COLORS[m.role]}>
                        {ROLE_LABELS[m.role]}
                      </span>
                    )}
                  </td>
                  <td className="text-muted">
                    {new Date(m.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="text-right">
                    {!isSelf && !isEditing && (
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => {
                            setEditingId(m.id);
                            setEditRole(m.role);
                            setError(null);
                          }}
                          className="text-xs text-brass-dark hover:underline"
                        >
                          Change role
                        </button>
                        <button
                          onClick={() => removeMember(m.id, m.name)}
                          disabled={busy}
                          className="text-xs text-danger hover:underline disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
