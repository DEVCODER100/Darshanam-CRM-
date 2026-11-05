"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AGENT_FIELDS, AGENT_SECTIONS } from "@/lib/agent-fields";

type Choice = { id: string; name: string };

/** Add or edit an agent. `initial` is a flat map of field values ("Yes"/"No" for the notification switches). */
export function AgentForm({
  agentId,
  initial,
  brokeragePlans,
  rewardPlans,
}: {
  agentId?: string;
  initial: Record<string, string>;
  brokeragePlans: Choice[];
  rewardPlans: Choice[];
}) {
  const router = useRouter();
  const [v, setV] = useState<Record<string, string>>(() => ({
    smsOptIn: "Yes", emailOptIn: "Yes", userGroup: "Agent Group", status: "Active", commissionPercent: "0",
    ...Object.fromEntries(AGENT_FIELDS.map((f) => [f.key, ""]).filter(([k]) => !(k in initial))),
    ...initial,
  }));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string, val: string) => setV((c) => ({ ...c, [k]: val }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { status, smsOptIn, emailOptIn, ...rest } = v;
    const res = await fetch(agentId ? `/api/agents/${agentId}` : "/api/agents", {
      method: agentId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...rest, smsOptIn: smsOptIn === "Yes", emailOptIn: emailOptIn === "Yes", active: status === "Active" }),
    });
    setBusy(false);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const fields = Object.entries(body.issues?.fieldErrors ?? {}) as [string, string[]][];
      const label = (k: string) => AGENT_FIELDS.find((f) => f.key === k)?.label ?? k;
      return setError(fields.length ? fields.map(([k, m]) => `${label(k)}: ${m[0]}`).join(" · ") : (body.error ?? `Failed (${res.status})`));
    }
    router.push(`/agents/${agentId ?? body.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="max-w-4xl space-y-5">
      {error && <p className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>}
      {AGENT_SECTIONS.map((s) => (
        <section key={s.title} className="card space-y-3 p-4">
          <h2 className="text-base font-medium">{s.title}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {s.fields.map((f) => {
              const options =
                f.type === "brokeragePlan" ? brokeragePlans.map((p) => [p.id, p.name]) :
                f.type === "rewardPlan" ? rewardPlans.map((p) => [p.id, p.name]) :
                f.type === "yesno" ? [["Yes", "Yes"], ["No", "No"]] :
                f.options?.map((o) => [o, o]);
              return (
                <label key={f.key} className="block">
                  <span className="mb-1 block text-sm font-medium">{f.label}{f.required && <span className="text-danger"> *</span>}</span>
                  {options ? (
                    <select className="field" value={v[f.key]} onChange={(e) => set(f.key, e.target.value)}>
                      {f.type !== "yesno" && f.key !== "status" && <option value="">—None—</option>}
                      {options.map(([val, name]) => <option key={val} value={val}>{name}</option>)}
                    </select>
                  ) : f.type === "area" ? (
                    <textarea className="field" rows={3} value={v[f.key]} onChange={(e) => set(f.key, e.target.value)} />
                  ) : (
                    <input className="field" value={v[f.key]} required={f.required} onChange={(e) => set(f.key, e.target.value)} />
                  )}
                  {f.hint && <span className="mt-1 block text-xs text-muted">{f.hint}</span>}
                </label>
              );
            })}
          </div>
        </section>
      ))}
      <button disabled={busy} className="btn-primary">{busy ? "Saving..." : agentId ? "Save changes" : "Add agent"}</button>
    </form>
  );
}
