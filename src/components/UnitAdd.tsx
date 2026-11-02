"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TYPES = ["Bungalow", "Villa", "Apartment", "Flat", "Shop", "Plot"] as const;

/** Admin tool: add one unit, or many at once ("20 bungalows" -> Bungalow 1..20). */
export function UnitAdd() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unitType, setUnitType] = useState<(typeof TYPES)[number]>("Bungalow");
  const [projectName, setProjectName] = useState("");
  const [count, setCount] = useState("20");
  const [start, setStart] = useState("1");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/units", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        unitType,
        projectName,
        count: Number(count),
        start: Number(start),
      }),
    });
    setBusy(false);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage({ ok: false, text: body.error ?? `Failed (${res.status})` });
      return;
    }
    const skipped = body.requested - body.created;
    setMessage({
      ok: true,
      text: `Added ${body.created} unit${body.created === 1 ? "" : "s"}${skipped ? ` (${skipped} already existed)` : ""}.`,
    });
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-secondary px-3 py-1.5">
        + Add units
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="card flex flex-wrap items-end gap-3 p-3">
      <label className="text-xs text-muted">
        Type
        <select className="field mt-1" value={unitType} onChange={(e) => setUnitType(e.target.value as typeof unitType)}>
          {TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </label>
      <label className="text-xs text-muted">
        Project (optional)
        <input className="field mt-1" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
      </label>
      <label className="w-24 text-xs text-muted">
        How many
        <input className="field mt-1" type="number" min="1" max="500" value={count} onChange={(e) => setCount(e.target.value)} />
      </label>
      <label className="w-24 text-xs text-muted">
        Start at no.
        <input className="field mt-1" type="number" min="0" value={start} onChange={(e) => setStart(e.target.value)} />
      </label>
      <button disabled={busy} className="btn-primary px-3 py-2">{busy ? "Adding..." : "Add"}</button>
      <button type="button" onClick={() => setOpen(false)} className="btn-secondary px-3 py-2">Close</button>
      {message && (
        <p className={`basis-full text-sm ${message.ok ? "text-paid" : "text-danger"}`}>{message.text}</p>
      )}
    </form>
  );
}
