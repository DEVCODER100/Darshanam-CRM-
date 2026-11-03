/**
 * pdf-table.ts — rebuilds a table from the positioned text of a PDF page. Pure.
 * Rows come from text sharing a baseline; columns come from where the header
 * cells sit, so a row with an empty cell (or right-aligned numbers) still lines up.
 */
import { findHeaderRow } from "./unit-import";

export interface TextItem {
  str: string;
  x: number; // left edge
  y: number; // baseline (larger = lower on the page)
  w: number;
  h: number;
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;

/** Lines of items, top to bottom, each left to right. */
function toLines(items: TextItem[]): TextItem[][] {
  const tol = Math.max(2, median(items.map((i) => i.h)) * 0.5);
  const lines: TextItem[][] = [];
  for (const it of [...items].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const line = lines.find((l) => Math.abs(l[0].y - it.y) <= tol);
    if (line) line.push(it);
    else lines.push([it]);
  }
  return lines.map((l) => l.sort((a, b) => a.x - b.x));
}

/** A grid of strings (header row included) from the text items of one or more pages. */
export function tableFromItems(items: TextItem[]): string[][] {
  const clean = items.filter((i) => i.str.trim());
  if (!clean.length) return [];
  const lines = toLines(clean);

  // The header is the line whose cells look most like column names; its cells set the columns.
  const header = lines[findHeaderRow(lines.map((l) => l.map((i) => i.str)))];
  const centres = header.map((i) => i.x + i.w / 2);
  const column = (it: TextItem) => {
    const c = it.x + it.w / 2;
    let best = 0;
    centres.forEach((cc, i) => {
      if (Math.abs(cc - c) < Math.abs(centres[best] - c)) best = i;
    });
    return best;
  };

  const grid = lines.map((line) => {
    const cells: string[] = Array(header.length).fill("");
    for (const it of line) {
      const i = column(it);
      cells[i] = cells[i] ? `${cells[i]} ${it.str.trim()}` : it.str.trim();
    }
    return cells;
  });
  // Multi-page reports repeat the header on every page; keep only the first.
  const head = grid.findIndex((r) => r.join("|") === header.map((i) => i.str.trim()).join("|"));
  return grid.filter((r, i) => i <= head || r.join("|") !== grid[head].join("|"));
}
