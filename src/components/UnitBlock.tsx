"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export interface BlockUnitChoice {
  id: string;
  label: string;
}
export interface StaffChoice {
  id: string;
  name: string;
}
interface Found {
  id: string;
  fullName: string;
  mobile: string;
  clientCode: string | null;
}

/**
 * The Block Unit form: who the unit is held for (a client picked by name, mobile
 * or ID, or just a name and number), why, until when, and who blocked it.
 * Pass `units` to let the user choose the unit; otherwise it blocks `unitId`.
 */
export function BlockForm({
  unitId,
  units,
  staff,
  currentUserId,
  onDone,
}: {
  unitId?: string;
  units?: BlockUnitChoice[];
  staff: StaffChoice[];
  currentUserId: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [unit, setUnit] = useState(unitId ?? "");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [found, setFound] = useState<Found[]>([]);
  const [open, setOpen] = useState(false);
  const [never, setNever] = useState(true);
  const [until, setUntil] = useState("");
  const [reason, setReason] = useState("");
  const [by, setBy] = useState(currentUserId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Suggest existing clients as the user types a name, mobile, email or client ID.
  useEffect(() => {
    if (!open || name.trim().length < 2) return setFound([]);
    const t = setTimeout(async () => {
      const res = await fetch(`/api/customers?q=${encodeURIComponent(name.trim())}`);
      setFound(res.ok ? (await res.json()).customers : []);
    }, 200);
    return () => clearTimeout(t);
  }, [name, open]);

  const pick = (c: Found) => {
    setName(c.fullName);
    setMobile(c.mobile);
    setCustomerId(c.id);
    setOpen(false);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!unit) return setError("Choose a unit.");
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/units/${unit}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blocked: true,
        customerId,
        name,
        mobile,
        blockReason: reason,
        unblockOn: never ? "" : until,
        blockedBy: by,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      return setError(b.error ?? `Failed (${res.status})`);
    }
    onDone();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3 text-sm">
      {error && <p className="rounded-md bg-danger-bg px-3 py-2 text-danger">{error}</p>}
      {units && (
        <Row label="Unit" required>
          <select className="field" value={unit} onChange={(e) => setUnit(e.target.value)} required>
            <option value="">—Select a free unit—</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
        </Row>
      )}
      <Row label="Client" required>
        <div className="relative">
          <input
            className="field"
            placeholder="Name / contact no. / email / client ID"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setCustomerId("");
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            required
          />
          {open && found.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded-md border border-hairline bg-surface py-1 shadow-lg">
              {found.map((c) => (
                <li key={c.id}>
                  <button type="button" className="block w-full px-3 py-1.5 text-left hover:bg-canvas" onMouseDown={() => pick(c)}>
                    {c.fullName} <span className="text-muted">· {c.mobile}{c.clientCode ? ` · ${c.clientCode}` : ""}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {!customerId && name.length >= 2 && <p className="mt-1 text-xs text-muted">Not picked from the list: held under this name only.</p>}
      </Row>
      <Row label="Contact no." required>
        <input className="field" value={mobile} onChange={(e) => setMobile(e.target.value)} required />
      </Row>
      <Row label="Unblock on" required>
        <div className="flex items-center gap-2">
          <select className="field w-32" value={never ? "never" : "date"} onChange={(e) => setNever(e.target.value === "never")}>
            <option value="never">Never</option>
            <option value="date">On a date</option>
          </select>
          {!never && <input type="date" className="field w-44" value={until} onChange={(e) => setUntil(e.target.value)} required />}
        </div>
      </Row>
      <Row label="Remarks">
        <textarea className="field" rows={2} placeholder="Reason, e.g. token received, deciding by 15 Nov" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Row>
      <Row label="Blocked by">
        <select className="field" value={by} onChange={(e) => setBy(e.target.value)}>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Row>
      <div className="flex gap-2">
        <button disabled={busy} className="btn-primary">{busy ? "Saving..." : "Save"}</button>
        <button type="button" onClick={onDone} className="btn-secondary">Cancel</button>
      </div>
    </form>
  );
}

function Row({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-medium text-ink">
        {label}
        {required && <span className="text-danger"> *</span>}
      </span>
      {children}
    </label>
  );
}

/** Block a free unit or release a blocked one, from the unit's panel. */
export function UnitBlock({
  unitId,
  blocked,
  staff,
  currentUserId,
}: {
  unitId: string;
  blocked: boolean;
  staff: StaffChoice[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  async function release() {
    setBusy(true);
    await fetch(`/api/units/${unitId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocked: false }),
    });
    setBusy(false);
    router.refresh();
  }

  if (blocked)
    return (
      <button onClick={release} disabled={busy} className="btn-secondary">
        {busy ? "Releasing..." : "Release unit"}
      </button>
    );
  if (!asking) return <button onClick={() => setAsking(true)} className="btn-secondary">Block unit</button>;
  return (
    <div className="w-full">
      <BlockForm unitId={unitId} staff={staff} currentUserId={currentUserId} onDone={() => setAsking(false)} />
    </div>
  );
}
