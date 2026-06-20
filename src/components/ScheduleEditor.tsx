"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  formatINR,
  rupeesToPaise,
  applyBasisPoints,
  bpsToPercentString,
} from "@/lib/money";

const today = new Date().toISOString().slice(0, 10);

interface Row {
  dueDate: string;
  amount: string; // rupee string
  label: string;
}

export function ScheduleEditor({
  bookingId,
  initial,
  canEdit,
  gstBps = 0,
  totalPaid = 0n,
}: {
  bookingId: string;
  initial: { dueDate: string; amount: string; label: string }[];
  canEdit: boolean;
  gstBps?: number; // booking GST rate in basis points, e.g. 500 = 5%
  totalPaid?: bigint;
}) {
  const router = useRouter();
  const gstPct = bpsToPercentString(BigInt(gstBps));
  const hasGst = gstBps > 0;
  const gstOf = (amount: string): bigint => {
    try {
      return amount ? applyBasisPoints(rupeesToPaise(amount), BigInt(gstBps)) : 0n;
    } catch {
      return 0n;
    }
  };
  const [rows, setRows] = useState<Row[]>(
    initial.length ? initial : [{ dueDate: "", amount: "", label: "" }],
  );
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (i: number, k: keyof Row, val: string) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [k]: val } : r)));
  const addRow = () =>
    setRows((rs) => [...rs, { dueDate: "", amount: "", label: "" }]);
  const removeRow = (i: number) =>
    setRows((rs) => rs.filter((_, idx) => idx !== i));

  function total(): string {
    try {
      const sum = rows.reduce(
        (s, r) => s + (r.amount ? rupeesToPaise(r.amount) : 0n),
        0n,
      );
      return formatINR(sum);
    } catch {
      return "—";
    }
  }

  function totalGst(): string {
    return formatINR(rows.reduce((s, r) => s + gstOf(r.amount), 0n));
  }

  async function save() {
    setBusy(true);
    setError(null);
    const payload = {
      rows: rows
        .filter((r) => r.dueDate && r.amount)
        .map((r) => ({ dueDate: r.dueDate, amount: r.amount, label: r.label })),
    };
    const res = await fetch(`/api/bookings/${bookingId}/schedule`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? `Failed (${res.status})`);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    let unallocatedPaid = totalPaid;
    return (
      <div>
        {initial.length === 0 ? (
          <p className="text-sm text-muted">No instalment plan yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-muted">
              <tr>
                <th className="py-1 font-medium">Due date</th>
                <th className="py-1 font-medium">Label</th>
                <th className="py-1 text-right font-medium">Amount</th>
                <th className="py-1 text-right font-medium">Paid</th>
                <th className="py-1 text-right font-medium">Remaining</th>
                <th className="py-1 text-right font-medium">Status</th>
                {hasGst && (
                  <>
                    <th className="py-1 text-right font-medium">GST ({gstPct}%)</th>
                    <th className="py-1 text-right font-medium">Amount + GST</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {initial.map((r, i) => {
                const amount = rupeesToPaise(r.amount);
                const paid = unallocatedPaid > amount ? amount : unallocatedPaid;
                unallocatedPaid -= paid;
                const remaining = amount - paid;
                const status =
                  remaining === 0n
                    ? "Paid"
                    : paid > 0n
                      ? "Partial"
                      : r.dueDate < today
                        ? "Overdue"
                        : "Pending";
                return (
                <tr key={i} className="border-t border-hairline">
                  <td className="py-1">{r.dueDate}</td>
                  <td className="py-1 text-muted">{r.label || "—"}</td>
                  <td className="money py-1 text-right">{formatINR(amount)}</td>
                  <td className="money py-1 text-right text-paid">{formatINR(paid)}</td>
                  <td className="money py-1 text-right">{formatINR(remaining)}</td>
                  <td className="py-1 text-right">
                    <span
                      className={
                        status === "Paid"
                          ? "pill-paid"
                          : status === "Overdue"
                            ? "pill-danger"
                            : status === "Partial"
                              ? "pill-due"
                              : "pill-neutral"
                      }
                    >
                      {status}
                    </span>
                  </td>
                  {hasGst && (
                    <>
                      <td className="money py-1 text-right text-muted">{formatINR(gstOf(r.amount))}</td>
                      <td className="money py-1 text-right">
                        {formatINR(rupeesToPaise(r.amount) + gstOf(r.amount))}
                      </td>
                    </>
                  )}
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {canEdit && (
          <button onClick={() => setEditing(true)} className="btn-secondary mt-3">
            {initial.length ? "Edit plan" : "Add plan"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>
      )}
      {rows.map((r, i) => (
        <div key={i} className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-muted">
            Due date
            <input
              type="date"
              className={inp}
              value={r.dueDate}
              onChange={(e) => update(i, "dueDate", e.target.value)}
            />
          </label>
          <label className="text-xs text-muted">
            Label
            <input
              className={inp}
              value={r.label}
              placeholder="Booking / Slab / Handover"
              onChange={(e) => update(i, "label", e.target.value)}
            />
          </label>
          <label className="text-xs text-muted">
            Amount (₹)
            <input
              className={inp}
              value={r.amount}
              placeholder="2000000"
              onChange={(e) => update(i, "amount", e.target.value)}
            />
          </label>
          {hasGst && (
            <span className="self-center text-xs text-muted">
              + GST {gstPct}%:{" "}
              <span className="money font-medium text-ink">{formatINR(gstOf(r.amount))}</span>
            </span>
          )}
          <button
            onClick={() => removeRow(i)}
            className="rounded-md border border-hairline px-2 py-2 text-xs text-danger hover:bg-danger-bg"
          >
            Remove
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={addRow} className="btn-secondary">
          + Add instalment
        </button>
        <span className="text-sm text-muted">
          Plan total: <span className="money">{total()}</span>
        </span>
        {hasGst && (
          <span className="text-sm text-muted">
            · GST {gstPct}%: <span className="money">{totalGst()}</span>
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <button onClick={save} disabled={busy} className="btn-primary">
          {busy ? "Saving..." : "Save plan"}
        </button>
        <button onClick={() => setEditing(false)} className="btn-secondary">
          Cancel
        </button>
      </div>
    </div>
  );
}

const inp = "mt-1 block field";
