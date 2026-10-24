import { describe, expect, it } from "vitest";
import { matchExisting, methodFromDescription, sameLine } from "./statements";

const entries = [
  { id: "e1", date: "2026-10-20", amount: 250, direction: "in" as const, note: "Gel overlay · Naledi · PP-4790 · proof of payment attached" },
  { id: "e2", date: "2026-10-18", amount: 780, direction: "out" as const, note: "PET bottles" },
];

describe("statement lines", () => {
  it("matches a payment reference already in the books", () => {
    expect(matchExisting({ date: "2026-10-25", description: "PAYSHAP CR NALEDI M PP-4790", amount: 250, direction: "in" }, entries)?.id).toBe("e1");
  });
  it("matches the same amount within 3 days, not later", () => {
    expect(matchExisting({ date: "2026-10-21", description: "CASH SEND", amount: 780, direction: "out" }, entries)?.id).toBe("e2");
    expect(matchExisting({ date: "2026-10-22", description: "CASH SEND", amount: 780, direction: "out" }, entries)).toBeUndefined();
    expect(matchExisting({ date: "2026-10-18", description: "REFUND", amount: 780, direction: "in" }, entries)).toBeUndefined();
  });
  it("guesses the method like the prototype", () => {
    expect(methodFromDescription("PAYSHAP CR KHUMALO T")).toBe("payshap");
    expect(methodFromDescription("POS PURCHASE BUILDERS ALEX")).toBe("card_machine");
    expect(methodFromDescription("IB PAYMENT TO SUPPLIER")).toBe("eft");
  });
  it("spots the same line imported twice", () => {
    const a = { date: "2026-10-23", description: "POS PURCHASE BUILDERS ALEX", amount: 315, direction: "out" as const };
    expect(sameLine(a, { ...a, description: "pos purchase builders alex " })).toBe(true);
    expect(sameLine(a, { ...a, amount: 316 })).toBe(false);
  });
});
