"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UNIT_TYPES } from "@/lib/validators";
import { REWARD_KINDS } from "@/lib/agent-rates";

export interface BrokeragePlanRow { id: string; name: string; defaultPercent: string; perType: Record<string, string>; archived: boolean; agents: number }
export interface RewardPlanRow { id: string; name: string; kind: "per_booking" | "percent_sales"; value: string; archived: boolean; agents: number }

/** Create and edit brokerage plans (a % per unit type) and reward plans (a bonus rule). */
export function AgentPlans({ brokerage, reward, canManage }: { brokerage: BrokeragePlanRow[]; reward: RewardPlanRow[]; canManage: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [b, setB] = useState<Record<string, BrokeragePlanRow>>(() => Object.fromEntries(brokerage.map((p) => [p.id, p])));
  const [r, setR] = useState<Record<string, RewardPlanRow>>(() => Object.fromEntries(reward.map((p) => [p.id, p])));
  const [nb, setNb] = useState({ name: "", defaultPercent: "2" });
  const [nr, setNr] = useState({ name: "", kind: "per_booking", value: "" });

  async function send(url: string, method: string, body: object) {
    setError(null);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError((Object.values(j.issues?.fieldErrors ?? {}).flat()[0] as string) ?? j.error ?? `Failed (${res.status})`);
      return false;
    }
    router.refresh();
    return true;
  }
  const lab = "text-xs text-muted";
  const unit = (kind: string) => (kind === "per_booking" ? "₹ per booking" : "% of sales");

  return (
    <div className="space-y-8">
      {error && <p className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Brokerage plans</h2>
        <p className="text-sm text-muted">The default % applies to every unit type; a type box overrides it (leave it blank to use the default).</p>
        {Object.values(b).map((p) => (
          <div key={p.id} className={`card flex flex-wrap items-end gap-3 p-3 text-sm ${p.archived ? "opacity-50" : ""}`}>
            <label className={lab}>Plan<input className="field mt-1 w-40" value={p.name} disabled={!canManage} onChange={(e) => setB({ ...b, [p.id]: { ...p, name: e.target.value } })} /></label>
            <label className={`${lab} w-24`}>Default %<input className="field mt-1" value={p.defaultPercent} disabled={!canManage} onChange={(e) => setB({ ...b, [p.id]: { ...p, defaultPercent: e.target.value } })} /></label>
            {UNIT_TYPES.map((t) => (
              <label key={t} className={`${lab} w-20`}>{t} %
                <input className="field mt-1" value={p.perType[t] ?? ""} disabled={!canManage} onChange={(e) => setB({ ...b, [p.id]: { ...p, perType: { ...p.perType, [t]: e.target.value } } })} />
              </label>
            ))}
            <span className="text-xs text-muted">{p.agents} agent{p.agents === 1 ? "" : "s"}</span>
            {canManage && (
              <span className="ml-auto flex gap-2">
                <button className="btn-primary px-3 py-1.5" onClick={() => send(`/api/agent-plans/${p.id}`, "PATCH", { type: "brokerage", name: p.name, defaultPercent: p.defaultPercent, perType: p.perType })}>Save</button>
                <button className="btn-secondary px-3 py-1.5" onClick={() => send(`/api/agent-plans/${p.id}`, "PATCH", { type: "brokerage", archived: !p.archived })}>{p.archived ? "Restore" : "Archive"}</button>
              </span>
            )}
          </div>
        ))}
        {canManage && (
          <form className="card flex flex-wrap items-end gap-3 p-3 text-sm" onSubmit={async (e) => { e.preventDefault(); if (await send("/api/agent-plans", "POST", { type: "brokerage", ...nb })) setNb({ name: "", defaultPercent: "2" }); }}>
            <label className={lab}>New plan name<input className="field mt-1" value={nb.name} onChange={(e) => setNb({ ...nb, name: e.target.value })} required /></label>
            <label className={`${lab} w-28`}>Default %<input className="field mt-1" value={nb.defaultPercent} onChange={(e) => setNb({ ...nb, defaultPercent: e.target.value })} /></label>
            <button className="btn-secondary px-3 py-2">Add brokerage plan</button>
          </form>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Reward plans</h2>
        <p className="text-sm text-muted">A bonus on top of brokerage: a fixed amount for every booking an agent brings, or a % of the sales value.</p>
        {Object.values(r).map((p) => (
          <div key={p.id} className={`card flex flex-wrap items-end gap-3 p-3 text-sm ${p.archived ? "opacity-50" : ""}`}>
            <label className={lab}>Plan<input className="field mt-1 w-40" value={p.name} disabled={!canManage} onChange={(e) => setR({ ...r, [p.id]: { ...p, name: e.target.value } })} /></label>
            <label className={lab}>Rule
              <select className="field mt-1" value={p.kind} disabled={!canManage} onChange={(e) => setR({ ...r, [p.id]: { ...p, kind: e.target.value as RewardPlanRow["kind"] } })}>
                {Object.entries(REWARD_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
            <label className={`${lab} w-32`}>{unit(p.kind)}<input className="field mt-1" value={p.value} disabled={!canManage} onChange={(e) => setR({ ...r, [p.id]: { ...p, value: e.target.value } })} /></label>
            <span className="text-xs text-muted">{p.agents} agent{p.agents === 1 ? "" : "s"}</span>
            {canManage && (
              <span className="ml-auto flex gap-2">
                <button className="btn-primary px-3 py-1.5" onClick={() => send(`/api/agent-plans/${p.id}`, "PATCH", { type: "reward", name: p.name, kind: p.kind, value: p.value })}>Save</button>
                <button className="btn-secondary px-3 py-1.5" onClick={() => send(`/api/agent-plans/${p.id}`, "PATCH", { type: "reward", archived: !p.archived })}>{p.archived ? "Restore" : "Archive"}</button>
              </span>
            )}
          </div>
        ))}
        {canManage && (
          <form className="card flex flex-wrap items-end gap-3 p-3 text-sm" onSubmit={async (e) => { e.preventDefault(); if (await send("/api/agent-plans", "POST", { type: "reward", ...nr })) setNr({ name: "", kind: "per_booking", value: "" }); }}>
            <label className={lab}>New plan name<input className="field mt-1" value={nr.name} onChange={(e) => setNr({ ...nr, name: e.target.value })} required /></label>
            <label className={lab}>Rule
              <select className="field mt-1" value={nr.kind} onChange={(e) => setNr({ ...nr, kind: e.target.value })}>
                {Object.entries(REWARD_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
            <label className={`${lab} w-32`}>{unit(nr.kind)}<input className="field mt-1" value={nr.value} onChange={(e) => setNr({ ...nr, value: e.target.value })} required /></label>
            <button className="btn-secondary px-3 py-2">Add reward plan</button>
          </form>
        )}
      </section>
    </div>
  );
}
