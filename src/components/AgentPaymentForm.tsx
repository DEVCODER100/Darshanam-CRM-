"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Record brokerage or reward paid out to this agent. */
export function AgentPaymentForm({ agentId }: { agentId: string }) {
  const router = useRouter();
  const [f, setF] = useState({ kind: "brokerage", date: new Date().toISOString().slice(0, 10), amount: "", mode: "bank_transfer", reference: "" });
  const [error, setError] = useState<string | null>(null);
  const lab = "text-xs text-muted";
  const input = "field mt-1";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/agents/${agentId}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: f.kind, paymentDate: f.date, amount: f.amount, mode: f.mode, reference: f.reference }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      return setError((Object.values(b.issues?.fieldErrors ?? {}).flat()[0] as string) ?? b.error ?? `Failed (${res.status})`);
    }
    setF({ ...f, amount: "", reference: "" });
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card flex flex-wrap items-end gap-3 p-4 text-sm">
      <p className="basis-full font-medium">Record a payment to this agent</p>
      <label className={lab}>Paying
        <select className={input} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
          <option value="brokerage">Brokerage</option>
          <option value="reward">Reward</option>
        </select>
      </label>
      <label className={lab}>Date<input type="date" className={input} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} required /></label>
      <label className={`${lab} w-32`}>Amount (₹)<input className={input} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required /></label>
      <label className={lab}>Mode
        <select className={input} value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}>
          {["bank_transfer", "rtgs", "neft", "imps", "upi", "cheque", "cash"].map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
        </select>
      </label>
      <label className={lab}>Reference<input className={input} value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></label>
      <button className="btn-primary">Record</button>
      {error && <p className="basis-full text-danger">{error}</p>}
    </form>
  );
}
