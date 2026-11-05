import { describe, it, expect } from "vitest";
import {
  buildRows,
  subTypeFromName,
  findHeaderRow,
  guessMapping,
  normalizeType,
  planImport,
  unitKey,
  type ExistingUnit,
} from "./unit-import";

describe("normalizeType", () => {
  it("reads the spellings people actually type", () => {
    expect(["Bunglow", "BANGLOWS", "bungalow", "Banglo"].map(normalizeType)).toEqual(Array(4).fill("Bungalow"));
    expect(["Vella", "villa", "Villas", "Vila"].map(normalizeType)).toEqual(Array(4).fill("Villa"));
    expect(normalizeType("Flat 3BHK")).toBe("Flat");
    expect(normalizeType("APT")).toBe("Apartment");
    expect(normalizeType("Shops")).toBe("Shop");
    expect(normalizeType("Plot")).toBe("Plot");
    expect(normalizeType("garage")).toBeNull();
    expect(normalizeType("")).toBeNull();
  });
});

describe("header detection", () => {
  const sheet = [
    ["Unit list as on 02 Nov 2026", "", "", ""],
    ["", "", "", ""],
    ["Sr No", "Unit No.", "Type", "Area (Sq Ft)", "Floor"],
    ["1", "B-1", "Bunglow", "2,150", ""],
  ];
  it("skips title rows", () => expect(findHeaderRow(sheet)).toBe(2));
  it("maps the columns it recognises, ignoring the serial number", () => {
    expect(guessMapping(sheet[2])).toEqual({ number: 1, type: 2, area: 3, floor: 4 });
  });
  it("falls back to the first filled row when nothing looks like a header", () => {
    expect(findHeaderRow([["", ""], ["x", "y"], ["1", "2"]])).toBe(1);
  });
});

describe("buildRows", () => {
  const mapping = { number: 0, type: 1, project: 2, area: 3, floor: 4 };
  it("cleans rows, converts areas and normalises types", () => {
    const { rows, problems } = buildRows(
      [
        [" B-1 ", "Bunglow", "Green Park", "2,150.5", "G+1"],
        ["12.0", "flat", "", "", ""],
      ],
      mapping,
      { defaultProject: "Main" },
    );
    expect(problems).toEqual([]);
    expect(rows[0]).toEqual({ project: "Green Park", type: "Bungalow", number: "B-1", area: "2150.50", floor: "G+1", subType: null });
    expect(rows[1]).toEqual({ project: "Main", type: "Flat", number: "12", area: null, floor: null, subType: null });
  });
  it("converts square metres and yards", () => {
    expect(buildRows([["1", "villa", "", "100", ""]], mapping, { areaUnit: "sqm" }).rows[0].area).toBe("1076.39");
    expect(buildRows([["1", "villa", "", "100", ""]], mapping, { areaUnit: "sqyd" }).rows[0].area).toBe("900.00");
  });
  it("reports bad rows with their file line and keeps going", () => {
    const { rows, problems } = buildRows(
      [
        ["", "Villa", "", "900", ""],
        ["", "Page 2 of 3", "", "", ""], // a lone title/footer cell is ignored
        ["V-1", "garage", "", "", ""],
        ["V-2", "Villa", "", "", ""],
        ["", "", "", "", ""],
        ["v-2", "VILLA", "", "", ""],
      ],
      mapping,
      {},
      5,
    );
    expect(rows.map((r) => r.number)).toEqual(["V-2"]);
    expect(problems).toEqual([
      { line: 5, message: "No unit number" },
      { line: 7, message: 'Unknown type "garage"' },
      { line: 10, message: "Same unit as line 8" },
    ]);
  });
  it("uses the default type when the file has no type column", () => {
    const { rows } = buildRows([["7", "", "", "", ""]], { number: 0 }, { defaultType: "Shop" });
    expect(rows[0].type).toBe("Shop");
  });
});

describe("planImport", () => {
  const existing: ExistingUnit[] = [
    { id: "a", project: "", type: "Villa", number: "V-101", area: "1500.00", floor: null, subType: null },
    { id: "b", project: "", type: "Villa", number: "V-102", area: null, floor: null, subType: null },
  ];
  const row = (number: string, area: string | null = null, floor: string | null = null) => ({
    project: "",
    type: "Villa" as const,
    number,
    area,
    floor,
    subType: null,
  });
  it("splits new, changed and identical units, ignoring case", () => {
    const plan = planImport([row("v-101", "1500"), row("V-102", "1800.50", "G"), row("V-103")], existing);
    expect(plan.unchanged).toBe(1);
    expect(plan.create.map((r) => r.number)).toEqual(["V-103"]);
    expect(plan.update).toEqual([{ id: "b", row: row("V-102", "1800.50", "G"), changes: ["area 1800.50 sq ft", "floor G"] }]);
  });
  it("a blank area never wipes an existing one", () => {
    expect(planImport([row("V-101")], existing).unchanged).toBe(1);
  });
  it("unitKey ignores case and extra spaces", () => {
    expect(unitKey("Green  Park", "Villa", "V 1")).toBe(unitKey("green park", "villa", "v 1"));
  });
});

describe("sub type", () => {
  it("is read from the unit name", () => {
    expect(subTypeFromName("38 · Type E")).toBe("Type E");
    expect(subTypeFromName("V-12 type-b")).toBe("Type B");
    expect(subTypeFromName("B-12")).toBeNull();
  });
  it("comes from its own column, else from the name", () => {
    const { rows } = buildRows([["41 · Type F", "Villa", "Type A"], ["42 · Type F", "Villa", ""]], { number: 0, type: 1, subType: 2 });
    expect(rows.map((r) => r.subType)).toEqual(["Type A", "Type F"]);
  });
});
