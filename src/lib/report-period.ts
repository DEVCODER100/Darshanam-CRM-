/** Quick date ranges and table shaping (order + paging) for the Reports section. Pure. */
import { monthRange, shiftMonth } from "./statement";
import type { Cell, ExportTable } from "./export-types";

export interface Preset {
  key: string;
  label: string;
  from: string;
  to: string;
}

/** Indian financial year (April to March) containing `today`. */
function financialYear(today: string): { from: string; to: string } {
  const y = Number(today.slice(0, 4));
  const start = Number(today.slice(5, 7)) >= 4 ? y : y - 1;
  return { from: `${start}-04-01`, to: `${start + 1}-03-31` };
}

export function periodPresets(today: string): Preset[] {
  const month = today.slice(0, 7);
  const m = Number(today.slice(5, 7));
  const qStart = `${today.slice(0, 4)}-${String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, "0")}`;
  const fy = financialYear(today);
  return [
    { key: "month", label: "This month", ...monthRange(month) },
    { key: "last", label: "Last month", ...monthRange(shiftMonth(month, -1)) },
    { key: "quarter", label: "This quarter", from: `${qStart}-01`, to: monthRange(shiftMonth(qStart, 2)).to },
    { key: "fy", label: "This financial year", ...fy },
  ];
}

export interface Shape {
  order?: number; // column index
  dir?: "asc" | "desc";
  page?: number; // 1-based
  size?: number;
}

const cmp = (a: Cell | undefined, b: Cell | undefined) => {
  if (typeof a === "bigint" && typeof b === "bigint") return a < b ? -1 : a > b ? 1 : 0;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a ?? "").localeCompare(String(b ?? ""), undefined, { numeric: true, sensitivity: "base" });
};

/** Sort by one column and cut one page. The footer (totals) always covers the whole table. */
export function shapeTable(table: ExportTable, s: Shape): { rows: Cell[][]; total: number; pages: number; page: number } {
  let rows = table.rows;
  if (s.order !== undefined && s.order >= 0 && s.order < table.columns.length) {
    const sign = s.dir === "desc" ? -1 : 1;
    rows = [...rows].sort((a, b) => sign * cmp(a[s.order!], b[s.order!]));
  }
  const size = s.size && s.size > 0 ? s.size : rows.length || 1;
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const page = Math.min(Math.max(s.page ?? 1, 1), pages);
  return { rows: rows.slice((page - 1) * size, page * size), total: rows.length, pages, page };
}
