import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, codeFor, matchStep, otpauthUri, stepAt } from "../src/lib/totp";

// RFC 6238 appendix B, SHA-1 secret "12345678901234567890".
const RFC = base32Encode(Buffer.from("12345678901234567890"));

describe("TOTP (Google Authenticator)", () => {
  it("matches the RFC 6238 test vectors", () => {
    for (const [t, code] of [[59, "94287082"], [1111111109, "07081804"], [1234567890, "89005924"], [2000000000, "69279037"]] as const) {
      expect(codeFor(RFC, stepAt(t), 8)).toBe(code);
    }
  });
  it("base32 round-trips", () => {
    expect(base32Encode(Buffer.from("foobar"))).toBe("MZXW6YTBOI");
    expect(base32Decode("MZXW6YTBOI").toString()).toBe("foobar");
  });
  it("accepts one step of drift and nothing more", () => {
    const now = 1_800_000_000;
    expect(matchStep(RFC, codeFor(RFC, stepAt(now)), now)).toBe(stepAt(now));
    expect(matchStep(RFC, codeFor(RFC, stepAt(now) - 1), now)).toBe(stepAt(now) - 1);
    expect(matchStep(RFC, codeFor(RFC, stepAt(now) + 2), now)).toBeNull();
    expect(matchStep(RFC, "12ab56", now)).toBeNull();
  });
  it("builds the otpauth link", () => {
    expect(otpauthUri("ABC", "a@b.co")).toBe("otpauth://totp/ProofPocket%3Aa%40b.co?secret=ABC&issuer=ProofPocket&algorithm=SHA1&digits=6&period=30");
  });
});
