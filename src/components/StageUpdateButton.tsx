"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CONSTRUCTION_STAGES } from "@/lib/stage";

export function StageUpdateButton({
  bookingId,
  currentStage,
  canEdit,
}: {
  bookingId: string;
  currentStage: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState(currentStage ?? "");
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canEdit) return null;

  async function save() {
    if (!stage) {
      setError("Select a stage");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/bookings/${bookingId}/stage`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentStage: stage, remarks }),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? `Failed (${res.status})`);
      return;
    }
    setOpen(false);
    setRemarks("");
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-secondary">
        Update construction stage
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-hairline bg-canvas p-4">
      {error && (
        <p className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-muted">New construction stage</span>
          <select className="field" value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="">Select stage</option>
            {CONSTRUCTION_STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label} ({s.percentBps / 100}%)
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">Remarks</span>
          <input className="field" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. slab completed" />
        </label>
      </div>
      <div className="flex gap-2">
        <button onClick={save} disabled={busy} className="btn-primary">
          {busy ? "Saving..." : "Update stage"}
        </button>
        <button onClick={() => setOpen(false)} className="btn-secondary">
          Cancel
        </button>
      </div>
    </div>
  );
}
