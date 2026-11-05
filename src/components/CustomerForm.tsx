"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ALL_FIELDS,
  PROFILE_SECTIONS,
  RELATIONS,
  SAME_AS_PRIMARY,
  type ProfileField,
} from "@/lib/customer-profile";

export interface JointInput {
  name: string;
  mobile: string;
  relation: string;
  panNumber: string;
  panEncrypted: string; // unchanged PAN, passed back as-is
}

const blankJoint = (): JointInput => ({ name: "", mobile: "", relation: "Spouse", panNumber: "", panEncrypted: "" });

/** Register Client form, built from PROFILE_SECTIONS. `initial` is a flat map of field values. */
export function CustomerForm({
  mode,
  customerId,
  initial = {},
  initialJoint = [],
  returnTo,
}: {
  mode: "create" | "edit";
  customerId?: string;
  initial?: Record<string, string>;
  initialJoint?: JointInput[];
  returnTo?: string; // after creating, go here with ?customerId=... (used by the booking flow)
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries([
      ...ALL_FIELDS.map((f) => [f.key, initial[f.key] ?? f.def ?? ""]),
      ["notes", initial.notes ?? ""],
    ]),
  );
  const [reason, setReason] = useState(initial.noPanReason ?? "");
  const [noPan, setNoPan] = useState(!!initial.noPanReason);
  const [joint, setJoint] = useState<JointInput[]>(initialJoint);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: string, v: string) => setValues((c) => ({ ...c, [key]: v }));

  const copyPrimary = (on: boolean) =>
    on && setValues((c) => ({ ...c, ...Object.fromEntries(SAME_AS_PRIMARY.map(([from, to]) => [to, c[from]])) }));
  const patchJoint = (i: number, p: Partial<JointInput>) =>
    setJoint((js) => js.map((j, idx) => (idx === i ? { ...j, ...p } : j)));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const core: Record<string, string> = {};
    const profile: Record<string, string> = {};
    for (const f of ALL_FIELDS) (f.core ? core : profile)[f.key] = values[f.key];
    const response = await fetch(mode === "create" ? "/api/customers" : `/api/customers/${customerId}`, {
      method: mode === "create" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...core,
        panNumber: noPan ? "" : values.panNumber,
        noPanReason: noPan ? reason : "",
        notes: values.notes,
        profile,
        jointApplicants: joint.filter((j) => j.name.trim()),
      }),
    });
    setBusy(false);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      // Say which field is wrong, not just "Validation failed".
      const issues = Object.entries(body.issues?.fieldErrors ?? {}) as [string, string[]][];
      const label = (k: string) => ALL_FIELDS.find((f) => f.key === k)?.label ?? k;
      return setError(
        issues.length
          ? issues.map(([k, m]) => `${label(k)}: ${m[0]}`).join(" · ")
          : (body.error ?? `Request failed (${response.status})`),
      );
    }
    router.push(
      mode === "edit"
        ? `/customers/${customerId}`
        : returnTo
          ? `${returnTo}${returnTo.includes("?") ? "&" : "?"}customerId=${body.id}`
          : `/customers/${body.id}`,
    );
    router.refresh();
  }

  function renderField(f: ProfileField) {
    const v = values[f.key] ?? "";
    const common = { className: "field", value: v, onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(f.key, e.target.value) };
    let input: React.ReactNode;
    if (f.type === "select")
      input = (
        <select className="field" value={v} onChange={(e) => set(f.key, e.target.value)}>
          <option value="">—Select—</option>
          {f.options?.map((o) => <option key={o}>{o}</option>)}
        </select>
      );
    else if (f.type === "area")
      input = <textarea className="field" rows={3} value={v} onChange={(e) => set(f.key, e.target.value)} required={f.required} />;
    else if (f.type === "date") input = <input {...common} type="date" />;
    else if (f.type === "pan")
      input = (
        <>
          <input
            {...common}
            className="field font-mono uppercase"
            placeholder="ABCDE1234F"
            maxLength={10}
            pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]"
            title="10 characters: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)"
            disabled={noPan}
            required={!noPan}
          />
          <p className="mt-1 text-xs text-muted">Stored encrypted. Only admin and accountant can see the full number.</p>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={noPan} onChange={(e) => setNoPan(e.target.checked)} />
            This customer has no PAN
          </label>
          {noPan && (
            <input className="field mt-2" placeholder="Reason, e.g. foreign national" value={reason} onChange={(e) => setReason(e.target.value)} required />
          )}
        </>
      );
    else
      input = <input {...common} required={f.required} placeholder={f.hint} />;
    return (
      <label key={f.key} className="block">
        <span className="mb-1 block text-sm font-medium text-ink">
          {f.label}
          {f.required && <span className="text-danger"> *</span>}
        </span>
        {input}
        {f.type === "id" && mode === "edit" && <p className="mt-1 text-xs text-muted">Leave blank to keep the stored number.</p>}
      </label>
    );
  }

  const filled = (fields: ProfileField[]) => fields.some((f) => values[f.key] && values[f.key] !== f.def);

  return (
    <form onSubmit={submit} className="max-w-4xl space-y-5">
      {error && <p className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>}

      {PROFILE_SECTIONS.map((section) => {
        const grid = <div className="grid gap-4 md:grid-cols-2">{section.fields.map(renderField)}</div>;
        const heading = <span className="text-base font-medium">{section.title}{section.optional && <span className="text-xs text-muted"> [optional]</span>}</span>;
        return section.optional ? (
          <details key={section.title} className="card p-4" open={mode === "edit" && filled(section.fields)}>
            <summary className="cursor-pointer">{heading}</summary>
            {section.title === "Secondary address" && (
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input type="checkbox" onChange={(e) => copyPrimary(e.target.checked)} />
                Same as primary address
              </label>
            )}
            <div className="mt-3">{grid}</div>
          </details>
        ) : (
          <section key={section.title} className="card space-y-3 p-4">
            <h2 className="text-base font-medium">{section.title}</h2>
            {grid}
          </section>
        );
      })}

      <details className="card p-4" open={joint.length > 0}>
        <summary className="cursor-pointer text-base font-medium">
          Joint applicants <span className="text-xs text-muted">[optional]</span>
        </summary>
        <div className="mt-3 space-y-3">
          {joint.map((j, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2 rounded-md border border-hairline p-3">
              <input className="field w-48" placeholder="Name" value={j.name} onChange={(e) => patchJoint(i, { name: e.target.value })} />
              <select className="field w-32" value={j.relation} onChange={(e) => patchJoint(i, { relation: e.target.value })}>
                {RELATIONS.map((r) => <option key={r}>{r}</option>)}
              </select>
              <input className="field w-40" placeholder="Mobile" value={j.mobile} onChange={(e) => patchJoint(i, { mobile: e.target.value })} />
              <input
                className="field w-40 font-mono uppercase"
                placeholder={j.panEncrypted ? "PAN on file" : "PAN (optional)"}
                maxLength={10}
                value={j.panNumber}
                onChange={(e) => patchJoint(i, { panNumber: e.target.value })}
              />
              <button type="button" onClick={() => setJoint((js) => js.filter((_, idx) => idx !== i))} className="rounded-md border border-hairline px-2 py-2 text-xs text-danger hover:bg-danger-bg">
                Remove
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setJoint((js) => [...js, blankJoint()])} className="btn-secondary">
            + Add joint applicant
          </button>
        </div>
      </details>

      <section className="card p-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Notes</span>
          <textarea className="field" rows={3} value={values.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
        </label>
      </section>

      <button type="submit" disabled={busy} className="btn-primary">
        {busy ? "Saving..." : mode === "create" ? "Create customer" : "Save changes"}
      </button>
    </form>
  );
}
