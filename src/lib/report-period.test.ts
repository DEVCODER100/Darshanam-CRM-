import { describe, it, expect } from "vitest";
import { periodPresets, shapeTable } from "./report-period";
import type { ExportTable } from "./export-types";

describe("periodPresets", () => {
  const p = (today: string) => Object.fromEntries(periodPresets(today).map((x) => [x.key, [x.from, x.to]]));
  it("gives this and last month, the quarter and the Indian financial year", () => {
    expect(p("2026-11-05")).toEqual({
      month: ["2026-11-01", "2026-11-30"],
      last: ["2026-10-01", "2026-10-31"],
      quarter: ["2026-10-01", "2026-12-31"],
      fy: ["2026-04-01", "2027-03-31"],
    });
  });
  it("handles January (last month is last December; FY started the previous April)", () => {
    expect(p("2027-01-15")).toEqual({
      month: ["2027-01-01", "2027-01-31"],
      last: ["2026-12-01", "2026-12-31"],
      quarter: ["2027-01-01", "2027-03-31"],
      fy: ["2026-04-01", "2027-03-31"],
    });
  });
});

describe("shapeTable", () => {
  const table: ExportTable = {
    title: "t",
    columns: [{ header: "Name" }, { header: "Amount", money: true }],
    rows: [["b", 200n], ["a", 1000n], ["c", 50n], ["10", 1n], ["9", 2n]],
  };
  it("sorts text naturally and money by value, either way", () => {
    expect(shapeTable(table, { order: 0 }).rows.map((r) => r[0])).toEqual(["9", "10", "a", "b", "c"]);
    expect(shapeTable(table, { order: 1, dir: "desc" }).rows.map((r) => r[1])).toEqual([1000n, 200n, 50n, 2n, 1n]);
  });
  it("pages, clamping the page number", () => {
    const s = shapeTable(table, { size: 2, page: 2 });
    expect(s.rows).toHaveLength(2);
    expect([s.total, s.pages, s.page]).toEqual([5, 3, 2]);
    expect(shapeTable(table, { size: 2, page: 99 }).page).toBe(3);
    expect(shapeTable(table, {}).rows).toHaveLength(5);
  });
});
