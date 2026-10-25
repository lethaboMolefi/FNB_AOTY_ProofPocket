// Sign-in state. Firebase Authentication in production; in local development the API checks the password.
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError, api, setTokenGetter, setUnauthorizedHandler } from "./api";
import { googleSignInMessage } from "./google-sign-in";
import { setOutboxOwner } from "./outbox";

export const AUTH_MODE: "local" | "firebase" = import.meta.env.VITE_AUTH_MODE === "firebase" ? "firebase" : "local";
const LOCAL_KEY = "pp.session";

type Status = "loading" | "signedOut" | "signedIn";
interface AuthApi {
  status: Status;
  email: string | null;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<void>;
  /** Firebase only. false when the person closed the Google window; a plain-language ApiError for anything else. */
  signInWithGoogle(): Promise<boolean>;
  /** Firebase only: emails a password reset link. */
  resetPassword(email: string): Promise<void>;
  signOut(): Promise<void>;
}

const Ctx = createContext<AuthApi | null>(null);
const firebase = () => import("./firebase");

const readLocal = () => { try { return localStorage.getItem(LOCAL_KEY); } catch { return null; } };
const writeLocal = (t: string | null) => { try { if (t) localStorage.setItem(LOCAL_KEY, t); else localStorage.removeItem(LOCAL_KEY); } catch { /* storage blocked */ } };
/** The email inside a local session token (for display only; the API verifies the signature). */
const emailOf = (t: string | null) => { try { return t ? (JSON.parse(atob(t.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/"))) as { email: string }).email : null; } catch { return null; } };

// Local sessions are known at load time, so the token getter is registered before any query runs.
// (Registering it in an effect is too late: child components' effects start their queries first.)
if (AUTH_MODE === "local") setTokenGetter(async () => readLocal());

/** Removes this person's cached API data from the phone (service worker cache). */
function clearUserCache() {
  navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_FOUNDER_API_CACHE" });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  // Local sessions are read straight away; Firebase reports its state once it has loaded.
  const [status, setStatus] = useState<Status>(() => (AUTH_MODE === "local" ? (readLocal() ? "signedIn" : "signedOut") : "loading"));
  const [email, setEmail] = useState<string | null>(() => (AUTH_MODE === "local" ? emailOf(readLocal()) : null));

  const reset = useCallback(() => { qc.clear(); clearUserCache(); }, [qc]);
  // Offline items belong to the account that saved them.
  useEffect(() => { setOutboxOwner(status === "signedIn" ? email : null); }, [status, email]);

  useEffect(() => {
    if (AUTH_MODE === "local") {
      // An expired or rejected session signs the person out instead of failing every screen.
      setUnauthorizedHandler(() => { writeLocal(null); reset(); setEmail(null); setStatus("signedOut"); });
      return;
    }
    let unsub = () => {};
    void firebase().then((fb) => {
      setTokenGetter(fb.token);
      setUnauthorizedHandler(() => { void fb.out(); });
      unsub = fb.watch((u) => { setEmail(u?.email ?? null); setStatus(u ? "signedIn" : "signedOut"); });
    });
    return () => unsub();
  }, [reset]);

  const value = useMemo<AuthApi>(() => ({
    status, email,
    async signIn(e, p) {
      reset();
      if (AUTH_MODE === "firebase") { await (await firebase()).signIn(e, p); return; }
      writeLocal(null);
      const { token } = await api<{ token: string }>("/auth/local/sign-in", { body: { email: e, password: p } });
      writeLocal(token); setEmail(emailOf(token)); setStatus("signedIn");
    },
    async signUp(e, p) {
      reset();
      if (AUTH_MODE === "firebase") { await (await firebase()).signUp(e, p); return; }
      writeLocal(null);
      const { token } = await api<{ token: string }>("/auth/local/sign-up", { body: { email: e, password: p } });
      writeLocal(token); setEmail(emailOf(token)); setStatus("signedIn");
    },
    async resetPassword(e) {
      if (AUTH_MODE !== "firebase") throw new ApiError(400, "not_available", "Password reset emails work once ProofPocket is connected to Firebase.");
      await (await firebase()).resetPassword(e);
    },
    async signInWithGoogle() {
      if (AUTH_MODE !== "firebase") throw new ApiError(400, "not_available", "Google sign-in works once ProofPocket is connected to Firebase.");
      reset();
      try {
        await (await firebase()).signInWithGoogle();
        return true;
      } catch (e) {
        const message = googleSignInMessage((e as { code?: string }).code);
        if (message === null) return false;
        throw new ApiError(400, "google_sign_in", message);
      }
    },
    async signOut() {
      reset();
      if (AUTH_MODE === "local") { writeLocal(null); setEmail(null); setStatus("signedOut"); return; }
      await (await firebase()).out();
    },
  }), [status, email, reset]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
