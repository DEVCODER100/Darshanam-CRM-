import { describe, it, expect } from "vitest";
import { projectLabel, projectSlug } from "./project-label";

describe("project names", () => {
  it("joins name and area", () => {
    expect(projectLabel({ name: "Splendora 3", area: "Construction Area 2" })).toBe("Splendora 3 – Construction Area 2");
    expect(projectLabel({ name: "Splendora 4", area: "" })).toBe("Splendora 4");
  });
  it("makes a file-safe slug", () => {
    expect(projectSlug("Splendora 3 – Construction Area 2")).toBe("Splendora-3-Construction-Area-2");
    expect(projectSlug("All projects")).toBe("All-projects");
  });
});
