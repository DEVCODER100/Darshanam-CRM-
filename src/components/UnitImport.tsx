"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildRows,
  findHeaderRow,
  guessMapping,
  type AreaUnit,
  type Field,
  type ImportPlan,
  type Mapping,
  type UnitType,
} from "@/lib/unit-import";
import { readPdfTable } from "@/lib/pdfjs-loader";
import { UNIT_TYPES } from "@/lib/validators";

const FIELDS: [Field, string][] = [
  ["number", "Unit number / name *"],
  ["type", "Type"],
  ["subType", "Sub type (Type A...)"],
  ["area", "Area"],
  ["floor", "Floor"],
];

/** Upload a unit list (xlsx / csv), check the columns, preview, then import. */
export function UnitImport() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [grid, setGrid] = useState<string[][] | null>(null);
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<Mapping>({});
  const [defaultType, setDefaultType] = useState<UnitType | "">("");
  const [areaUnit, setAreaUnit] = useState<AreaUnit>("sqft");
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const headerAt = grid ? findHeaderRow(grid) : 0;
  const headers = grid?.[headerAt] ?? [];
  const built = useMemo(
    () =>
      grid
        ? buildRows(grid.slice(headerAt + 1), mapping, { defaultType: defaultType || undefined, areaUnit }, headerAt + 2)
        : null,
    [grid, headerAt, mapping, defaultType, areaUnit],
  );

  const post = (dryRun: boolean) =>
    fetch("/api/units/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: built?.rows, dryRun }),
    });

  // Re-check against the database whenever the columns or defaults change.
  useEffect(() => {
    setPlan(null);
    if (!built?.rows.length) return;
    const t = setTimeout(async () => {
      const res = await post(true);
      const body = await res.json().catch(() => ({}));
      if (res.ok) setPlan(body.plan);
      else setMessage({ ok: false, text: body.error ?? `Failed (${res.status})` });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [built]);

  async function onFile(file: File) {
    setMessage(null);
    setFileName(file.name);
    setBusy(true);
    let rows: string[][];
    if (/\.pdf$/i.test(file.name)) {
      // PDFs are read in the browser; the grid then follows the same steps as a spreadsheet.
      rows = await readPdfTable(file).catch(() => []);
      setBusy(false);
      if (!rows.length) return setMessage({ ok: false, text: "No readable text in this PDF. A scanned PDF can't be read; use the spreadsheet instead." });
    } else {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/units/parse", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      setBusy(false);
      if (!res.ok) return setMessage({ ok: false, text: body.error ?? `Failed (${res.status})` });
      rows = body.rows;
    }
    setGrid(rows);
    setMapping(guessMapping(rows[findHeaderRow(rows)] ?? []));
  }

  async function apply() {
    setBusy(true);
    const res = await post(false);
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMessage({ ok: false, text: body.error ?? `Failed (${res.status})` });
    setMessage({ ok: true, text: `Done: ${body.create} added, ${body.update} updated, ${body.unchanged} already up to date.` });
    setGrid(null);
    setPlan(null);
    router.refresh();
  }

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="btn-secondary px-3 py-1.5">
        Import units
      </button>
    );

  const noType = mapping.type === undefined;
  const canImport = !!plan && plan.create.length + plan.update.length > 0 && !busy;

  return (
    <div className="card basis-full space-y-4 p-4 text-sm">
      <div className="flex items-center justify-between">
        <p className="font-medium">Import units from a file</p>
        <button onClick={() => setOpen(false)} className="text-muted hover:text-ink">✕</button>
      </div>
      <p className="text-muted">
        Upload your unit list as .xlsx, .csv or a text PDF (save older .xls files as .xlsx). Check the columns, review the preview, then confirm.
        Units go into the project selected at the top. Existing units are never duplicated or deleted.
      </p>
      <input
        type="file"
        accept=".xlsx,.csv,.pdf"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        className="block text-sm"
      />

      {grid && built && (
        <>
          <p className="text-xs text-muted">
            {fileName}: {grid.length - headerAt - 1} lines below the header on line {headerAt + 1}.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {FIELDS.map(([field, label]) => (
              <label key={field} className="block text-xs text-muted">
                {label}
                <select
                  className="field mt-1"
                  value={mapping[field] ?? ""}
                  onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value === "" ? undefined : Number(e.target.value) }))}
                >
                  <option value="">— none —</option>
                  {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                </select>
              </label>
            ))}
            <label className="block text-xs text-muted">
              Area is in
              <select className="field mt-1" value={areaUnit} onChange={(e) => setAreaUnit(e.target.value as AreaUnit)}>
                <option value="sqft">Sq ft</option>
                <option value="sqm">Sq m</option>
                <option value="sqyd">Sq yd</option>
              </select>
            </label>
            <label className="block text-xs text-muted">
              {noType ? "Type for all units *" : "Type when blank / unreadable"}
              <select className="field mt-1" value={defaultType} onChange={(e) => setDefaultType(e.target.value as UnitType | "")}>
                <option value="">—</option>
                {UNIT_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
          </div>

          <div className="rounded-md bg-canvas p-3">
            <p className="font-medium">
              {built.rows.length} readable units
              {plan && (
                <span className="font-normal text-muted">
                  {" "}· <span className="text-paid">{plan.create.length} new</span> · {plan.update.length} to update · {plan.unchanged} unchanged
                </span>
              )}
              {built.problems.length > 0 && <span className="text-danger"> · {built.problems.length} problems</span>}
            </p>
            {plan && plan.create.length > 0 && (
              <p className="mt-1 text-xs text-muted">
                New: {plan.create.slice(0, 8).map((r) => r.number).join(", ")}{plan.create.length > 8 ? ` … +${plan.create.length - 8} more` : ""}
              </p>
            )}
            {plan && plan.update.length > 0 && (
              <p className="mt-1 text-xs text-muted">
                Updates: {plan.update.slice(0, 5).map((u) => `${u.row.number} (${u.changes.join(", ")})`).join("; ")}
                {plan.update.length > 5 ? ` … +${plan.update.length - 5} more` : ""}
              </p>
            )}
            {built.problems.length > 0 && (
              <ul className="mt-2 max-h-32 overflow-y-auto text-xs text-danger">
                {built.problems.slice(0, 30).map((p, i) => <li key={i}>Line {p.line}: {p.message}</li>)}
                {built.problems.length > 30 && <li>… and {built.problems.length - 30} more</li>}
              </ul>
            )}
          </div>

          <button disabled={!canImport} onClick={apply} className="btn-primary">
            {busy ? "Working..." : plan ? `Import ${plan.create.length} new, update ${plan.update.length}` : "Import"}
          </button>
        </>
      )}
      {message && <p className={message.ok ? "text-paid" : "text-danger"}>{message.text}</p>}
    </div>
  );
}
