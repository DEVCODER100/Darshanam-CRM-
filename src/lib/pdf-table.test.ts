import { describe, it, expect } from "vitest";
import { tableFromItems, type TextItem } from "./pdf-table";
import { buildRows, findHeaderRow, guessMapping } from "./unit-import";

// Column left edges / widths for a small unit-list PDF
const COLS = { no: [20, 15], unit: [60, 40], type: [130, 50], area: [220, 45], floor: [300, 25] };
const cell = (col: keyof typeof COLS, str: string, y: number, rightAlign = false): TextItem => {
  const [x, width] = COLS[col];
  const w = str.length * 5;
  return { str, x: rightAlign ? x + width - w : x, y, w, h: 9 };
};

const items: TextItem[] = [
  { str: "Unit list", x: 20, y: 20, w: 50, h: 14 }, // title above the table
  cell("no", "Sr", 50), cell("unit", "Unit No.", 50), cell("type", "Type", 50), cell("area", "Area (Sq Ft)", 50), cell("floor", "Floor", 50),
  cell("no", "1", 70), cell("unit", "B-1", 70), cell("type", "Bunglow", 70), cell("area", "2,150", 70, true),
  cell("no", "2", 90), cell("unit", "F-12", 90), cell("type", "Flat", 90), cell("area", "980", 90, true), cell("floor", "F3", 91), // slightly different baseline
  cell("no", "3", 110), cell("unit", "S-4", 110), cell("type", "Shop", 110), // no area on this row
];

describe("tableFromItems", () => {
  const grid = tableFromItems(items);
  it("puts every cell in its column, even right-aligned or missing ones", () => {
    expect(grid[1]).toEqual(["Sr", "Unit No.", "Type", "Area (Sq Ft)", "Floor"]);
    expect(grid[2]).toEqual(["1", "B-1", "Bunglow", "2,150", ""]);
    expect(grid[3]).toEqual(["2", "F-12", "Flat", "980", "F3"]);
    expect(grid[4]).toEqual(["3", "S-4", "Shop", "", ""]);
  });
  it("feeds straight into the unit import", () => {
    const h = findHeaderRow(grid);
    expect(h).toBe(1);
    const { rows, problems } = buildRows(grid.slice(h + 1), guessMapping(grid[h]));
    expect(problems).toEqual([]);
    expect(rows.map((r) => [r.number, r.type, r.area])).toEqual([
      ["B-1", "Bungalow", "2150.00"],
      ["F-12", "Flat", "980.00"],
      ["S-4", "Shop", null],
    ]);
  });
  it("returns nothing for a page with no text (a scan)", () => {
    expect(tableFromItems([])).toEqual([]);
    expect(tableFromItems([{ str: "  ", x: 0, y: 0, w: 1, h: 1 }])).toEqual([]);
  });
});
