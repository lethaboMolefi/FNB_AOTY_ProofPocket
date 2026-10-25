import { describe, expect, it } from "vitest";
import { googleSignInMessage } from "./google-sign-in";

describe("Google sign-in messages", () => {
  it("says nothing when the person closes the Google window", () => {
    expect(googleSignInMessage("auth/popup-closed-by-user")).toBeNull();
    expect(googleSignInMessage("auth/cancelled-popup-request")).toBeNull();
    expect(googleSignInMessage("auth/user-cancelled")).toBeNull();
  });

  it("explains a blocked pop-up", () => {
    expect(googleSignInMessage("auth/popup-blocked")).toMatch(/allow pop-ups/i);
  });

  it("sends people to email and password when Google isn't available or the email has another sign-in", () => {
    expect(googleSignInMessage("auth/operation-not-allowed")).toMatch(/email and password/);
    expect(googleSignInMessage("auth/account-exists-with-different-credential")).toMatch(/email and password/);
  });

  it("explains a lost connection", () => {
    expect(googleSignInMessage("auth/network-request-failed")).toMatch(/internet/);
  });

  it("falls back to a general message for anything else", () => {
    expect(googleSignInMessage("auth/internal-error")).toBe("Google sign-in didn't work. Try again.");
    expect(googleSignInMessage(undefined)).toBe("Google sign-in didn't work. Try again.");
  });
});
