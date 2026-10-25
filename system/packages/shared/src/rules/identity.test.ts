import { describe, expect, it } from "vitest";
import { isValidSaId, maskId } from "./identity";

/** Adds the Luhn check digit to the first 12 digits, the way Home Affairs does. */
function withCheckDigit(first12: string) {
  for (let d = 0; d <= 9; d++) if (isValidSaId(first12 + d)) return first12 + d;
  throw new Error("no check digit");
}

describe("South African ID numbers", () => {
  it("accepts a real-format ID with the right check digit", () => {
    expect(isValidSaId("8001015009087")).toBe(true);
    expect(isValidSaId(withCheckDigit("990615012308"))).toBe(true);
  });

  it("rejects a wrong check digit, so a single mistyped digit is caught", () => {
    expect(isValidSaId("8001015009088")).toBe(false);
    expect(isValidSaId("8001015009086")).toBe(false);
  });

  it("needs exactly 13 digits", () => {
    expect(isValidSaId("800101500908")).toBe(false);
    expect(isValidSaId("80010150090870")).toBe(false);
    expect(isValidSaId("80010150090 7")).toBe(false);
    expect(isValidSaId("")).toBe(false);
  });

  it("needs a real date of birth", () => {
    // Check digits are right, but there's no 13th month or 31 April.
    expect(isValidSaId(withCheckDigitLoose("801301500908"))).toBe(false);
    expect(isValidSaId(withCheckDigitLoose("800431500908"))).toBe(false);
    // 29 February only in a leap year (2000 was one; 1900 / 2100 aside, 01 never is).
    expect(isValidSaId(withCheckDigit("000229500908"))).toBe(true);
    expect(isValidSaId(withCheckDigitLoose("010229500908"))).toBe(false);
  });

  it("shows only the last three digits", () => {
    expect(maskId("8001015009087")).toBe("••••••••••087");
    expect(maskId("")).toBe("");
  });
});

/** The Luhn digit regardless of the date, to test the date check on its own. */
function withCheckDigitLoose(first12: string) {
  const digits = first12.split("").map(Number);
  let sum = 0;
  digits.forEach((n, i) => {
    if (i % 2 === 0) sum += n;
    else { const x = n * 2; sum += x > 9 ? x - 9 : x; }
  });
  return first12 + ((10 - (sum % 10)) % 10);
}
