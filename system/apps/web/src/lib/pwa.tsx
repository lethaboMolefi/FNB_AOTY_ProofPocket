import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

/** "A new version is ready. Refresh" when the service worker updates. */
export function UpdatePrompt() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div role="status" className="fixed inset-x-4 top-[calc(env(safe-area-inset-top,0px)+12px)] z-[70] mx-auto flex max-w-md items-center gap-3 rounded-card border border-line bg-surface p-3 shadow-[0_8px_24px_rgba(24,28,39,.08)]">
      <span className="flex-1 small font-semibold">A new version is ready.</span>
      <button className="btn sm" onClick={() => setNeedRefresh(false)}>Later</button>
      <button className="btn sm primary" onClick={() => void updateServiceWorker(true)}>Refresh</button>
    </div>
  );
}

export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return online;
}

const VISITS = "pp.visits", DISMISSED = "pp.installDismissed";
const safe = <T,>(fn: () => T, fallback: T) => { try { return fn(); } catch { return fallback; } };

interface InstallPromptEvent extends Event { prompt(): Promise<void> }

/** "Add to home screen" hint from a founder's second visit, until installed or dismissed. */
export function InstallHint() {
  const [visits] = useState(() => {
    // Count once per browser session.
    const counted = safe(() => sessionStorage.getItem(VISITS), null);
    const n = Number(safe(() => localStorage.getItem(VISITS), "0")) + (counted ? 0 : 1);
    safe(() => { localStorage.setItem(VISITS, String(n)); sessionStorage.setItem(VISITS, "1"); }, undefined);
    return n;
  });
  const [dismissed, setDismissed] = useState(() => safe(() => localStorage.getItem(DISMISSED) === "1", false));
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as InstallPromptEvent); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (standalone || dismissed || visits < 2 || (!prompt && !ios)) return null;

  const dismiss = () => { setDismissed(true); safe(() => localStorage.setItem(DISMISSED, "1"), undefined); };
  return (
    <div className="notice info">
      <span className="ico" aria-hidden="true">+</span>
      <div className="flex-1 small">
        <b>Add ProofPocket to your home screen.</b>{" "}
        {prompt ? "It opens like an app and works when your data runs out." : "Tap the Share button, then Add to Home Screen."}
      </div>
      {prompt && <button className="btn sm primary" onClick={() => { void prompt.prompt(); setPrompt(null); }}>Add</button>}
      <button className="btn sm" onClick={dismiss} aria-label="Dismiss">Not now</button>
    </div>
  );
}
