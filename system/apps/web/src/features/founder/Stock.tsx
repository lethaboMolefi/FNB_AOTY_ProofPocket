// Stock (v2/app.js vStock). Use 1 and Restock work offline through the outbox.
import { R, restockQuantity } from "@proofpocket/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Stat } from "../../components/charts";
import { Pill, Spinner, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { enqueue } from "../../lib/outbox";
import { useOutbox } from "../../lib/use-outbox";
import { FounderHead } from "./FounderHead";

interface Item { id: string; name: string; unit: string; qty: number; reorderAt: number; cost: number; low: boolean }
interface StockData { on: boolean; typeLabel: string; items: Item[]; value: number; low: number }
const SUB = "Know what you have before a client asks. Sales and purchases in Bookkeeping can update these numbers too.";

export default function Stock() {
  const qc = useQueryClient();
  const toast = useToast();
  const waiting = useOutbox("stock");
  const q = useQuery({ queryKey: ["founder", "stock"], queryFn: () => api<StockData>("/founder/stock") });
  const [n, setN] = useState({ name: "", unit: "", qty: "", reorderAt: "", cost: "" });
  if (!q.data) return <><FounderHead title="Stock" sub={SUB} /><Spinner /></>;
  const d = q.data;
  if (!d.on) return <><FounderHead title="Stock" /><p className="muted">Stock tracking is off for {d.typeLabel} businesses.</p></>;

  // Show changes saved on this phone straight away.
  const pendingDelta = (it: Item) => waiting.filter((w) => w.path.includes(it.id)).reduce((a, w) => a + (w.path.endsWith("/use") ? -1 : restockQuantity(it.qty, it.reorderAt)), 0);
  const act = async (it: Item, kind: "use" | "restock") => {
    const id = crypto.randomUUID();
    const r = await enqueue({ id, path: `/founder/stock/${it.id}/${kind}`, body: { clientUuid: id }, kind: "stock", label: `${kind === "use" ? "Used 1" : "Restocked"} ${it.name}` });
    if (r.state === "failed") { toast(r.error?.message ?? "Try again."); return; }
    const left = kind === "use" ? Math.max(0, it.qty - 1) : it.qty + restockQuantity(it.qty, it.reorderAt);
    toast(r.state === "saved" ? "Saved on this phone, will sync"
      : kind === "use" ? `${it.name}: ${left} ${it.unit} left` : `Restocked ${it.name}; ${R(restockQuantity(it.qty, it.reorderAt) * it.cost)} added to your books`);
    void qc.invalidateQueries({ queryKey: ["founder"] });
  };
  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!n.name.trim()) { toast("Name the item"); return; }
    try {
      await api("/founder/stock", { body: { name: n.name, unit: n.unit || "units", qty: Number(n.qty) || 0, reorderAt: Number(n.reorderAt) || 0, cost: Number(n.cost) || 0 } });
      toast("Item added"); setN({ name: "", unit: "", qty: "", reorderAt: "", cost: "" });
      void qc.invalidateQueries({ queryKey: ["founder"] });
    } catch (x) { toast(x instanceof ApiError ? x.message : "Try again."); }
  };
  const archive = async (it: Item) => {
    if (!window.confirm(`Remove ${it.name} from your stock list?`)) return;
    await api(`/founder/stock/${it.id}`, { method: "DELETE" });
    void qc.invalidateQueries({ queryKey: ["founder"] });
  };

  return (
    <>
      <FounderHead title="Stock" sub={SUB} />
      <div className="grid-3">
        <Stat label="Items" value={d.items.length} />
        <Stat label="Stock value (at cost)" value={R(d.value)} />
        <Stat label="Running low" value={d.low} tone={d.low ? "bad" : undefined} />
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Item</th><th className="r">In stock</th><th className="r">Reorder at</th><th className="r">Cost each</th><th>Status</th><th>Update</th></tr></thead>
          <tbody>
            {d.items.map((it) => {
              const qty = Math.max(0, it.qty + pendingDelta(it));
              return (
                <tr key={it.id}>
                  <td><b>{it.name}</b>{pendingDelta(it) !== 0 && <div><Pill tone="warn">Waiting to sync</Pill></div>}</td>
                  <td className="r num">{qty} {it.unit}</td><td className="r num">{it.reorderAt}</td><td className="r num">{R(it.cost)}</td>
                  <td>{qty <= it.reorderAt ? <Pill tone="bad">Reorder</Pill> : <Pill tone="good">OK</Pill>}</td>
                  <td><div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                    <button className="btn sm" aria-label={`Use one ${it.name}`} onClick={() => void act(it, "use")}>Use 1</button>
                    <button className="btn sm" onClick={() => void act(it, "restock")}>Restock</button>
                    <button className="btn sm ghost" aria-label={`Remove ${it.name}`} onClick={() => void archive(it)}>×</button>
                  </div></td>
                </tr>
              );
            })}
            {!d.items.length && <tr><td colSpan={6} className="muted">No items yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <form className="panel stack" onSubmit={add} noValidate>
        <h2>Add an item</h2>
        <div className="form-grid">
          <label className="field"><span>Item</span><input type="text" placeholder="e.g. Lash glue" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} /></label>
          <label className="field"><span>Unit</span><input type="text" placeholder="e.g. tubes" value={n.unit} onChange={(e) => setN({ ...n, unit: e.target.value })} /></label>
          <label className="field"><span>In stock</span><input type="number" min={0} step="0.1" value={n.qty} onChange={(e) => setN({ ...n, qty: e.target.value })} /></label>
          <label className="field"><span>Reorder at</span><input type="number" min={0} step="0.1" value={n.reorderAt} onChange={(e) => setN({ ...n, reorderAt: e.target.value })} /></label>
          <label className="field"><span>Cost each (R)</span><input type="number" min={0} value={n.cost} onChange={(e) => setN({ ...n, cost: e.target.value })} /></label>
        </div>
        <div className="row between"><span className="hint">Restock records the cost as an expense in your books.</span><button className="btn primary" type="submit">Add item</button></div>
      </form>
    </>
  );
}
