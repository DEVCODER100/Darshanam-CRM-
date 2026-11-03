/**
 * map-boxes.ts — geometry and matching for unit boxes on a site map. Pure.
 * All rectangles are percent of the map (0-100), so they fit any screen.
 */
import type { MapLabel } from "@/db/schema";

export interface Rect {
  x: number; // left
  y: number; // top
  w: number;
  h: number;
}

/** Column values that take a unit off its map. */
export const UNPLACED = { mapId: null, mapX: null, mapY: null, mapW: null, mapH: null } as const;

const MIN = 0.6;
const round = (n: number) => Math.round(n * 100) / 100;

/** Keep a box inside the map and never smaller than a clickable size. */
export function clampRect(r: Rect): Rect {
  const w = Math.min(Math.max(r.w, MIN), 100);
  const h = Math.min(Math.max(r.h, MIN), 100);
  return { x: round(Math.min(Math.max(r.x, 0), 100 - w)), y: round(Math.min(Math.max(r.y, 0), 100 - h)), w: round(w), h: round(h) };
}

/** A square box (on screen) centred on a point; `aspect` is map width / height. */
export function boxAt(cx: number, cy: number, aspect: number, sizePct = 3): Rect {
  const h = sizePct * aspect;
  return clampRect({ x: cx - sizePct / 2, y: cy - h / 2, w: sizePct, h });
}

/** rows x cols cells filling `area`, row by row (left to right, top to bottom). */
export function gridRects(area: Rect, rows: number, cols: number, gap = 0.2): Rect[] {
  const w = (area.w - gap * (cols - 1)) / cols;
  const h = (area.h - gap * (rows - 1)) / rows;
  const out: Rect[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      out.push(clampRect({ x: area.x + c * (w + gap), y: area.y + r * (h + gap), w, h }));
  return out;
}

/** "B-12", "Shop 4", "101", "12A": a short label that looks like a unit number. */
export const LABEL_PATTERN = /^[A-Za-z]{0,5}[-/ .]?\d{1,4}[A-Za-z]?$/;

/** Text items from a PDF page (already in percent of the page) that look like unit labels. */
export function detectLabels(items: MapLabel[]): MapLabel[] {
  const seen = new Set<string>();
  const out: MapLabel[] = [];
  for (const it of items) {
    const label = it.label.replace(/\s+/g, " ").trim();
    if (!LABEL_PATTERN.test(label)) continue;
    const key = `${label}|${Math.round(it.x)}|${Math.round(it.y)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...it, label });
  }
  return out;
}

/** A box around a detected label, big enough to click. */
export function boxForLabel(l: MapLabel, aspect: number): Rect {
  const w = Math.max(l.w * 1.5, 1.4);
  const h = Math.max(l.h * 1.7, 1.4 * aspect);
  return clampRect({ x: l.x + l.w / 2 - w / 2, y: l.y + l.h / 2 - h / 2, w, h });
}

const flat = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** The one existing unit whose number matches this label, or null if none/ambiguous. */
export function matchUnit<U extends { id: string; number: string; type: string }>(
  label: string,
  units: U[],
  type?: string,
): U | null {
  const k = flat(label);
  const hits = units.filter((u) => flat(u.number) === k && (!type || u.type.toLowerCase() === type.toLowerCase()));
  return hits.length === 1 ? hits[0] : null;
}

/** "Unit 2" before "Unit 10": natural order for placing units in a grid. */
export const naturalCompare = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
