import { describe, it, expect } from "vitest";
import { callLink, mailLink, renderMessage, smsLink, waNumber, whatsappLink } from "./contact-message";

describe("contact helpers", () => {
  it("cleans Indian numbers", () => {
    expect(waNumber("98765 43210")).toBe("919876543210");
    expect(waNumber("+91 98765-43210")).toBe("919876543210");
    expect(waNumber("09876543210")).toBe("919876543210");
    expect(waNumber("+14155550123")).toBe("14155550123");
  });
  it("fills the template and leaves unknown fields visible", () => {
    expect(renderMessage("Hi {name}, {unit} due {due} {nope}", { name: "Asha", unit: "Flat 101", due: "₹5,000" })).toBe("Hi Asha, Flat 101 due ₹5,000 {nope}");
  });
  it("builds links with the text encoded", () => {
    expect(whatsappLink("98765 43210", "Hi & bye")).toBe("https://wa.me/919876543210?text=Hi%20%26%20bye");
    expect(smsLink("9876543210", "Hi")).toBe("sms:+919876543210?body=Hi");
    expect(mailLink("a@b.com", "Hello there", "Line")).toBe("mailto:a@b.com?subject=Hello%20there&body=Line");
    expect(callLink("9876543210")).toBe("tel:+919876543210");
  });
});
