/**
 * unit-import.ts — turns a messy unit list (any spreadsheet or PDF table, as a
 * grid of strings) into clean unit rows, and diffs them against the units that
 * already exist. Pure: no file or database access, so it is easy to test.
 */
import { UNIT_TYPES } from "./validators";

export type UnitType = (typeof UNIT_TYPES)[number];

export interface UnitRow {
  project: string;
  type: UnitType;
  number: string;
  area: string | null; // sq ft
  floor: string | null;
  subType: string | null; // e.g. "Type A"
}

export interface ExistingUnit {
  id: string;
  project: string;
  type: string;
  number: string;
  area: string | null;
  floor: string | null;
  subType: string | null;
}

const squash = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();
const flat = (s: unknown) => squash(s).toLowerCase().replace(/[^a-z0-9]/g, "");

/** "Bunglow", "banglows", "Vella", "APT", "shops" ... -> a unit type, or null. */
export function normalizeType(raw: string): UnitType | null {
  const k = flat(raw).replace(/[0-9]/g, "");
  if (/^(bung|bang)/.test(k)) return "Bungalow";
  if (/^v[ie]l+a/.test(k)) return "Villa";
  if (/^flat/.test(k)) return "Flat";
  if (/^(apart|apt)/.test(k)) return "Apartment";
  if (/^(shop|commercial|office|showroom)/.test(k)) return "Shop";
  if (/^(plot|land)/.test(k)) return "Plot";
  return null;
}

/** "38 · Type E" -> "Type E": a sub type already written in the unit's name. */
export function subTypeFromName(name: string): string | null {
  const m = /\btype\s*-?\s*([A-Za-z0-9]{1,3})\b/i.exec(name);
  return m ? `Type ${m[1].toUpperCase()}` : null;
}

/** One key for "the same unit", ignoring case and spacing. */
export const unitKey = (project: string, type: string, number: string) =>
  [project, type, number].map((p) => squash(p).toLowerCase()).join("|");

// --- reading the table ------------------------------------------------------

export type Field = "number" | "type" | "subType" | "project" | "area" | "floor";
export type Mapping = Partial<Record<Field, number>>; // field -> column index

const HEADER_WORDS: Record<Field, RegExp> = {
  number: /^(unit(no|number|name|id|code)?|(plot|flat|shop|house|property|villa|bungalow)(no|number|name)|number)$/,
  type: /^(unittype|propertytype|type|category|kind)$/,
  subType: /^(subtype|unitsubtype|plantype|variant|layouttype)$/,
  project: /^(project(name)?|society|scheme|phase|wing|block|tower|building|site)$/,
  area: /(area|sqft|sqmt|sqm|sqyd|sqyard|carpet|builtup|superbuiltup)/,
  floor: /^(floor(no|number)?|level)$/,
};

/** The row that looks most like a header (reports often have title rows above it). */
export function findHeaderRow(rows: string[][]): number {
  let best = 0;
  let bestScore = 0;
  rows.slice(0, 15).forEach((row, i) => {
    const score = row.filter((c) => Object.values(HEADER_WORDS).some((re) => re.test(flat(c)))).length;
    if (score > bestScore) [best, bestScore] = [i, score];
  });
  if (bestScore > 0) return best;
  const firstFilled = rows.findIndex((r) => r.filter((c) => squash(c)).length >= 2);
  return Math.max(firstFilled, 0);
}

/** Guess which column is which from the header names. */
export function guessMapping(headers: string[]): Mapping {
  const out: Mapping = {};
  const taken = new Set<number>();
  (Object.keys(HEADER_WORDS) as Field[]).forEach((field) => {
    const i = headers.findIndex((h, idx) => !taken.has(idx) && HEADER_WORDS[field].test(flat(h)));
    if (i >= 0) {
      out[field] = i;
      taken.add(i);
    }
  });
  return out;
}

export type AreaUnit = "sqft" | "sqm" | "sqyd";
const TO_SQFT: Record<AreaUnit, number> = { sqft: 1, sqm: 10.7639, sqyd: 9 };

function parseArea(raw: string, unit: AreaUnit): string | null {
  const n = parseFloat(squash(raw).replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? (n * TO_SQFT[unit]).toFixed(2) : null;
}

export interface BuildOptions {
  defaultType?: UnitType; // used when the file has no (or an unreadable) type column
  defaultProject?: string;
  areaUnit?: AreaUnit;
}

export interface RowProblem {
  line: number; // 1-based line in the file
  message: string;
}

/** Clean rows from the data lines. `firstLine` is the file line of rows[0]. */
export function buildRows(
  rows: string[][],
  mapping: Mapping,
  opts: BuildOptions = {},
  firstLine = 1,
): { rows: UnitRow[]; problems: RowProblem[] } {
  const out: UnitRow[] = [];
  const problems: RowProblem[] = [];
  const seen = new Map<string, number>();
  const cell = (r: string[], f: Field) => (mapping[f] === undefined ? "" : squash(r[mapping[f]!]));

  rows.forEach((r, i) => {
    const line = firstLine + i;
    const filled = r.filter((c) => squash(c)).length;
    if (!filled) return; // blank line
    const number = cell(r, "number").replace(/\.0+$/, "");
    // A lone cell with no unit number is a title or footer (common in PDFs), not a unit.
    if (!number) return void (filled > 1 && problems.push({ line, message: "No unit number" }));
    const rawType = cell(r, "type");
    const type = (rawType && normalizeType(rawType)) || opts.defaultType;
    if (!type)
      return void problems.push({ line, message: rawType ? `Unknown type "${rawType}"` : "No unit type" });
    const project = cell(r, "project") || opts.defaultProject || "";
    const key = unitKey(project, type, number);
    if (seen.has(key)) return void problems.push({ line, message: `Same unit as line ${seen.get(key)}` });
    seen.set(key, line);
    out.push({
      project,
      type,
      number,
      area: parseArea(cell(r, "area"), opts.areaUnit ?? "sqft"),
      floor: cell(r, "floor") || null,
      subType: cell(r, "subType") || subTypeFromName(number),
    });
  });
  return { rows: out, problems };
}

// --- comparing with what is already there -----------------------------------

export interface ImportPlan {
  create: UnitRow[];
  update: { id: string; row: UnitRow; changes: string[] }[];
  unchanged: number;
}

/** New units, units whose area/floor changed, and units that are already identical. */
export function planImport(rows: UnitRow[], existing: ExistingUnit[]): ImportPlan {
  const byKey = new Map(existing.map((u) => [unitKey(u.project, u.type, u.number), u]));
  const plan: ImportPlan = { create: [], update: [], unchanged: 0 };
  for (const row of rows) {
    const found = byKey.get(unitKey(row.project, row.type, row.number));
    if (!found) {
      plan.create.push(row);
      continue;
    }
    const changes: string[] = [];
    if (row.area !== null && Number(row.area) !== Number(found.area ?? NaN)) changes.push(`area ${row.area} sq ft`);
    if (row.floor !== null && row.floor !== found.floor) changes.push(`floor ${row.floor}`);
    if (row.subType !== null && row.subType !== found.subType) changes.push(`sub type ${row.subType}`);
    if (changes.length) plan.update.push({ id: found.id, row, changes });
    else plan.unchanged++;
  }
  return plan;
}
