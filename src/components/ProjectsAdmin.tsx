"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Row {
  id: string;
  name: string;
  area: string;
  archived: boolean;
  units: number;
  clients: number;
  bookings: number;
}

/** Create, rename and archive projects (admin). */
export function ProjectsAdmin({ rows, canManage }: { rows: Row[]; canManage: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string; area: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(url: string, method: string, body: object) {
    setError(null);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? `Failed (${res.status})`), false;
    router.refresh();
    return true;
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>}
      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Project</th><th>Construction area</th>
              <th className="text-right">Units</th><th className="text-right">Clients</th><th className="text-right">Bookings</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) =>
              editing?.id === p.id ? (
                <tr key={p.id}>
                  <td><input className="field py-1" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></td>
                  <td><input className="field py-1" value={editing.area} onChange={(e) => setEditing({ ...editing, area: e.target.value })} /></td>
                  <td colSpan={3} />
                  <td className="whitespace-nowrap text-right">
                    <button className="btn-primary px-3 py-1" onClick={async () => (await send(`/api/projects/${p.id}`, "PATCH", { name: editing.name, area: editing.area })) && setEditing(null)}>Save</button>{" "}
                    <button className="btn-secondary px-3 py-1" onClick={() => setEditing(null)}>Cancel</button>
                  </td>
                </tr>
              ) : (
                <tr key={p.id} className={p.archived ? "opacity-50" : ""}>
                  <td className="font-medium">{p.name}{p.archived && <span className="ml-2 pill-neutral">Archived</span>}</td>
                  <td>{p.area || "—"}</td>
                  <td className="text-right">{p.units}</td>
                  <td className="text-right">{p.clients}</td>
                  <td className="text-right">{p.bookings}</td>
                  <td className="whitespace-nowrap text-right">
                    {canManage && (
                      <>
                        <button className="btn-secondary px-3 py-1" onClick={() => setEditing({ id: p.id, name: p.name, area: p.area })}>Rename</button>{" "}
                        <button className="btn-secondary px-3 py-1" onClick={() => send(`/api/projects/${p.id}`, "PATCH", { archived: !p.archived })}>
                          {p.archived ? "Restore" : "Archive"}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      {canManage && (
        <form
          className="card flex flex-wrap items-end gap-3 p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await send("/api/projects", "POST", { name, area })) {
              setName("");
              setArea("");
            }
          }}
        >
          <label className="text-xs text-muted">
            Project name
            <input className="field mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Splendora 3" required />
          </label>
          <label className="text-xs text-muted">
            Construction area
            <input className="field mt-1" value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Construction Area 1" />
          </label>
          <button className="btn-primary">Add project</button>
        </form>
      )}
    </div>
  );
}
