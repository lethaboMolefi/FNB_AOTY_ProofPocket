// Sign-in state. Firebase Authentication in production; in local development the API checks the password.
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError, api, setTokenGetter, setUnauthorizedHandler } from "./api";

export const AUTH_MODE: "local" | "firebase" = import.meta.env.VITE_AUTH_MODE === "firebase" ? "firebase" : "local";
const LOCAL_KEY = "pp.session";

type Status = "loading" | "signedOut" | "signedIn";
interface AuthApi {
  status: Status;
  email: string | null;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<void>;
  signInWithGoogle(): Promise<void>;
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

/** Removes this person's cached API data from the phone (service worker cache). */
function clearUserCache() {
  navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_USER_CACHE" });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>("loading");
  const [email, setEmail] = useState<string | null>(null);

  const reset = useCallback(() => { qc.clear(); clearUserCache(); }, [qc]);

  useEffect(() => {
    if (AUTH_MODE === "local") {
      const t = readLocal();
      setTokenGetter(async () => readLocal());
      // An expired or rejected session signs the person out instead of failing every screen.
      setUnauthorizedHandler(() => { writeLocal(null); reset(); setEmail(null); setStatus("signedOut"); });
      setEmail(emailOf(t));
      setStatus(t ? "signedIn" : "signedOut");
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
      await (await firebase()).signInWithGoogle();
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
