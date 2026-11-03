"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BlockForm, type BlockUnitChoice, type StaffChoice } from "@/components/UnitBlock";

/** Always-visible "Book a unit" and "Block a unit" buttons for the dashboard. */
export function UnitQuickActions({
  freeUnits,
  staff,
  currentUserId,
  canBook,
  canBlock,
}: {
  freeUnits: BlockUnitChoice[];
  staff: StaffChoice[];
  currentUserId: string;
  canBook: boolean;
  canBlock: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"book" | "block" | null>(null);
  const [unit, setUnit] = useState("");
  const toggle = (m: "book" | "block") => setMode((cur) => (cur === m ? null : m));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {canBook && (
          <button onClick={() => toggle("book")} className={mode === "book" ? "btn-primary" : "btn-secondary"}>
            Book a unit
          </button>
        )}
        {canBlock && (
          <button onClick={() => toggle("block")} className={mode === "block" ? "btn-primary" : "btn-secondary"}>
            Block a unit
          </button>
        )}
      </div>

      {mode === "book" && (
        <div className="card flex max-w-xl flex-wrap items-end gap-3 p-4">
          <label className="min-w-0 flex-1 text-sm">
            <span className="mb-1 block font-medium">Which unit?</span>
            <select className="field" value={unit} onChange={(e) => setUnit(e.target.value)}>
              <option value="">—Select a free unit—</option>
              {freeUnits.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
            </select>
          </label>
          <button disabled={!unit} onClick={() => router.push(`/bookings/new?unitId=${unit}`)} className="btn-primary">
            Continue
          </button>
          {freeUnits.length === 0 && <p className="w-full text-sm text-muted">No free units. Add units first.</p>}
        </div>
      )}

      {mode === "block" && (
        <div className="card max-w-xl p-4">
          <BlockForm units={freeUnits} staff={staff} currentUserId={currentUserId} onDone={() => setMode(null)} />
        </div>
      )}
    </div>
  );
}
