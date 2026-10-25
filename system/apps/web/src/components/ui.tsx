import type { Tone } from "@proofpocket/shared";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Pill = ({ tone, children }: { tone: Tone; children: ReactNode }) => <span className={`pill ${tone}`}>{children}</span>;

export const LevelPill = ({ verified }: { verified: boolean }) => (verified ? <Pill tone="good">Verified</Pill> : <Pill tone="warn">Starter</Pill>);

export function Notice({ tone, icon, children, action }: { tone: "info" | "warn" | "bad" | "good"; icon: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className={`notice ${tone}`}>
      <span className="ico" aria-hidden="true">{icon}</span>
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}

export function PageHead({ label, title, sub, side }: { label?: string; title: string; sub?: string; side?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        {label && <div className="label">{label}</div>}
        <h1>{title}</h1>
        {sub && <p className="muted mt-1.5 max-w-[62ch]">{sub}</p>}
      </div>
      {side}
    </div>
  );
}

/**
 * Shown while a screen waits for its data. If a request on the screen has failed (after React Query's retries),
 * it says so and offers Try again, instead of "Loading…" for ever.
 */
export function Spinner({ label = "Loading" }: { label?: string }) {
  const qc = useQueryClient();
  const cache = qc.getQueryCache();
  const failed = useSyncExternalStore(
    (onChange) => cache.subscribe(onChange),
    () => cache.findAll({ type: "active" }).some((q) => q.state.status === "error" && q.state.fetchStatus === "idle"),
  );
  if (failed) {
    return (
      <div role="alert" className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
        <p className="small">Couldn't load this. Check your connection, then try again.</p>
        <Button type="button" size="sm" variant="outline" onClick={() => void qc.refetchQueries({ type: "active" })}>Try again</Button>
      </div>
    );
  }
  return <div role="status" className="muted flex min-h-[40vh] items-center justify-center small">{label}…</div>;
}

const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const show = useCallback((m: string) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div aria-live="polite">{msg && <div className="toast">{msg}</div>}</div>
    </ToastCtx.Provider>
  );
}

/** The ProofPocket mark from v2/index.html. Accepts className to override the container style. */
export const BrandMark = ({ className }: { className?: string }) => (
  <span className={cn("grid h-[30px] w-[30px] place-items-center rounded-lg bg-accent", className)} aria-hidden="true">
    <svg width="18" height="18" viewBox="0 0 18 18"><path d="M2 14 L7 9 L10 12 L16 4" fill="none" stroke="var(--accent-ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="16" cy="4" r="1.8" fill="var(--accent-ink)" /></svg>
  </span>
);
