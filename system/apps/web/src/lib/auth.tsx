// Sign-in state. Firebase in production; in local development, a picker of seeded accounts.
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { setTokenGetter } from "./api";

export const AUTH_MODE: "dev" | "firebase" = import.meta.env.VITE_AUTH_MODE === "firebase" ? "firebase" : "dev";
const DEV_KEY = "pp.devToken";

type Status = "loading" | "signedOut" | "signedIn";
interface AuthApi {
  status: Status;
  email: string | null;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<void>;
  /** Development only: sign in as a seeded account. */
  devSignIn(email: string): void;
  signOut(): Promise<void>;
}

const Ctx = createContext<AuthApi | null>(null);
const firebase = () => import("./firebase");

function readDevToken() {
  try { return localStorage.getItem(DEV_KEY); } catch { return null; }
}

/** Removes this person's cached API data from the phone (service worker cache). */
function clearUserCache() {
  navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_USER_CACHE" });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>("loading");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (AUTH_MODE === "dev") {
      const t = readDevToken();
      setTokenGetter(async () => readDevToken());
      setEmail(t ? t.split(":")[1] ?? null : null);
      setStatus(t ? "signedIn" : "signedOut");
      return;
    }
    let unsub = () => {};
    void firebase().then((fb) => {
      setTokenGetter(fb.token);
      unsub = fb.watch((u) => { setEmail(u?.email ?? null); setStatus(u ? "signedIn" : "signedOut"); });
    });
    return () => unsub();
  }, []);

  const reset = useCallback(() => { qc.clear(); clearUserCache(); }, [qc]);

  const value = useMemo<AuthApi>(() => ({
    status, email,
    async signIn(e, p) { reset(); await (await firebase()).signIn(e, p); },
    async signUp(e, p) { reset(); await (await firebase()).signUp(e, p); },
    devSignIn(e) {
      reset();
      // Each sign-in gets a new auth time, so PIN checks behave as they do with Firebase.
      try { localStorage.setItem(DEV_KEY, `dev:${e.toLowerCase()}:${Math.floor(Date.now() / 1000)}`); } catch { /* storage blocked */ }
      setEmail(e.toLowerCase());
      setStatus("signedIn");
    },
    async signOut() {
      reset();
      if (AUTH_MODE === "dev") { try { localStorage.removeItem(DEV_KEY); } catch { /* ignore */ } setEmail(null); setStatus("signedOut"); return; }
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
