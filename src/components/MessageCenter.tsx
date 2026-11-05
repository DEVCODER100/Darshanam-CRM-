"use client";

import { useMemo, useState } from "react";
import { TEMPLATES, callLink, mailLink, renderMessage, smsLink, whatsappLink } from "@/lib/contact-message";

export interface ContactRow {
  id: string;
  name: string;
  clientCode: string | null;
  mobile: string;
  email: string | null;
  units: string[];
  dueText: string; // formatted, "" when nothing is due
  hasDue: boolean;
  smsOptIn: boolean;
  emailOptIn: boolean;
}

/**
 * Customer contact list with one-click call / WhatsApp / SMS / email, and bulk messaging.
 * No messages are sent by the site itself: it opens the user's own WhatsApp, SMS or email
 * app with the message filled in, one customer at a time.
 */
export function MessageCenter({
  rows,
  project,
  templates = TEMPLATES,
  unitsHeader = "Unit(s)",
  dueHeader = "Due now",
  linkBase = "/customers",
}: {
  rows: ContactRow[];
  project: string;
  templates?: typeof TEMPLATES;
  unitsHeader?: string;
  dueHeader?: string;
  linkBase?: string; // where a name links to: linkBase/<id>
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [tpl, setTpl] = useState(templates[0].key);
  const [text, setText] = useState(templates[0].text);
  const [queue, setQueue] = useState<number | null>(null); // index into the picked list while sending one by one
  const [note, setNote] = useState("");

  const chosen = useMemo(() => rows.filter((r) => picked.has(r.id)), [rows, picked]);
  const msg = (r: ContactRow) => renderMessage(text, { name: r.name.split(" ")[0], unit: r.units.join(", ") || "your unit", due: r.dueText || "as per our records", project });
  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const copy = async (what: string, values: string[]) => {
    await navigator.clipboard.writeText(values.join(what === "emails" ? ", " : "\n"));
    setNote(`Copied ${values.length} ${what}.`);
  };
  const csv = () => {
    const lines = [["Name", "Client ID", "Mobile", "Email", "Units", "Due"], ...chosen.map((r) => [r.name, r.clientCode ?? "", r.mobile, r.email ?? "", r.units.join("; "), r.dueText])];
    const blob = new Blob(["﻿" + lines.map((l) => l.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\r\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "customer-contacts.csv";
    a.click();
  };

  const btn = "rounded-md border border-hairline px-2 py-1 text-xs hover:bg-canvas";
  const off = "pointer-events-none opacity-40";
  const current = queue !== null ? chosen[queue] : null;

  return (
    <div className="space-y-4">
      <div className="card space-y-3 p-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">Message</span>
          {templates.map((t) => (
            <button key={t.key} type="button" onClick={() => { setTpl(t.key); setText(t.text); }} className={tpl === t.key ? "btn-primary px-3 py-1" : "btn-secondary px-3 py-1"}>
              {t.label}
            </button>
          ))}
        </div>
        <textarea className="field" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
        <p className="text-xs text-muted">
          Fields filled in for each person: {"{name}"} (first name), {"{unit}"}, {"{due}"} (amount overdue now), {"{project}"}.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted">{chosen.length} selected</span>
          <button className="btn-primary px-3 py-1.5" disabled={!chosen.length} onClick={() => setQueue(0)}>Send one by one</button>
          <button className="btn-secondary px-3 py-1.5" disabled={!chosen.length} onClick={() => copy("numbers", chosen.map((r) => r.mobile))}>Copy numbers</button>
          <button className="btn-secondary px-3 py-1.5" disabled={!chosen.length} onClick={() => copy("emails", chosen.flatMap((r) => (r.email ? [r.email] : [])))}>Copy emails</button>
          <button className="btn-secondary px-3 py-1.5" disabled={!chosen.length} onClick={csv}>Download list</button>
          {note && <span className="text-paid">{note}</span>}
        </div>

        {current && (
          <div className="space-y-2 rounded-md border border-brass bg-canvas p-3">
            <p className="font-medium">
              {queue! + 1} of {chosen.length}: {current.name} · {current.mobile}
            </p>
            <p className="whitespace-pre-wrap rounded bg-surface p-2">{msg(current)}</p>
            <div className="flex flex-wrap items-center gap-2">
              <a href={whatsappLink(current.mobile, msg(current))} target="_blank" rel="noreferrer" className={`btn-primary px-3 py-1.5 ${current.smsOptIn ? "" : off}`}>WhatsApp</a>
              <a href={smsLink(current.mobile, msg(current))} className={`btn-secondary px-3 py-1.5 ${current.smsOptIn ? "" : off}`}>SMS</a>
              <a href={current.email ? mailLink(current.email, `Message from ${project}`, msg(current)) : undefined} className={`btn-secondary px-3 py-1.5 ${current.email && current.emailOptIn ? "" : off}`}>Email</a>
              <span className="ml-auto flex gap-2">
                <button className="btn-secondary px-3 py-1.5" disabled={queue === 0} onClick={() => setQueue(queue! - 1)}>← Previous</button>
                <button className="btn-secondary px-3 py-1.5" onClick={() => (queue! + 1 < chosen.length ? setQueue(queue! + 1) : setQueue(null))}>
                  {queue! + 1 < chosen.length ? "Next →" : "Done"}
                </button>
              </span>
            </div>
            {!current.smsOptIn && <p className="text-xs text-due">This customer has switched off SMS / WhatsApp messages.</p>}
          </div>
        )}
      </div>

      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>
                <input type="checkbox" aria-label="Select all" checked={rows.length > 0 && picked.size === rows.length} onChange={(e) => setPicked(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} />
              </th>
              <th>Customer</th><th>Mobile</th><th>Email</th><th>{unitsHeader}</th><th className="text-right">{dueHeader}</th><th>Contact</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="text-muted">No customers match.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td><input type="checkbox" checked={picked.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.name}`} /></td>
                <td>
                  <a href={`${linkBase}/${r.id}`} className="font-medium text-brass-dark hover:underline">{r.name}</a>
                  {r.clientCode && <span className="ml-2 text-xs text-muted">{r.clientCode}</span>}
                </td>
                <td className="whitespace-nowrap">{r.mobile}</td>
                <td className="text-muted">{r.email ?? "—"}</td>
                <td className="text-muted">{r.units.join(", ") || "—"}</td>
                <td className={`money text-right ${r.hasDue ? "text-due" : "text-muted"}`}>{r.dueText || "—"}</td>
                <td className="whitespace-nowrap">
                  <span className="flex gap-1">
                    <a href={callLink(r.mobile)} className={btn}>Call</a>
                    <a href={whatsappLink(r.mobile, msg(r))} target="_blank" rel="noreferrer" className={`${btn} ${r.smsOptIn ? "" : off}`}>WhatsApp</a>
                    <a href={smsLink(r.mobile, msg(r))} className={`${btn} ${r.smsOptIn ? "" : off}`}>SMS</a>
                    <a href={r.email ? mailLink(r.email, `Message from ${project}`, msg(r)) : undefined} className={`${btn} ${r.email && r.emailOptIn ? "" : off}`}>Email</a>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
