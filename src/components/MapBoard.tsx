"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MapLabel } from "@/db/schema";
import { boxAt, boxForLabel, clampRect, gridRects, matchUnit, naturalCompare, type Rect } from "@/lib/map-boxes";
import { BOX } from "@/lib/unit-style";
import type { UnitStatus } from "@/lib/unit-board";
import { UNIT_TYPES } from "@/lib/validators";

export interface MapBox extends Rect {
  unitId: string;
  number: string;
  name: string;
  status: UnitStatus;
  owner: string | null;
}
export interface FreeUnit {
  id: string;
  number: string;
  type: string;
}
interface Draft extends Rect {
  key: string;
  unitId: string | null; // null = a new unit to create where the box sits
  label: string;
  type: string;
}
type Tool = "move" | "place" | "grid";
type Grab = { key: string; at: Rect; px: number; py: number };
type Drag =
  | { t: "pan"; sx: number; sy: number; vx: number; vy: number }
  | ({ t: "move" } & Grab)
  | ({ t: "resize" } & Grab)
  | { t: "rect"; ox: number; oy: number }
  | null;

const num = (v: string, fallback: number) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : fallback);

/** The site map: boxes coloured by status (click to open a unit), plus an editor to place boxes. */
export function MapBoard({
  map,
  boxes,
  free,
  dimmed,
  selectedId,
  hrefBase,
  canEdit,
  startEditing,
}: {
  map: { id: string; name: string; fileUrl: string; width: number; height: number; detected: MapLabel[] };
  boxes: MapBox[];
  free: FreeUnit[]; // units not on any map yet
  dimmed: string[];
  selectedId?: string;
  hrefBase: string; // link to a unit: hrefBase with __ID__ replaced
  canEdit: boolean;
  startEditing: boolean;
}) {
  const router = useRouter();
  const wrap = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag>(null);
  const aspect = map.width / map.height;
  const [size, setSize] = useState({ cw: 800, ch: 600 });
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const iw = size.cw;
  const ih = size.cw / aspect;

  // editor state: drafts === null means plain viewing
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [history, setHistory] = useState<Draft[][]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("move");
  const [rubber, setRubber] = useState<Rect | null>(null);
  const [grid, setGrid] = useState({ rows: "2", cols: "10", mode: "existing" as "existing" | "new", type: "Bungalow", prefix: "", start: "1" });
  const [placeId, setPlaceId] = useState("");
  const [newType, setNewType] = useState("Bungalow");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const editing = drafts !== null;
  const dim = useMemo(() => new Set(dimmed), [dimmed]);
  const unplaced = useMemo(() => {
    const used = new Set(drafts?.map((d) => d.unitId));
    return free.filter((u) => !used.has(u.id)).sort((a, b) => naturalCompare(a.number, b.number));
  }, [free, drafts]);

  // --- size, fit, zoom -------------------------------------------------------
  useEffect(() => {
    const el = wrap.current!;
    const measure = () => {
      const cw = el.clientWidth;
      setSize({ cw, ch: Math.min(cw / aspect, window.innerHeight * 0.8) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [aspect]);

  const fit = useCallback(() => {
    const k = Math.min(1, size.ch / ih);
    setView({ k, x: (size.cw - iw * k) / 2, y: 0 });
  }, [size, iw, ih]);
  useEffect(fit, [fit]);

  const zoomAt = useCallback((mx: number, my: number, f: number) => {
    setView((v) => {
      const k = Math.min(12, Math.max(0.3, v.k * f));
      return { k, x: mx - (mx - v.x) * (k / v.k), y: my - (my - v.y) * (k / v.k) };
    });
  }, []);
  useEffect(() => {
    const el = wrap.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // --- editing helpers -------------------------------------------------------
  const startEdit = useCallback(() => {
    setDrafts(boxes.map((b) => ({ key: b.unitId, unitId: b.unitId, label: b.number, type: "", x: b.x, y: b.y, w: b.w, h: b.h })));
    setHistory([]);
    setSel(null);
    setNote(null);
  }, [boxes]);
  const opened = useRef(false);
  useEffect(() => {
    if (startEditing && canEdit && !opened.current) {
      opened.current = true; // open the editor once (right after an upload), not on every refresh
      startEdit();
    }
  }, [startEditing, canEdit, startEdit]);

  const change = (next: Draft[]) => {
    setHistory((h) => [...h, drafts ?? []]);
    setDrafts(next);
  };
  const patch = (key: string, p: Partial<Draft>) => setDrafts((ds) => ds && ds.map((d) => (d.key === key ? { ...d, ...p } : d)));
  const pct = (e: React.PointerEvent) => {
    const r = inner.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
  };
  const newDraft = (label: string, type: string, r: Rect, unitId: string | null = null): Draft => ({ key: crypto.randomUUID(), unitId, label, type, ...r });

  function fillGrid(area: Rect) {
    if (!drafts || area.w < 0.8 || area.h < 0.8) return;
    const cells = gridRects(area, num(grid.rows, 1), num(grid.cols, 1));
    if (grid.mode === "new") {
      const start = Number(grid.start) || 1;
      return change([...drafts, ...cells.map((c, i) => newDraft(`${grid.prefix}${start + i}`, grid.type, c))]);
    }
    const pool = unplaced.filter((u) => !grid.type || u.type === grid.type).slice(0, cells.length);
    if (!pool.length) return setNote({ ok: false, text: `No unplaced ${grid.type || ""} units left to put in the grid.` });
    change([...drafts, ...pool.map((u, i) => newDraft(u.number, u.type, cells[i], u.id))]);
  }

  function fromLabels() {
    if (!drafts) return;
    const have = new Set(drafts.map((d) => d.label.toLowerCase()));
    const added: Draft[] = [];
    for (const l of map.detected) {
      if (have.has(l.label.toLowerCase())) continue;
      const unit = matchUnit(l.label, unplaced.filter((u) => !added.some((a) => a.unitId === u.id)));
      added.push(newDraft(l.label, unit?.type ?? newType, boxForLabel(l, aspect), unit?.id ?? null));
    }
    change([...drafts, ...added]);
    const matched = added.filter((a) => a.unitId).length;
    setNote({ ok: true, text: `Added ${added.length} boxes from the PDF text: ${matched} matched existing units, ${added.length - matched} are new units (as ${newType}). Check them, then Save.` });
  }

  async function save() {
    if (!drafts) return;
    setBusy(true);
    const res = await fetch(`/api/maps/${map.id}/boxes`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        boxes: drafts.map(({ unitId, label, type, x, y, w, h }) => ({
          ...(unitId ? { unitId } : { create: { type, number: label.trim() } }),
          x, y, w, h,
        })),
      }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setNote({ ok: false, text: body.error ?? `Failed (${res.status})` });
    setDrafts(null);
    setNote({ ok: true, text: `Saved ${body.placed} boxes${body.created ? `, ${body.created} new units created` : ""}.` });
    router.refresh();
  }

  async function removeMap() {
    if (!confirm(`Delete the map "${map.name}"? Your units stay; they are just taken off the map.`)) return;
    await fetch(`/api/maps/${map.id}`, { method: "DELETE" });
    router.push("/dashboard?view=grid");
    router.refresh();
  }

  // --- pointer handling ------------------------------------------------------
  function down(e: React.PointerEvent) {
    wrap.current!.setPointerCapture(e.pointerId);
    if (editing && tool === "place" && placeId) {
      const u = unplaced.find((x) => x.id === placeId);
      const p = pct(e);
      if (u) {
        change([...drafts!, newDraft(u.number, u.type, boxAt(p.x, p.y, aspect), u.id)]);
        setPlaceId(unplaced.find((x) => x.id !== placeId)?.id ?? "");
      }
      return;
    }
    if (editing && tool === "grid") {
      const p = pct(e);
      drag.current = { t: "rect", ox: p.x, oy: p.y };
      return setRubber({ x: p.x, y: p.y, w: 0, h: 0 });
    }
    setSel(null);
    drag.current = { t: "pan", sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
  }
  function downBox(e: React.PointerEvent, d: Draft, t: "move" | "resize") {
    e.stopPropagation();
    wrap.current!.setPointerCapture(e.pointerId);
    setSel(d.key);
    setHistory((h) => [...h, drafts!]);
    const p = pct(e);
    drag.current = { t, key: d.key, at: { x: d.x, y: d.y, w: d.w, h: d.h }, px: p.x, py: p.y } as Drag;
  }
  function move(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    if (d.t === "pan") return setView((v) => ({ ...v, x: d.vx + e.clientX - d.sx, y: d.vy + e.clientY - d.sy }));
    const p = pct(e);
    if (d.t === "move") patch(d.key, clampRect({ ...d.at, x: d.at.x + p.x - d.px, y: d.at.y + p.y - d.py }));
    else if (d.t === "resize") patch(d.key, clampRect({ ...d.at, w: d.at.w + p.x - d.px, h: d.at.h + p.y - d.py }));
    else setRubber({ x: Math.min(d.ox, p.x), y: Math.min(d.oy, p.y), w: Math.abs(p.x - d.ox), h: Math.abs(p.y - d.oy) });
  }
  function up() {
    if (drag.current?.t === "rect" && rubber) fillGrid(clampRect(rubber));
    drag.current = null;
    setRubber(null);
  }

  const fontFor = (label: string, r: Rect) =>
    Math.max(5, Math.min((iw * r.w) / 100 / Math.max(label.length * 0.62, 2), ((ih * r.h) / 100) * 0.6, 18));
  const boxStyle = (r: Rect, label: string): React.CSSProperties => ({
    left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%`, fontSize: fontFor(label, r),
  });
  const selected = drafts?.find((d) => d.key === sel);
  const newCount = drafts?.filter((d) => !d.unitId).length ?? 0;
  const lab = "text-xs text-muted";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => zoomAt(size.cw / 2, size.ch / 2, 1.4)} className="btn-secondary px-3 py-1" aria-label="Zoom in">＋</button>
        <button onClick={() => zoomAt(size.cw / 2, size.ch / 2, 1 / 1.4)} className="btn-secondary px-3 py-1" aria-label="Zoom out">－</button>
        <button onClick={fit} className="btn-secondary px-3 py-1">Fit</button>
        <span className="text-xs text-muted">Scroll to zoom, drag to move around.</span>
        {canEdit && !editing && (
          <span className="ml-auto flex gap-2">
            <button onClick={startEdit} className="btn-primary px-3 py-1">Edit boxes</button>
            <button onClick={removeMap} className="btn-secondary px-3 py-1 text-danger">Delete map</button>
          </span>
        )}
      </div>

      {editing && (
        <div className="card space-y-3 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            {(["move", "place", "grid"] as Tool[]).map((t) => (
              <button key={t} onClick={() => setTool(t)} className={tool === t ? "btn-primary px-3 py-1" : "btn-secondary px-3 py-1"}>
                {{ move: "Move / resize", place: "Place units", grid: "Auto-grid" }[t]}
              </button>
            ))}
            <button disabled={!history.length} onClick={() => { setDrafts(history[history.length - 1]); setHistory((h) => h.slice(0, -1)); }} className="btn-secondary px-3 py-1">Undo</button>
            <span className="ml-auto text-xs text-muted">{drafts.length} boxes{newCount ? ` · ${newCount} new units` : ""}</span>
          </div>

          {tool === "place" && (
            <label className={lab}>
              Click the map to drop a box for:
              <select className="field mt-1 w-64" value={placeId} onChange={(e) => setPlaceId(e.target.value)}>
                <option value="">—Choose a unit—</option>
                {unplaced.map((u) => <option key={u.id} value={u.id}>{u.type} {u.number}</option>)}
              </select>
              {!unplaced.length && <span className="ml-2">Every unit is already on a map.</span>}
            </label>
          )}

          {tool === "grid" && (
            <div className="flex flex-wrap items-end gap-3">
              <label className={`w-20 ${lab}`}>Rows<input className="field mt-1" value={grid.rows} onChange={(e) => setGrid({ ...grid, rows: e.target.value })} /></label>
              <label className={`w-20 ${lab}`}>Columns<input className="field mt-1" value={grid.cols} onChange={(e) => setGrid({ ...grid, cols: e.target.value })} /></label>
              <label className={lab}>Fill with
                <select className="field mt-1" value={grid.mode} onChange={(e) => setGrid({ ...grid, mode: e.target.value as "existing" | "new" })}>
                  <option value="existing">Existing units, in order</option>
                  <option value="new">New units (numbered)</option>
                </select>
              </label>
              <label className={lab}>Type
                <select className="field mt-1" value={grid.type} onChange={(e) => setGrid({ ...grid, type: e.target.value })}>
                  {grid.mode === "existing" && <option value="">Any</option>}
                  {UNIT_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
              {grid.mode === "new" && (
                <>
                  <label className={`w-24 ${lab}`}>Prefix<input className="field mt-1" value={grid.prefix} placeholder="B-" onChange={(e) => setGrid({ ...grid, prefix: e.target.value })} /></label>
                  <label className={`w-20 ${lab}`}>Start at<input className="field mt-1" value={grid.start} onChange={(e) => setGrid({ ...grid, start: e.target.value })} /></label>
                </>
              )}
              <p className="basis-full text-xs text-muted">Now drag a rectangle on the map; the grid fills it, row by row.</p>
            </div>
          )}

          {map.detected.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-3">
              <span>The PDF has {map.detected.length} unit-like labels.</span>
              <label className={lab}>
                New units are{" "}
                <select className="field ml-1 w-32 py-1" value={newType} onChange={(e) => setNewType(e.target.value)}>
                  {UNIT_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
              <button onClick={fromLabels} className="btn-secondary px-3 py-1">Add boxes from the labels</button>
            </div>
          )}

          {selected && (
            <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-3">
              <span className="font-medium">Selected:</span>
              {selected.unitId ? (
                <span>{selected.label}</span>
              ) : (
                <>
                  <input className="field w-32 py-1" value={selected.label} onChange={(e) => patch(selected.key, { label: e.target.value })} />
                  <select className="field w-32 py-1" value={selected.type} onChange={(e) => patch(selected.key, { type: e.target.value })}>
                    {UNIT_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <span className="text-xs text-muted">new unit</span>
                </>
              )}
              <button onClick={() => { change(drafts.filter((d) => d.key !== selected.key)); setSel(null); }} className="btn-secondary px-3 py-1 text-danger">Remove from map</button>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={save} disabled={busy || drafts.some((d) => !d.unitId && !d.label.trim())} className="btn-primary px-4 py-1.5">{busy ? "Saving..." : "Save boxes"}</button>
            <button onClick={() => { setDrafts(null); setRubber(null); }} className="btn-secondary px-4 py-1.5">Cancel</button>
          </div>
        </div>
      )}
      {note && <p className={`text-sm ${note.ok ? "text-paid" : "text-danger"}`}>{note.text}</p>}

      <div
        ref={wrap}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        className={`relative touch-none select-none overflow-hidden rounded-md border border-hairline bg-canvas ${tool !== "move" && editing ? "cursor-crosshair" : "cursor-grab"}`}
        style={{ height: size.ch }}
      >
        <div
          ref={inner}
          className="absolute left-0 top-0"
          style={{ width: iw, height: ih, transform: `translate(${view.x}px,${view.y}px) scale(${view.k})`, transformOrigin: "0 0" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={map.fileUrl} alt={map.name} draggable={false} className="h-full w-full" />

          {!editing &&
            boxes.map((b) => (
              <Link
                key={b.unitId}
                href={hrefBase.replace("__ID__", b.unitId)}
                scroll={false}
                title={`${b.name}${b.owner ? ` · ${b.owner}` : ""} · ${b.status}`}
                onPointerDown={(e) => e.stopPropagation()}
                className={`absolute flex items-center justify-center overflow-hidden rounded-[2px] border text-center font-medium leading-none ${BOX[b.status]} ${dim.has(b.unitId) ? "opacity-20" : ""} ${selectedId === b.unitId ? "z-10 ring-2 ring-ink" : ""}`}
                style={boxStyle(b, b.number)}
              >
                {b.number}
              </Link>
            ))}

          {drafts?.map((d) => (
            <div
              key={d.key}
              onPointerDown={(e) => tool === "move" && downBox(e, d, "move")}
              className={`absolute flex items-center justify-center rounded-[2px] border text-center font-medium leading-none ${
                d.unitId ? "border-brass bg-[#efe3cf] text-ink" : "border-amber-500 bg-amber-100 text-amber-900"
              } ${sel === d.key ? "z-10 ring-2 ring-ink" : ""}`}
              style={{ ...boxStyle(d, d.label), cursor: tool === "move" ? "move" : undefined }}
            >
              <span className="pointer-events-none overflow-hidden">{d.label}</span>
              {sel === d.key && tool === "move" && (
                <span
                  onPointerDown={(e) => downBox(e, d, "resize")}
                  className="absolute -bottom-1 -right-1 h-2.5 w-2.5 cursor-nwse-resize rounded-sm bg-ink"
                  style={{ transform: `scale(${1 / view.k})`, transformOrigin: "bottom right" }}
                />
              )}
            </div>
          ))}

          {rubber && (
            <div className="pointer-events-none absolute border-2 border-dashed border-ink bg-ink/5" style={{ left: `${rubber.x}%`, top: `${rubber.y}%`, width: `${rubber.w}%`, height: `${rubber.h}%` }} />
          )}
        </div>
      </div>
    </div>
  );
}
