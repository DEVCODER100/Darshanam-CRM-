import { describe, it, expect } from "vitest";
import { boxAt, boxForLabel, clampRect, detectLabels, gridRects, matchUnit, naturalCompare } from "./map-boxes";

describe("clampRect / boxAt", () => {
  it("keeps boxes on the map and clickable", () => {
    expect(clampRect({ x: 99, y: -5, w: 10, h: 0.1 })).toEqual({ x: 90, y: 0, w: 10, h: 0.6 });
  });
  it("makes a box square on screen for a wide map", () => {
    const b = boxAt(50, 50, 2, 4); // map twice as wide as tall: h% must be double w%
    expect(b).toEqual({ x: 48, y: 46, w: 4, h: 8 });
  });
});

describe("gridRects", () => {
  it("fills the area row by row with no overlap", () => {
    const cells = gridRects({ x: 10, y: 10, w: 40, h: 20 }, 2, 4, 0);
    expect(cells).toHaveLength(8);
    expect(cells[0]).toEqual({ x: 10, y: 10, w: 10, h: 10 });
    expect(cells[3]).toEqual({ x: 40, y: 10, w: 10, h: 10 });
    expect(cells[4]).toEqual({ x: 10, y: 20, w: 10, h: 10 });
  });
  it("leaves a gap between cells", () => {
    const [a, b] = gridRects({ x: 0, y: 0, w: 20.2, h: 10 }, 1, 2, 0.2);
    expect(b.x - (a.x + a.w)).toBeCloseTo(0.2, 1);
  });
});

describe("label detection", () => {
  const item = (label: string, x = 10, y = 10) => ({ label, x, y, w: 1, h: 0.8 });
  it("keeps unit-number-like text and drops everything else", () => {
    const found = detectLabels([item("B-12"), item("Shop 4"), item("101"), item("12A"), item("ROAD 30 FT WIDE"), item("North"), item("")]);
    expect(found.map((f) => f.label)).toEqual(["B-12", "Shop 4", "101", "12A"]);
  });
  it("drops the same label printed twice in one place", () => {
    expect(detectLabels([item("7"), item("7", 10.2, 10.1), item("7", 50, 50)])).toHaveLength(2);
  });
  it("gives each label a clickable box centred on it", () => {
    const b = boxForLabel({ label: "7", x: 20, y: 20, w: 0.5, h: 0.4 }, 1);
    expect(b.w).toBeGreaterThanOrEqual(1.4);
    expect(b.x + b.w / 2).toBeCloseTo(20.25, 1);
  });
});

describe("matchUnit", () => {
  const units = [
    { id: "1", number: "B-12", type: "Bungalow", project: "" },
    { id: "2", number: "12", type: "Flat", project: "" },
    { id: "3", number: "12", type: "Shop", project: "" },
  ];
  it("matches ignoring case and punctuation", () => {
    expect(matchUnit("b 12", units)?.id).toBe("1");
  });
  it("is null when ambiguous, unless the type settles it", () => {
    expect(matchUnit("12", units)).toBeNull();
    expect(matchUnit("12", units, "shop")?.id).toBe("3");
  });
  it("is null when nothing matches", () => expect(matchUnit("99", units)).toBeNull());
});

describe("naturalCompare", () => {
  it("sorts numbers inside names naturally", () => {
    expect(["V-10", "V-2", "V-1"].sort(naturalCompare)).toEqual(["V-1", "V-2", "V-10"]);
  });
});
