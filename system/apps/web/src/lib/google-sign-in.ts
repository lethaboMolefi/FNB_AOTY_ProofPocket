// Plain-language messages for Firebase's Google sign-in error codes. null means the person cancelled: say nothing.
const MESSAGES: Record<string, string | null> = {
  "auth/popup-closed-by-user": null,
  "auth/cancelled-popup-request": null,
  "auth/user-cancelled": null,
  "auth/popup-blocked": "Your browser blocked the Google window. Allow pop-ups for ProofPocket, then try again.",
  "auth/operation-not-allowed": "Google sign-in isn't available right now. Sign in with your email and password.",
  "auth/account-exists-with-different-credential": "There's already a ProofPocket account for this email. Sign in with your email and password.",
  "auth/network-request-failed": "No connection. Check your internet, then try again.",
  "auth/unauthorized-domain": "Google sign-in isn't available on this address. Sign in with your email and password.",
};

export function googleSignInMessage(code: string | undefined): string | null {
  return code !== undefined && code in MESSAGES ? MESSAGES[code]! : "Google sign-in didn't work. Try again.";
}
