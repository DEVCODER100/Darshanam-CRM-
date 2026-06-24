import { describe, it, expect } from "vitest";
import { stageDisbursement, stageLadder } from "./stage-ladder";
import { rupeesToPaise } from "./money";

const CR = rupeesToPaise("10000000"); // ₹1 crore
const L = (lakh: number) => rupeesToPaise(String(lakh * 100000));

describe("stageDisbursement — PDF examples", () => {
  it("Ex1: ₹1Cr, Plinth 45%, received 0 -> eligible 45L, pending 45L", () => {
    const r = stageDisbursement(CR, "plinth", 0n);
    expect(r.eligible).toBe(L(45));
    expect(r.pendingRelease).toBe(L(45));
    expect(r.remaining).toBe(CR);
  });

  it("Ex2 (skip rule): ₹1Cr, Second Floor 80%, received 0 -> eligible 80L, pending 80L", () => {
    const r = stageDisbursement(CR, "second_floor", 0n);
    expect(r.eligible).toBe(L(80));
    expect(r.pendingRelease).toBe(L(80));
  });

  it("Ex3: ₹1Cr, Second Floor 80%, received 45L -> eligible 80L, pending 35L, left 55L", () => {
    const r = stageDisbursement(CR, "second_floor", L(45));
    expect(r.eligible).toBe(L(80));
    expect(r.pendingRelease).toBe(L(35));
    expect(r.remaining).toBe(L(55));
    expect(r.nextStage?.value).toBe("outside_plaster");
  });

  it("never releases beyond eligible (received > eligible -> pending 0)", () => {
    const r = stageDisbursement(CR, "plinth", L(45));
    expect(r.pendingRelease).toBe(0n);
  });
});

describe("stageLadder — per-stage status (Ex3: current 80%, received 45L)", () => {
  const ladder = stageLadder(CR, "second_floor", L(45));
  const byValue = Object.fromEntries(ladder.map((r) => [r.value, r]));

  it("plinth covered -> completed", () => {
    expect(byValue.plinth.eligibleAmount).toBe(L(45));
    expect(byValue.plinth.released).toBe(true);
    expect(byValue.plinth.status).toBe("completed");
  });
  it("ground/first not yet covered -> pending", () => {
    expect(byValue.ground_floor.status).toBe("pending");
    expect(byValue.first_floor.status).toBe("pending");
  });
  it("second floor is the current/active stage", () => {
    expect(byValue.second_floor.status).toBe("active");
  });
  it("stages above current are locked", () => {
    expect(byValue.outside_plaster.status).toBe("locked");
    expect(byValue.flooring.status).toBe("locked");
    expect(byValue.finishing.status).toBe("locked");
  });
  it("finishing eligible = full property cost", () => {
    expect(byValue.finishing.eligibleAmount).toBe(CR);
  });
});

describe("stageLadder — per-stage received/due (upgrade spec history table)", () => {
  // Villa ₹1Cr, current First Floor 70%, total received ₹55L.
  const ladder = stageLadder(CR, "first_floor", L(55));
  const byValue = Object.fromEntries(ladder.map((r) => [r.value, r]));

  it("Plinth 45% -> received 45L, due 0, Paid", () => {
    expect(byValue.plinth.received).toBe(L(45));
    expect(byValue.plinth.due).toBe(0n);
    expect(byValue.plinth.status).toBe("completed");
  });
  it("Ground 55% -> received 55L, due 0, Paid", () => {
    expect(byValue.ground_floor.received).toBe(L(55));
    expect(byValue.ground_floor.due).toBe(0n);
    expect(byValue.ground_floor.status).toBe("completed");
  });
  it("First Floor 70% (current) -> received 55L, due 15L, Current", () => {
    expect(byValue.first_floor.received).toBe(L(55));
    expect(byValue.first_floor.due).toBe(L(15));
    expect(byValue.first_floor.status).toBe("active");
  });
  it("Second Floor 80% and above -> locked, received/due null", () => {
    expect(byValue.second_floor.status).toBe("locked");
    expect(byValue.second_floor.received).toBeNull();
    expect(byValue.second_floor.due).toBeNull();
  });
});

describe("stageDisbursement — fully paid + Example 4", () => {
  it("Example 4: Flooring 95%, received 70L -> due 25L, remaining 30L", () => {
    const r = stageDisbursement(CR, "flooring", L(70));
    expect(r.eligible).toBe(L(95));
    expect(r.pendingRelease).toBe(L(25));
    expect(r.remaining).toBe(L(30));
    expect(r.fullyPaid).toBe(false);
  });
  it("stage fully collected -> fullyPaid true", () => {
    const r = stageDisbursement(CR, "plinth", L(45));
    expect(r.pendingRelease).toBe(0n);
    expect(r.fullyPaid).toBe(true);
  });
});
