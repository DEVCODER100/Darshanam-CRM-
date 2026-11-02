"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  formatINR,
  rupeesToPaise,
  paiseToRupeeString,
  applyBasisPoints,
  bpsToPercentString,
} from "@/lib/money";

const today = new Date().toISOString().slice(0, 10);

/** One saved instalment as it comes from the server (rupee strings). */
export interface ScheduleRowInput {
  dueDate: string;
  label: string;
  amount: string; // gross: basic + gst + other
  gstAmount: string;
  otherChargeAmount: string;
  documentationAmount: string;
  percentage: string; // "" when not set
}

interface Row {
  dueDate: string;
  label: string;
  basic: string;
  gst: string;
  gstTouched: boolean;
  other: string;
  doc: string;
  docTouched: boolean;
  percentage: string;
}

const blankRow = (): Row => ({
  dueDate: "",
  label: "",
  basic: "",
  gst: "",
  gstTouched: false,
  other: "",
  doc: "",
  docTouched: false,
  percentage: "",
});

const paise = (v: string): bigint => {
  try {
    return v ? rupeesToPaise(v) : 0n;
  } catch {
    return 0n;
  }
};

export function ScheduleEditor({
  bookingId,
  initial,
  canEdit,
  gstBps = 0,
  docBps = 0,
  totalPaid = 0n,
}: {
  bookingId: string;
  initial: ScheduleRowInput[];
  canEdit: boolean;
  gstBps?: number; // booking GST rate in basis points, e.g. 500 = 5%
  docBps?: number; // booking document-charge rate in basis points, e.g. 590 = 5.9%
  totalPaid?: bigint;
}) {
  const router = useRouter();
  const gstPct = bpsToPercentString(BigInt(gstBps));

  const fromInitial = (r: ScheduleRowInput): Row => ({
    dueDate: r.dueDate,
    label: r.label,
    basic: paiseToRupeeString(
      paise(r.amount) -
        paise(r.gstAmount) -
        paise(r.otherChargeAmount) -
        paise(r.documentationAmount),
    ),
    gst: r.gstAmount,
    gstTouched: true, // never overwrite saved GST
    other: r.otherChargeAmount,
    doc: r.documentationAmount,
    docTouched: true,
    percentage: r.percentage,
  });

  const [rows, setRows] = useState<Row[]>(
    initial.length ? initial.map(fromInitial) : [blankRow()],
  );
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = (i: number, p: Partial<Row>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...p } : r)));

  // Basic changes -> suggest GST at the booking rate until GST is edited by hand.
  function onBasic(i: number, value: string) {
    const r = rows[i];
    const next: Partial<Row> = { basic: value };
    if (!r.gstTouched && gstBps > 0)
      next.gst = paiseToRupeeString(applyBasisPoints(paise(value), BigInt(gstBps)));
    if (!r.docTouched && docBps > 0)
      next.doc = paiseToRupeeString(applyBasisPoints(paise(value), BigInt(docBps)));
    patch(i, next);
  }

  const gross = (r: Row) =>
    paise(r.basic) + paise(r.gst) + paise(r.other) + paise(r.doc);
  const sum = (f: (r: Row) => bigint) => rows.reduce((s, r) => s + f(r), 0n);

  async function save() {
    setBusy(true);
    setError(null);
    const payload = {
      rows: rows
        .filter((r) => r.dueDate && gross(r) > 0n)
        .map((r) => ({
          dueDate: r.dueDate,
          label: r.label,
          amount: paiseToRupeeString(gross(r)),
          gstAmount: r.gst || "0",
          otherChargeAmount: r.other || "0",
          documentationAmount: r.doc || "0",
          percentage: r.percentage,
        })),
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
    // Paid money is applied to instalments oldest-first (display only).
    let unallocatedPaid = totalPaid;
    return (
      <div>
        {initial.length === 0 ? (
          <p className="text-sm text-muted">No instalment plan yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted">
                <tr>
                  <th className="py-1 font-medium">Due date</th>
                  <th className="py-1 font-medium">Instalment</th>
                  <th className="py-1 text-right font-medium">%</th>
                  <th className="py-1 text-right font-medium">Basic</th>
                  <th className="py-1 text-right font-medium">GST</th>
                  <th className="py-1 text-right font-medium">Other</th>
                  <th className="py-1 text-right font-medium">Doc</th>
                  <th className="py-1 text-right font-medium">Total</th>
                  <th className="py-1 text-right font-medium">Paid</th>
                  <th className="py-1 text-right font-medium">Remaining</th>
                  <th className="py-1 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {initial.map((r, i) => {
                  const amount = paise(r.amount);
                  const gst = paise(r.gstAmount);
                  const other = paise(r.otherChargeAmount);
                  const doc = paise(r.documentationAmount);
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
                      <td className="py-1 text-right text-muted">
                        {r.percentage ? `${r.percentage}%` : "—"}
                      </td>
                      <td className="money py-1 text-right">{formatINR(amount - gst - other - doc)}</td>
                      <td className="money py-1 text-right text-muted">{formatINR(gst)}</td>
                      <td className="money py-1 text-right text-muted">{formatINR(other)}</td>
                      <td className="money py-1 text-right text-muted">{formatINR(doc)}</td>
                      <td className="money py-1 text-right font-medium">{formatINR(amount)}</td>
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
        <div key={i} className="flex flex-wrap items-end gap-2 rounded-md border border-hairline p-3">
          <label className="text-xs text-muted">
            Due date
            <input type="date" className={inp} value={r.dueDate} onChange={(e) => patch(i, { dueDate: e.target.value })} />
          </label>
          <label className="text-xs text-muted">
            Instalment name
            <input className={inp} value={r.label} placeholder="On completion of plinth" onChange={(e) => patch(i, { label: e.target.value })} />
          </label>
          <label className="w-20 text-xs text-muted">
            % of price
            <input className={inp} value={r.percentage} placeholder="10" onChange={(e) => patch(i, { percentage: e.target.value })} />
          </label>
          <label className="text-xs text-muted">
            Basic (₹)
            <input className={inp} value={r.basic} placeholder="1875000" onChange={(e) => onBasic(i, e.target.value)} />
          </label>
          <label className="text-xs text-muted">
            GST (₹){gstBps > 0 ? ` · ${gstPct}%` : ""}
            <input className={inp} value={r.gst} placeholder="0" onChange={(e) => patch(i, { gst: e.target.value, gstTouched: true })} />
          </label>
          <label className="text-xs text-muted">
            Other charges (₹)
            <input className={inp} value={r.other} placeholder="0" onChange={(e) => patch(i, { other: e.target.value })} />
          </label>
          <label className="text-xs text-muted">
            Document charges (₹){docBps > 0 ? ` · ${bpsToPercentString(BigInt(docBps))}%` : ""}
            <input className={inp} value={r.doc} placeholder="0" onChange={(e) => patch(i, { doc: e.target.value, docTouched: true })} />
          </label>
          <span className="self-center text-xs text-muted">
            Total <span className="money font-medium text-ink">{formatINR(gross(r))}</span>
          </span>
          <button
            onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}
            className="rounded-md border border-hairline px-2 py-2 text-xs text-danger hover:bg-danger-bg"
          >
            Remove
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
        <button onClick={() => setRows((rs) => [...rs, blankRow()])} className="btn-secondary">
          + Add instalment
        </button>
        <span>Basic <span className="money">{formatINR(sum((r) => paise(r.basic)))}</span></span>
        <span>GST <span className="money">{formatINR(sum((r) => paise(r.gst)))}</span></span>
        <span>Other <span className="money">{formatINR(sum((r) => paise(r.other)))}</span></span>
        <span>Doc <span className="money">{formatINR(sum((r) => paise(r.doc)))}</span></span>
        <span>Plan total <span className="money font-medium text-ink">{formatINR(sum(gross))}</span></span>
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
