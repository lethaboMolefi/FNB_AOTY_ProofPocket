// Offline bookkeeping (brief §5): book entries, stock changes and cash payouts are saved on the phone first,
// then sent when there's a connection. Each item has a client UUID so the API stores it once, even if sent twice.
import { openDB, type IDBPDatabase } from "idb";
import { ApiError, api } from "./api";

export interface OutboxItem {
  id: string; // the clientUuid
  owner: string; // email of the signed-in founder who saved it; never sent as anyone else
  path: string;
  body: Record<string, unknown>;
  label: string; // what the founder sees, e.g. "Money in R450 · Lash lift"
  kind: "entry" | "stock" | "cash";
  createdAt: number;
  error?: string;
  errorCode?: string;
}

let dbp: Promise<IDBPDatabase> | null = null;
const db = () => (dbp ??= openDB("proofpocket", 1, { upgrade(d) { d.createObjectStore("outbox", { keyPath: "id" }); } }));

const events = new EventTarget();
const changed = () => events.dispatchEvent(new Event("change"));
export const onOutboxChange = (fn: () => void) => { events.addEventListener("change", fn); return () => events.removeEventListener("change", fn); };

let onSent: () => void = () => {};
/** Called after items reach the server (the app refreshes its screens). */
export const setOnSent = (fn: () => void) => { onSent = fn; };

let currentOwner: string | null = null;
export const setOutboxOwner = (email: string | null) => { currentOwner = email; };

export async function list(owner = currentOwner): Promise<OutboxItem[]> {
  try { return ((await (await db()).getAll("outbox")) as OutboxItem[]).filter((i) => i.owner === owner).sort((a, b) => a.createdAt - b.createdAt); }
  catch { return []; }
}

export async function remove(id: string) { await (await db()).delete("outbox", id); changed(); }

async function put(item: OutboxItem) { await (await db()).put("outbox", item); changed(); }

/** Asks the service worker to wake the app to sync when the connection returns (where the browser supports it). */
async function requestSync() {
  try {
    const reg = await navigator.serviceWorker?.ready;
    await (reg as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } })?.sync?.register("pp-outbox");
  } catch { /* not supported: we also sync on reconnect and on next open */ }
}

/** Saves the item on the phone and tries to send it. Returns "sent" or "saved" (offline, will sync). */
export async function enqueue(item: Omit<OutboxItem, "createdAt" | "owner">): Promise<{ state: "sent" | "saved" | "failed"; error?: ApiError }> {
  if (!currentOwner) throw new Error("not signed in");
  await put({ ...item, owner: currentOwner, createdAt: Date.now() });
  await flush();
  const left = (await list()).find((i) => i.id === item.id);
  if (!left) return { state: "sent" };
  if (left.error) return { state: "failed", error: new ApiError(400, left.errorCode ?? "failed", left.error) };
  // Still waiting: offline. It syncs when the connection is back.
  void requestSync();
  return { state: "saved" };
}

let flushing: Promise<{ sent: number; offline: boolean }> | null = null;

/** Sends waiting items in order. Stops at the first network failure; keeps items the server refused, with the reason. */
export function flush(): Promise<{ sent: number; offline: boolean }> {
  return (flushing ??= (async () => {
    let sent = 0, offline = false;
    try {
      for (const item of await list()) {
        if (item.error) continue;
        try {
          await api(item.path, { body: item.body });
          await remove(item.id);
          sent++;
        } catch (e) {
          if (e instanceof ApiError && e.status === 0) { offline = true; break; }
          if (e instanceof ApiError && e.status === 401) break;
          await put({ ...item, error: e instanceof ApiError ? e.message : "Couldn't save this. Try again.", errorCode: e instanceof ApiError ? e.code : "failed" });
        }
      }
    } finally { flushing = null; }
    if (sent) onSent();
    return { sent, offline };
  })());
}

/** Retry an item the server refused, e.g. after confirming a possible duplicate. */
export async function retry(id: string, patch: Record<string, unknown> = {}) {
  const item = (await list()).find((i) => i.id === id);
  if (!item) return;
  await put({ ...item, body: { ...item.body, ...patch }, error: undefined, errorCode: undefined });
  await flush();
}

/** Sync when the connection comes back, when the app is opened again, and when the service worker asks. */
export function startOutbox() {
  const go = () => { if (navigator.onLine) void flush(); };
  window.addEventListener("online", go);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") go(); });
  navigator.serviceWorker?.addEventListener("message", (e) => { if ((e.data as { type?: string })?.type === "FLUSH_OUTBOX") go(); });
  setInterval(go, 30_000);
  go();
}
