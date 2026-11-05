"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatINR } from "@/lib/money";

interface AgentRow {
  id: string;
  name: string;
  mobile: string | null;
  pan: string | null;
  bps: number;
  archived: boolean;
  earned: bigint;
  paid: bigint;
  due: bigint;
}
interface PaymentRow {
  id: string;
  agentName: string;
  date: string;
  amount: bigint;
  mode: string;
  reference: string | null;
}

/** Agents of the selected project: add, edit commission, archive, and record brokerage paid. */
export function AgentsAdmin({ agents, payments, canManage }: { agents: AgentRow[]; payments: PaymentRow[]; canManage: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ id: string; percent: string } | null>(null);
  const [form, setForm] = useState({ name: "", mobile: "", pan: "", commissionPercent: "2" });
  const [pay, setPay] = useState({ agent: "", date: new Date().toISOString().slice(0, 10), amount: "", mode: "bank_transfer", reference: "" });

  async function send(url: string, method: string, body: object) {
    setError(null);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      const fields = Object.values(b.issues?.fieldErrors ?? {}).flat() as string[];
      setError(fields[0] ?? b.error ?? `Failed (${res.status})`);
      return false;
    }
    router.refresh();
    return true;
  }
  const input = "field mt-1";
  const lab = "text-xs text-muted";

  return (
    <div className="space-y-5">
      {error && <p className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>}
      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Agent</th><th>Mobile</th><th>PAN</th><th className="text-right">Commission</th>
              <th className="text-right">Earned</th><th className="text-right">Paid</th><th className="text-right">Due</th><th />
            </tr>
          </thead>
          <tbody>
            {agents.length === 0 && <tr><td colSpan={8} className="text-muted">No agents in this project yet.</td></tr>}
            {agents.map((a) => (
              <tr key={a.id} className={a.archived ? "opacity-50" : ""}>
                <td className="font-medium">{a.name}{a.archived && <span className="ml-2 pill-neutral">Archived</span>}</td>
                <td className="text-muted">{a.mobile ?? "—"}</td>
                <td className="font-mono text-xs text-muted">{a.pan ?? "—"}</td>
                <td className="text-right">
                  {edit?.id === a.id ? (
                    <span className="flex items-center justify-end gap-1">
                      <input className="field w-20 py-1" value={edit.percent} onChange={(e) => setEdit({ id: a.id, percent: e.target.value })} />%
                      <button className="btn-primary px-2 py-1" onClick={async () => (await send(`/api/agents/${a.id}`, "PATCH", { commissionPercent: edit.percent })) && setEdit(null)}>Save</button>
                    </span>
                  ) : (
                    `${a.bps / 100}%`
                  )}
                </td>
                <td className="money text-right">{formatINR(a.earned)}</td>
                <td className="money text-right text-paid">{formatINR(a.paid)}</td>
                <td className="money text-right font-medium text-due">{formatINR(a.due)}</td>
                <td className="whitespace-nowrap text-right">
                  {canManage && (
                    <>
                      <button className="btn-secondary px-2 py-1" onClick={() => setEdit({ id: a.id, percent: String(a.bps / 100) })}>Edit %</button>{" "}
                      <button className="btn-secondary px-2 py-1" onClick={() => send(`/api/agents/${a.id}`, "PATCH", { archived: !a.archived })}>{a.archived ? "Restore" : "Archive"}</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">Commission is earned on the basic amount actually received on each agent&apos;s bookings (not GST or other charges). Due = earned − paid.</p>

      {canManage && (
        <div className="grid gap-4 lg:grid-cols-2">
          <form
            className="card flex flex-wrap items-end gap-3 p-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await send("/api/agents", "POST", form)) setForm({ name: "", mobile: "", pan: "", commissionPercent: "2" });
            }}
          >
            <p className="basis-full font-medium">Add an agent</p>
            <label className={lab}>Name<input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
            <label className={lab}>Mobile<input className={input} value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></label>
            <label className={lab}>PAN (stored masked)<input className={`${input} font-mono uppercase`} maxLength={10} value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value })} /></label>
            <label className={`${lab} w-24`}>Commission %<input className={input} value={form.commissionPercent} onChange={(e) => setForm({ ...form, commissionPercent: e.target.value })} /></label>
            <button className="btn-primary">Add agent</button>
          </form>

          <form
            className="card flex flex-wrap items-end gap-3 p-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await send(`/api/agents/${pay.agent}/payments`, "POST", { paymentDate: pay.date, amount: pay.amount, mode: pay.mode, reference: pay.reference })) setPay({ ...pay, amount: "", reference: "" });
            }}
          >
            <p className="basis-full font-medium">Record brokerage paid</p>
            <label className={lab}>Agent
              <select className={input} value={pay.agent} onChange={(e) => setPay({ ...pay, agent: e.target.value })} required>
                <option value="">—Select—</option>
                {agents.filter((a) => !a.archived).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            <label className={lab}>Date<input type="date" className={input} value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} required /></label>
            <label className={`${lab} w-32`}>Amount (₹)<input className={input} value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} required /></label>
            <label className={lab}>Mode
              <select className={input} value={pay.mode} onChange={(e) => setPay({ ...pay, mode: e.target.value })}>
                {["bank_transfer", "rtgs", "neft", "imps", "upi", "cheque", "cash"].map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
              </select>
            </label>
            <label className={lab}>Reference<input className={input} value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} /></label>
            <button className="btn-primary">Record</button>
          </form>
        </div>
      )}

      {payments.length > 0 && (
        <div>
          <h2 className="mb-2 text-lg font-medium">Recent brokerage payments</h2>
          <div className="card overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Agent</th><th>Mode</th><th>Reference</th><th className="text-right">Amount</th></tr></thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap">{p.date}</td><td>{p.agentName}</td>
                    <td className="text-muted">{p.mode.replace("_", " ")}</td><td className="text-muted">{p.reference ?? "—"}</td>
                    <td className="money text-right">{formatINR(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
