import { describe, expect, it } from "vitest";
import { velocityFlag } from "./fraud";

const now = new Date("2026-10-25T12:00:00+02:00");
const minsAgo = (m: number) => new Date(now.getTime() - m * 60_000);

describe("cash-entry velocity check", () => {
  it("says nothing at a normal pace", () => {
    expect(velocityFlag([minsAgo(1), minsAgo(3), minsAgo(9), minsAgo(30)], now)).toBeNull();
    expect(velocityFlag([], now)).toBeNull();
  });
  it("flags more than 5 entries in 10 minutes", () => {
    expect(velocityFlag([1, 2, 3, 4, 5].map(minsAgo), now)).toBeNull();
    expect(velocityFlag([1, 2, 3, 4, 5, 6].map(minsAgo), now)).toMatch(/more than 5 entries in 10 minutes/);
  });
  it("flags more than 15 entries in an hour", () => {
    const spread = Array.from({ length: 16 }, (_, i) => minsAgo(11 + i * 3));
    expect(velocityFlag(spread, now)).toMatch(/more than 15 entries in one hour/);
  });
  it("accepts ISO strings", () => {
    expect(velocityFlag([1, 2, 3, 4, 5, 6].map((m) => minsAgo(m).toISOString()), now)).not.toBeNull();
  });
});
