"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  rupeesToPaise,
  paiseToRupeeString,
  applyBasisPoints,
  formatINR,
} from "@/lib/money";

const today = new Date().toISOString().slice(0, 10);

const MODES = [
  ["bank_transfer", "Bank transfer"],
  ["rtgs", "RTGS"],
  ["neft", "NEFT"],
  ["cheque", "Cheque"],
  ["cash", "Cash"],
  ["upi", "UPI"],
  ["card", "Card"],
  ["other", "Other"],
] as const;

export function PaymentEntry({
  bookingId,
  canAdd,
  gstBps = 0,
}: {
  bookingId: string;
  canAdd: boolean;
  gstBps?: number; // booking GST rate in basis points (e.g. 500 = 5%)
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [paymentDate, setPaymentDate] = useState(today);
  const [basic, setBasic] = useState("");
  const [gst, setGst] = useState("");
  const [gstTouched, setGstTouched] = useState(false);
  const [mode, setMode] = useState<(typeof MODES)[number][0]>("bank_transfer");
  const [reference, setReference] = useState("");
  const [source, setSource] = useState<"customer" | "bank">("customer");
  const [overrideStageLimit, setOverrideStageLimit] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canAdd) return null;

  // Suggest GST = rate × basic, until the user edits GST manually.
  function onBasicChange(value: string) {
    setBasic(value);
    if (!gstTouched && gstBps > 0) {
      try {
        setGst(paiseToRupeeString(applyBasisPoints(rupeesToPaise(value || "0"), BigInt(gstBps))));
      } catch {
        /* ignore partial input */
      }
    }
  }

  function totalString(): string {
    try {
      return formatINR(rupeesToPaise(basic || "0") + rupeesToPaise(gst || "0"));
    } catch {
      return "—";
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    let attachmentUrl = "";
    if (file) {
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch("/api/upload", { method: "POST", body: fd });
      if (!up.ok) {
        const b = await up.json().catch(() => ({}));
        setBusy(false);
        setError(b.error ?? "Attachment upload failed");
        return;
      }
      attachmentUrl = (await up.json()).url;
    }

    let amount: string;
    try {
      amount = paiseToRupeeString(
        rupeesToPaise(basic || "0") + rupeesToPaise(gst || "0"),
      );
    } catch {
      setBusy(false);
      setError("Enter valid basic and GST amounts");
      return;
    }

    const res = await fetch(`/api/bookings/${bookingId}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentDate,
        amount,
        gstAmount: gst || "0",
        mode,
        source,
        overrideStageLimit,
        overrideReason,
        referenceNumber: reference,
        notes,
        attachmentUrl,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? `Failed (${res.status})`);
      return;
    }
    setOpen(false);
    setBasic("");
    setGst("");
    setGstTouched(false);
    setReference("");
    setNotes("");
    setFile(null);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        Record payment
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-hairline bg-canvas p-4">
      {error && (
        <p className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-muted">Payment date *</span>
          <input type="date" className={inp} value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">Basic amount (₹) *</span>
          <input className={inp} value={basic} onChange={(e) => onBasicChange(e.target.value)} placeholder="2000000" required />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">
            GST amount (₹){gstBps > 0 ? ` · ${gstBps / 100}% suggested` : ""}
          </span>
          <input
            className={inp}
            value={gst}
            onChange={(e) => {
              setGstTouched(true);
              setGst(e.target.value);
            }}
            placeholder="0"
          />
        </label>
        <p className="sm:col-span-2 -mt-1 text-xs text-muted">
          Total payment: <span className="money font-medium text-ink">{totalString()}</span>
          {" "}(basic + GST)
        </p>
        <label className="text-sm">
          <span className="mb-1 block text-muted">Mode</span>
          <select className={inp} value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
            {MODES.map(([val, lbl]) => (
              <option key={val} value={val}>{lbl}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">Reference no.</span>
          <input className={inp} value={reference} onChange={(e) => setReference(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">Payment source</span>
          <select
            className={inp}
            value={source}
            onChange={(e) => setSource(e.target.value as "customer" | "bank")}
          >
            <option value="customer">Customer contribution</option>
            <option value="bank">Bank release</option>
          </select>
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-muted">Notes</span>
          <input className={inp} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <label className="flex items-start gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            className="mt-1"
            checked={overrideStageLimit}
            onChange={(e) => setOverrideStageLimit(e.target.checked)}
          />
          <span>
            Admin override: allow collection above the currently eligible amount
          </span>
        </label>
        {overrideStageLimit && (
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-muted">Override reason *</span>
            <input
              className={inp}
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              required
            />
          </label>
        )}
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-muted">Attachment (receipt)</span>
          <input type="file" className="text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? "Saving..." : "Save payment"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}

export function DeletePaymentButton({
  bookingId,
  paymentId,
}: {
  bookingId: string;
  paymentId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function del() {
    if (!confirm("Delete this payment? Outstanding will be recalculated.")) return;
    setBusy(true);
    const res = await fetch(`/api/bookings/${bookingId}/payments/${paymentId}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else alert("Failed to delete payment");
  }

  return (
    <button onClick={del} disabled={busy} className="text-xs text-danger hover:underline disabled:opacity-50">
      {busy ? "..." : "Delete"}
    </button>
  );
}

const inp = "field";
