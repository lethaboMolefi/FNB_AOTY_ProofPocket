// Email-only sign-up: the sign-in starts with a long random password that nobody sees (Firebase needs one), and the
// person chooses their own at the end (after Join ProofPocket, or after sending an application) on /set-password.
import { passwordFor } from "@proofpocket/shared";
import { api } from "./api";

function randomPassword(email: string) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_=+?";
  for (;;) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const pw = Array.from(bytes, (b) => chars[b % chars.length]).join("");
    if (passwordFor(email).safeParse(pw).success) return pw;
  }
}

export async function signUpEmailOnly(auth: { signUp(email: string, password: string): Promise<void> }, email: string) {
  await auth.signUp(email, randomPassword(email));
  await api("/auth/password/later", { body: {} });
}
