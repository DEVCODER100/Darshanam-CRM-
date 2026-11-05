import { describe, it, expect } from "vitest";
import { findAgentHeader, parseAgentRows, type ImportContext } from "./agent-import";

const ctx: ImportContext = {
  brokeragePlans: new Map([["plan 1", "bp1"]]),
  rewardPlans: new Map([["reward 1", "rp1"]]),
  existingCodes: new Set(["ag001", "ag002"]),
};
const header = ["Agent ID", "Title", "Full Name", "User Name", "Password", "Company Name", "Mobile No.", "Email", "SMS / WhatsApp Notification", "Email Notification", "Phone No.", "RERA Registration No.", "GSTIN", "PAN No.", "ID Proof No.", "Brokerage Plan", "Reward Plan", "Address", "Pin Code", "City", "State", "Country", "User Group", "User Status", "Created By", "More Information"];
const row = (o: Record<string, string>) => header.map((h) => o[h] ?? "");
const sheet = (...rows: string[][]) => [["Agent_Excel"], [""], ["Note : 1. Do not enter an Agent Id while creating new agents."], header, ...rows];

describe("agent import", () => {
  it("finds the header below the title and notes", () => {
    expect(findAgentHeader(sheet())).toBe(3);
    expect(findAgentHeader([["x"]])).toBe(-1);
  });
  it("creates a new agent from a row without an Agent ID, matching plans by name", () => {
    const { agents, problems } = parseAgentRows(
      sheet(row({ Title: "Mr.", "Full Name": "Asha Patel", "Mobile No.": "98765 43210", "Brokerage Plan": "plan 1", "Reward Plan": "Reward 1", City: "Surat", "SMS / WhatsApp Notification": "Yes", "Email Notification": "No", "User Status": "Inactive" })),
      ctx,
    );
    expect(problems).toEqual([]);
    expect(agents[0]).toMatchObject({ code: null, brokeragePlanId: "bp1", rewardPlanId: "rp1", line: 5 });
    expect(agents[0].fields).toMatchObject({ title: "Mr.", name: "Asha Patel", mobile: "98765 43210", city: "Surat", smsOptIn: true, emailOptIn: false, active: false });
  });
  it("a row with an existing Agent ID is an update; an unknown ID is a problem", () => {
    const { agents, problems } = parseAgentRows(sheet(row({ "Agent ID": "AG001", "Full Name": "Abc" }), row({ "Agent ID": "AG099", "Full Name": "Ghost", "Mobile No.": "1" })), ctx);
    expect(agents).toHaveLength(1);
    expect(agents[0].code).toBe("AG001");
    expect(problems).toEqual([{ line: 6, message: "Agent ID AG099 does not exist (leave it blank to add a new agent)" }]);
  });
  it("applies the file's rules: name, a way to contact, known plans, no duplicate IDs", () => {
    const { agents, problems } = parseAgentRows(
      sheet(
        row({ "Mobile No.": "1" }),
        row({ "Full Name": "No Contact" }),
        row({ "Full Name": "Bad Plan", "Mobile No.": "1", "Brokerage Plan": "Gold" }),
        row({ "Agent ID": "AG002", "Full Name": "A" }),
        row({ "Agent ID": "ag002", "Full Name": "A again" }),
      ),
      ctx,
    );
    expect(agents.map((a) => a.fields.name)).toEqual(["A"]);
    expect(problems.map((p) => p.message)).toEqual([
      "No full name",
      "Give a mobile number or an email",
      'Brokerage plan "Gold" does not exist; add it under Plans first',
      "Agent ID ag002 appears twice",
    ]);
  });
  it("ignores blank lines and never reads the password column", () => {
    const { agents } = parseAgentRows(sheet(row({}), row({ "Full Name": "Z", Email: "z@x.com", Password: "secret" })), ctx);
    expect(agents).toHaveLength(1);
    expect(JSON.stringify(agents[0])).not.toContain("secret");
  });
});
