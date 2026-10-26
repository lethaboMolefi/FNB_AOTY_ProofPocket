import { describe, expect, it } from "vitest";
import { accountActionError, TEMP_PASSWORD_DAYS, tempPasswordState } from "./accounts";

const admin = { id: "a1", role: "admin" as const };

describe("which accounts an admin may approve, reject or suspend", () => {
  it("allows funders, advisers and buyers", () => {
    for (const role of ["funder", "adviser", "buyer"] as const) expect(accountActionError(admin, { id: "u1", role })).toBeNull();
  });
  it("never founders, other admins, or themselves", () => {
    expect(accountActionError(admin, { id: "u1", role: "founder" })).toBe("founder");
    expect(accountActionError(admin, { id: "a2", role: "admin" })).toBe("admin");
    expect(accountActionError(admin, { id: "a1", role: "admin" })).toBe("self");
  });
  it("only admins act at all", () => {
    expect(accountActionError({ id: "f1", role: "funder" }, { id: "u1", role: "buyer" })).toBe("not_admin");
  });
});

describe("temporary passwords", () => {
  const now = new Date("2026-10-26T10:00:00Z");
  it("last 7 days", () => expect(TEMP_PASSWORD_DAYS).toBe(7));
  it("an account without one is fine", () => expect(tempPasswordState(false, null, now)).toBe("ok"));
  it("must be changed before anything else while it's valid", () => {
    expect(tempPasswordState(true, new Date("2026-11-01T10:00:00Z"), now)).toBe("must_change");
  });
  it("is refused once expired (and a flagged account with no expiry counts as expired)", () => {
    expect(tempPasswordState(true, new Date("2026-10-26T09:59:59Z"), now)).toBe("expired");
    expect(tempPasswordState(true, null, now)).toBe("expired");
  });
});
