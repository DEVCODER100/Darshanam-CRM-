import { describe, it, expect } from "vitest";
import { canOpen, checkFile, checklist, isDocumentType, MAX_FILE_BYTES } from "./document-rules";

describe("document rules", () => {
  it("accepts PDFs and images, refuses everything else and oversize files", () => {
    expect(checkFile({ type: "application/pdf", size: 1000 })).toBeNull();
    expect(checkFile({ type: "image/png", size: MAX_FILE_BYTES })).toBeNull();
    expect(checkFile({ type: "application/x-msdownload", size: 10 })).toMatch(/PDF, JPG/);
    expect(checkFile({ type: "image/jpeg", size: MAX_FILE_BYTES + 1 })).toMatch(/too large/);
  });
  it("knows the document types", () => {
    expect(isDocumentType("aadhaar")).toBe(true);
    expect(isDocumentType("passport")).toBe(false);
    expect(isDocumentType(undefined)).toBe(false);
  });
  it("hides Aadhaar, PAN and address proof from roles without sensitive access", () => {
    expect(canOpen("aadhaar", false)).toBe(false);
    expect(canOpen("pan", false)).toBe(false);
    expect(canOpen("address_proof", false)).toBe(false);
    expect(canOpen("agreement", false)).toBe(true);
    expect(canOpen("aadhaar", true)).toBe(true);
  });
  it("builds the checklist with counts and gaps", () => {
    const list = checklist([{ documentType: "aadhaar" }, { documentType: "aadhaar" }, { documentType: "pan" }, { documentType: "agreement" }]);
    expect(list.map((r) => [r.type, r.count])).toEqual([
      ["aadhaar", 2], ["pan", 1], ["photo", 0], ["address_proof", 0], ["booking_form", 0],
    ]);
  });
});
