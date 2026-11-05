"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseAgentRows, type ImportProblem, type ParsedAgent } from "@/lib/agent-import";

/** Import agents from the agent file (.xls, .xlsx or .csv): check, preview, then confirm. */
export function AgentImport({
  brokeragePlans,
  rewardPlans,
  codes,
}: {
  brokeragePlans: [string, string][]; // [name, id]
  rewardPlans: [string, string][];
  codes: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState("");
  const [result, setResult] = useState<{ agents: ParsedAgent[]; problems: ImportProblem[] } | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function onFile(f: File) {
    setMessage(null);
    setResult(null);
    setFile(f.name);
    setBusy(true);
    const form = new FormData();
    form.append("file", f);
    const res = await fetch("/api/units/parse", { method: "POST", body: form });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMessage({ ok: false, text: body.error ?? `Failed (${res.status})` });
    setResult(
      parseAgentRows(body.rows, {
        brokeragePlans: new Map(brokeragePlans.map(([n, id]) => [n.toLowerCase(), id])),
        rewardPlans: new Map(rewardPlans.map(([n, id]) => [n.toLowerCase(), id])),
        existingCodes: new Set(codes.map((c) => c.toLowerCase())),
      }),
    );
  }

  async function apply() {
    if (!result) return;
    setBusy(true);
    const res = await fetch("/api/agents/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: result.agents.map(({ code, fields, brokeragePlanId, rewardPlanId }) => ({ code, fields, brokeragePlanId, rewardPlanId })) }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      const issue = Object.values(body.issues?.fieldErrors ?? {}).flat()[0] as string | undefined;
      return setMessage({ ok: false, text: issue ?? body.error ?? `Failed (${res.status})` });
    }
    setMessage({ ok: true, text: `Done: ${body.created} added, ${body.updated} updated.` });
    setResult(null);
    router.refresh();
  }

  if (!open) return <button onClick={() => setOpen(true)} className="btn-secondary px-3 py-1.5">Import agents</button>;

  const adds = result?.agents.filter((a) => !a.code).length ?? 0;
  const updates = (result?.agents.length ?? 0) - adds;

  return (
    <div className="card basis-full space-y-3 p-4 text-sm">
      <div className="flex items-center justify-between">
        <p className="font-medium">Import agents from a file</p>
        <button onClick={() => setOpen(false)} className="text-muted hover:text-ink">✕</button>
      </div>
      <p className="text-muted">
        Use the agent file layout (.xls, .xlsx or .csv). Rows with an Agent ID update that agent; rows without one add a new agent.
        Full Name is required, and a mobile number or email for new agents. Plan names must already exist under Plans.
      </p>
      <input type="file" accept=".xls,.xlsx,.csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      {result && (
        <div className="rounded-md bg-canvas p-3">
          <p className="font-medium">
            {file}: <span className="text-paid">{adds} to add</span> · {updates} to update
            {result.problems.length > 0 && <span className="text-danger"> · {result.problems.length} problems</span>}
          </p>
          {result.agents.length > 0 && (
            <p className="mt-1 text-xs text-muted">
              {result.agents.slice(0, 8).map((a) => `${a.fields.name}${a.code ? ` (${a.code})` : ""}`).join(", ")}
              {result.agents.length > 8 ? ` … +${result.agents.length - 8} more` : ""}
            </p>
          )}
          {result.problems.length > 0 && (
            <ul className="mt-2 max-h-32 overflow-y-auto text-xs text-danger">
              {result.problems.slice(0, 30).map((p, i) => <li key={i}>Line {p.line}: {p.message}</li>)}
            </ul>
          )}
          <button disabled={busy || result.agents.length === 0} onClick={apply} className="btn-primary mt-3">
            {busy ? "Working..." : `Import ${adds} new, update ${updates}`}
          </button>
        </div>
      )}
      {message && <p className={message.ok ? "text-paid" : "text-danger"}>{message.text}</p>}
    </div>
  );
}
