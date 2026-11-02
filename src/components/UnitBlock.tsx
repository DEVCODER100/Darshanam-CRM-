"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Block a free unit (with a reason) or release a blocked one. Admin only. */
export function UnitBlock({ unitId, blocked }: { unitId: string; blocked: boolean }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(nextBlocked: boolean) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/units/${unitId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocked: nextBlocked, blockReason: reason }),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? `Failed (${res.status})`);
      return;
    }
    setAsking(false);
    setReason("");
    router.refresh();
  }

  if (blocked) {
    return (
      <div>
        <button onClick={() => send(false)} disabled={busy} className="btn-secondary">
          {busy ? "Releasing..." : "Release unit"}
        </button>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </div>
    );
  }

  if (!asking) {
    return (
      <button onClick={() => setAsking(true)} className="btn-secondary">
        Block unit
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <input
        className="field"
        placeholder="Reason, e.g. held for Mr. Shah until 15 Nov"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="flex gap-2">
        <button onClick={() => send(true)} disabled={busy} className="btn-primary">
          {busy ? "Blocking..." : "Block"}
        </button>
        <button onClick={() => setAsking(false)} className="btn-secondary">Cancel</button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
