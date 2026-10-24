import { describe, expect, it } from "vitest";
import { maskBank, messageRiskFlags, senderKey } from "./fraud";
import { budgetCheck, canAskReason, canWithdraw, offerNeedsReason } from "./funding";

describe("messages about money", () => {
  it("flags the prototype's fee scam exactly as v2 did", () => {
    const text = "Congratulations! Your salon qualifies for R250 000. Pay a R1 500 processing fee today to release the funds.";
    expect(messageRiskFlags({ text, verifiedSender: false })).toEqual([
      "Sender is not a verified funder", "Asks for a fee before money is released", "Pressure to act today",
    ]);
  });
  it("doesn't flag a verified incubator's ordinary message", () => {
    expect(messageRiskFlags({ text: "Bring your CIPC questions to Thursday's registration session.", verifiedSender: true })).toEqual([]);
  });
  it("flags requests for PINs, new bank details and reported senders", () => {
    expect(messageRiskFlags({ text: "Please send the OTP we sent you", verifiedSender: false })).toEqual(["Asks for your PIN, password or code"]);
    expect(messageRiskFlags({ text: "We have new bank details, pay there from now", verifiedSender: false })).toEqual(["Asks you to pay into new bank details"]);
    expect(messageRiskFlags({ text: "hello", verifiedSender: false, onWatchlist: true })).toEqual(["Other founders reported this sender"]);
  });
  it("normalises senders", () => {
    expect(senderKey(" Approvals.Fund@QuickGrantz-mail.com ")).toBe("approvals.fund@quickgrantz-mail.com");
    expect(senderKey("+27 71 555 0142")).toBe("0715550142");
    expect(senderKey("071-555-0142")).toBe("0715550142");
  });
  it("masks supplier bank details", () => {
    expect(maskBank("Capitec", "1452 336 871 3310")).toBe("Capitec ••3310");
  });
});

describe("funder decisions", () => {
  it("offers after the first need a reason", () => {
    expect(offerNeedsReason(true, "")).toBe(false);
    expect(offerNeedsReason(false, "  ")).toBe(true);
    expect(offerNeedsReason(false, "Budget reduced")).toBe(false);
  });
  it("approval is checked against what's left of the budget", () => {
    expect(budgetCheck({ budget: 1_200_000, committed: 860_000 }, 28_000)).toEqual({ left: 340_000, exceeds: false, after: 312_000 });
    expect(budgetCheck({ budget: 100, committed: 90 }, 20).exceeds).toBe(true);
  });
  it("asking for a reason and withdrawing", () => {
    expect(canAskReason([{ reason: "Requested amount" }, { reason: "" }], false)).toBe(true);
    expect(canAskReason([{ reason: "Requested amount" }, { reason: "" }], true)).toBe(false);
    expect(canAskReason([{ reason: "Requested amount" }], false)).toBe(false);
    expect(canWithdraw("under_review")).toBe(true);
    expect(canWithdraw("approved")).toBe(false);
  });
});
