// Stock (v2/app.js vStock) — rebuilt with shadcn. Use 1 and Restock work offline via outbox.
import { R, Rc, restockQuantity } from "@proofpocket/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { AlertCircle, Package, RefreshCw, Minus, Plus, Trash2, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Spinner, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { enqueue } from "../../lib/outbox";
import { useOutbox } from "../../lib/use-outbox";
import { FounderHead } from "./FounderHead";

interface Item {
  id: string; name: string; unit: string; qty: number;
  reorderAt: number; cost: number; price: number; low: boolean;
}
interface StockData { on: boolean; typeLabel: string; items: Item[]; value: number; low: number }

const SUB = "Know what you have before a client asks. Sales and purchases in Bookkeeping update these numbers too.";

export default function Stock() {
  const qc = useQueryClient();
  const toast = useToast();
  const waiting = useOutbox("stock");
  const q = useQuery({ queryKey: ["founder", "stock"], queryFn: () => api<StockData>("/founder/stock") });
  const [n, setN] = useState({ name: "", unit: "", qty: "", reorderAt: "", cost: "", price: "" });
  const [addErr, setAddErr] = useState("");

  if (!q.data) return <><FounderHead title="Stock" sub={SUB} /><Spinner /></>;
  const d = q.data;

  if (!d.on) {
    return (
      <>
        <FounderHead title="Stock" />
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Stock tracking is off for {d.typeLabel} businesses.</p>
          </CardContent>
        </Card>
      </>
    );
  }

  const pendingDelta = (it: Item) =>
    waiting
      .filter((w) => w.path.includes(it.id))
      .reduce((a, w) => a + (w.path.endsWith("/use") ? -1 : restockQuantity(it.qty, it.reorderAt)), 0);

  const act = async (it: Item, kind: "use" | "restock") => {
    const id = crypto.randomUUID();
    const r = await enqueue({
      id, path: `/founder/stock/${it.id}/${kind}`,
      body: { clientUuid: id }, kind: "stock",
      label: `${kind === "use" ? "Used 1" : "Restocked"} ${it.name}`,
    });
    if (r.state === "failed") { toast(r.error?.message ?? "Try again."); return; }
    const left = kind === "use"
      ? Math.max(0, it.qty - 1)
      : it.qty + restockQuantity(it.qty, it.reorderAt);
    toast(
      r.state === "saved" ? "Saved on this phone, will sync"
        : kind === "use" ? `${it.name}: ${left} ${it.unit} left`
        : `Restocked ${it.name} — ${R(restockQuantity(it.qty, it.reorderAt) * it.cost)} added to your books`,
    );
    void qc.invalidateQueries({ queryKey: ["founder"] });
  };

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setAddErr("");
    if (!n.name.trim()) { setAddErr("Give the item a name."); return; }
    try {
      await api("/founder/stock", {
        body: {
          name: n.name.trim(), unit: n.unit.trim() || "units",
          qty: Number(n.qty) || 0,
          reorderAt: Number(n.reorderAt) || 0,
          cost: Number(n.cost) || 0,
          price: Number(n.price) || 0,
        },
      });
      toast("Item added");
      setN({ name: "", unit: "", qty: "", reorderAt: "", cost: "", price: "" });
      void qc.invalidateQueries({ queryKey: ["founder"] });
    } catch (x) {
      setAddErr(x instanceof ApiError ? x.message : "Try again.");
    }
  };

  /** The selling price: what a client pays for one (used on "Ask a client to pay"). */
  const setPrice = async (it: Item) => {
    const raw = window.prompt(`Selling price for one ${it.name} (R)`, it.price ? String(it.price) : "");
    if (raw === null) return;
    const price = Math.round(Number(raw.replace(",", ".")) * 100) / 100;
    if (!(price >= 0)) { toast("Enter a price in rand, e.g. 45.50"); return; }
    try { await api(`/founder/stock/${it.id}`, { method: "PATCH", body: { price } }); toast(`${it.name}: ${Rc(price)} each`); void qc.invalidateQueries({ queryKey: ["founder"] }); }
    catch (x) { toast(x instanceof ApiError ? x.message : "Try again."); }
  };

  const archive = async (it: Item) => {
    if (!window.confirm(`Remove ${it.name} from your stock list?`)) return;
    await api(`/founder/stock/${it.id}`, { method: "DELETE" });
    void qc.invalidateQueries({ queryKey: ["founder"] });
  };

  return (
    <>
      <FounderHead title="Stock" sub={SUB} />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Items</p>
            <p className="text-2xl font-bold tabular-nums mt-1">{d.items.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Stock value</p>
            <p className="text-2xl font-bold tabular-nums mt-1">{R(d.value)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Running low</p>
            <p className={`text-2xl font-bold tabular-nums mt-1 ${d.low > 0 ? "text-destructive" : ""}`}>{d.low}</p>
          </CardContent>
        </Card>
      </div>

      {/* Stock table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">In stock</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Reorder at</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Cost each</TableHead>
                <TableHead className="text-right">Selling price</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead className="text-right">Update</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.items.map((it) => {
                const qty = Math.max(0, it.qty + pendingDelta(it));
                const syncing = pendingDelta(it) !== 0;
                return (
                  <TableRow key={it.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{it.name}</p>
                        {qty <= it.reorderAt && <Badge variant="destructive" className="mt-1 sm:hidden">Reorder</Badge>}
                        {syncing && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <WifiOff className="h-3 w-3 text-warn" />
                            <span className="text-[11px] text-warn">Waiting to sync</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {qty} <span className="text-muted-foreground font-normal">{it.unit}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                      {it.reorderAt}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                      {R(it.cost)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" className="tabular-nums" aria-label={`Selling price of ${it.name}`} onClick={() => void setPrice(it)}>
                        {it.price ? Rc(it.price) : "Set price"}
                      </Button>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {qty <= it.reorderAt
                        ? <Badge variant="destructive">Reorder</Badge>
                        : <Badge variant="success">OK</Badge>
                      }
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm" variant="outline"
                          aria-label={`Use one ${it.name}`}
                          onClick={() => void act(it, "use")}
                        >
                          <Minus className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Use 1</span>
                        </Button>
                        <Button
                          size="sm" variant="outline"
                          onClick={() => void act(it, "restock")}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Restock</span>
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          aria-label={`Remove ${it.name}`}
                          onClick={() => void archive(it)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!d.items.length && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    No items yet. Add your first item below.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add item form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Add an item</CardTitle>
          <CardDescription>Restock records the cost as an expense in your books. The selling price is used when you ask a client to pay for stock.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={add} noValidate>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <div className="col-span-2 sm:col-span-1 lg:col-span-1">
                <Label htmlFor="s-name">Item name</Label>
                <Input id="s-name" placeholder="e.g. Lash glue" value={n.name}
                  onChange={(e) => setN({ ...n, name: e.target.value })} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="s-unit">Unit</Label>
                <Input id="s-unit" placeholder="e.g. tubes" value={n.unit}
                  onChange={(e) => setN({ ...n, unit: e.target.value })} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="s-qty">In stock</Label>
                <Input id="s-qty" type="number" min={0} step="0.1" placeholder="0" value={n.qty}
                  onChange={(e) => setN({ ...n, qty: e.target.value })} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="s-reorder">Reorder at</Label>
                <Input id="s-reorder" type="number" min={0} step="0.1" placeholder="0" value={n.reorderAt}
                  onChange={(e) => setN({ ...n, reorderAt: e.target.value })} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="s-cost">Cost each (R)</Label>
                <Input id="s-cost" type="number" min={0} placeholder="0" value={n.cost}
                  onChange={(e) => setN({ ...n, cost: e.target.value })} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="s-price">Selling price (R)</Label>
                <Input id="s-price" type="number" min={0} step="0.01" placeholder="0" value={n.price}
                  onChange={(e) => setN({ ...n, price: e.target.value })} className="mt-1.5" />
              </div>
            </div>

            {addErr && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive mt-3" role="alert">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{addErr}
              </div>
            )}

            <div className="flex justify-end mt-4">
              <Button type="submit">
                <Plus className="h-4 w-4" />
                Add item
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
