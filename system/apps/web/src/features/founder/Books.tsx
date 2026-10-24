// Bookkeeping (v2/app.js vBooks) — rebuilt with shadcn.
// Statement import, entry form (offline-capable), entries table, earlier months.
import {
  IN_CATS, OUT_CATS, PAY_METHODS, PAY_METHOD_KEYS, R,
  addMonths, duplicateWarning, findDuplicate, monthLabel, monthOf, shortDate, todayZA,
  type PayMethod,
} from "@proofpocket/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import {
  AlertCircle, ArrowDown, ArrowUp, BookOpen, ChevronLeft, ChevronRight,
  Info, Loader2, Upload, WifiOff, RotateCcw, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { FilePick } from "../../components/FilePick";
import { BarChart, type Point } from "../../components/charts";
import { Spinner, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { useOnline } from "../../lib/pwa";
import { enqueue, remove as removeItem, retry } from "../../lib/outbox";
import { useOutbox } from "../../lib/use-outbox";
import { FounderHead } from "./FounderHead";

export interface Entry {
  id: string; clientUuid: string; date: string; direction: "in" | "out"; amount: number;
  method: PayMethod; category: string; note: string; isPersonal: boolean; paidBack: boolean;
  receipt: boolean; source: string; slipNumber: string | null; voided: boolean; voidReason: string | null;
}
interface StockOpt { id: string; name: string; unit: string; qty: number }
interface Line {
  id: string; date: string; description: string; amount: number; direction: "in" | "out";
  status: "unsorted" | "already_in_books"; matched: { note: string; date: string } | null;
}
interface BooksData {
  month: string; entries: Entry[]; totals: { moneyIn: number; moneyOut: number };
  lastEntryDays: number | null; statementLines: Line[]; stock: StockOpt[];
  stockOn: boolean; history: { month: string; moneyIn: number; moneyOut: number }[];
}

const SUB = "Record every sale and expense here, including cash. ProofPocket keeps the records funders ask for.";
const sign = (d: "in" | "out") => (d === "in" ? "+" : "−");

// ─── Statement import ────────────────────────────────────────────────────────
function Statement({ lines, onChange }: { lines: Line[]; onChange: () => void }) {
  const toast = useToast();
  const [err, setErr] = useState("");
  const [mapping, setMapping] = useState<{ fileId: string; preview: string[][]; columnCount: number } | null>(null);
  const [cols, setCols] = useState({ date: 0, description: 1, amount: 2, moneyIn: -1, moneyOut: -1 });
  const [cats, setCats] = useState<Record<string, string>>({});

  const importFile = async (fileId: string, map?: object) => {
    setErr("");
    try {
      const r = await api<
        | { ok: true; added: number; alreadyInBooks: number; repeated: number }
        | { ok: false; needsMapping: true; preview: string[][]; columnCount: number }
      >("/founder/statements", { body: { fileId, ...(map ? { mapping: map } : {}) } });
      if (!r.ok) {
        setMapping({ fileId, preview: r.preview, columnCount: r.columnCount });
        return;
      }
      setMapping(null);
      toast(`${r.added} new ${r.added === 1 ? "line" : "lines"} to sort${r.alreadyInBooks ? `, ${r.alreadyInBooks} already in your books` : ""}${r.repeated ? `, ${r.repeated} imported before` : ""}.`);
      onChange();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Try again.");
    }
  };

  const act = async (l: Line, action: "add" | "personal" | "skip") => {
    try {
      const r = await api<{ message: string }>(`/founder/statement-lines/${l.id}`, {
        body: { action, category: cats[l.id] ?? (l.direction === "in" ? IN_CATS[0] : OUT_CATS[0]) },
      });
      toast(r.message);
      onChange();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Try again.");
    }
  };

  const colOpts = (optional: boolean) =>
    <>
      {optional && <SelectItem value="-1">Not in this file</SelectItem>}
      {Array.from({ length: mapping?.columnCount ?? 0 }, (_, i) => (
        <SelectItem key={i} value={String(i)}>Column {i + 1}</SelectItem>
      ))}
    </>;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">From your bank statement</CardTitle>
            <CardDescription className="mt-1">
              Download the CSV from your banking app and import it here. ProofPocket never connects to your bank.
            </CardDescription>
          </div>
          <FilePick label="Import CSV" purpose="statement" accept=".csv,text/csv"
            onUploaded={(f) => importFile(f.fileId)} onError={setErr} />
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {err && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{err}
          </div>
        )}
        {mapping && (
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <p className="text-sm font-medium">Which columns are which?</p>
            <div className="overflow-x-auto rounded border border-border">
              <table className="text-xs w-full">
                <tbody>
                  {mapping.preview.map((row, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      {row.map((cell, j) => (
                        <td key={j} className="px-2 py-1 text-muted-foreground">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(["date", "description", "amount", "moneyIn", "moneyOut"] as const).map((k) => {
                const labels: Record<typeof k, string> = {
                  date: "Date", description: "Description",
                  amount: "Amount (− for out)", moneyIn: "Money in", moneyOut: "Money out",
                };
                const optional = k === "amount" || k === "moneyIn" || k === "moneyOut";
                return (
                  <div key={k}>
                    <Label className="text-xs">{labels[k]}</Label>
                    <Select value={String(cols[k])} onValueChange={(v) => setCols({ ...cols, [k]: Number(v) })}>
                      <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{colOpts(optional)}</SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
            <Button size="sm" onClick={() => importFile(mapping.fileId, {
              date: cols.date, description: cols.description,
              ...(cols.amount >= 0 ? { amount: cols.amount } : { moneyIn: cols.moneyIn, moneyOut: cols.moneyOut }),
            })}>
              <Upload className="h-3.5 w-3.5" />
              Import with these columns
            </Button>
          </div>
        )}
        {lines.length > 0 ? (
          <div className="divide-y divide-border">
            {lines.map((l) => (
              <div key={l.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-mono truncate">{l.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{shortDate(l.date)}</p>
                  {l.status === "already_in_books" && l.matched && (
                    <p className="text-xs text-warn mt-0.5">
                      Already in your books: "{l.matched.note}" on {shortDate(l.matched.date)}. Adding again would count it twice.
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`tabular-nums text-sm font-semibold ${l.direction === "in" ? "text-good" : ""}`}>
                    {sign(l.direction)}{R(l.amount)}
                  </span>
                  <Select
                    value={cats[l.id] ?? (l.direction === "in" ? IN_CATS[0] : OUT_CATS[0])}
                    onValueChange={(v) => setCats({ ...cats, [l.id]: v })}
                  >
                    <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(l.direction === "in" ? IN_CATS : OUT_CATS).map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={() => void act(l, "add")}>
                    {l.status === "already_in_books" ? "Add anyway" : "Add"}
                  </Button>
                  {l.direction === "out" && l.status === "unsorted" && (
                    <Button size="sm" variant="outline" onClick={() => void act(l, "personal")}>Personal</Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => void act(l, "skip")}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No statement lines waiting to sort.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Add an entry ────────────────────────────────────────────────────────────
function EntryForm({ data }: { data: BooksData }) {
  const toast = useToast();
  const qc = useQueryClient();
  const online = useOnline();
  const [dir, setDir] = useState<"in" | "out">("in");
  const blank = () => ({
    amount: "", method: "cash" as PayMethod, category: "",
    date: todayZA(), note: "", stockItemId: "", qty: "1", isPersonal: false,
  });
  const [f, setF] = useState(blank);
  const [warn, setWarn] = useState("");
  const [receipt, setReceipt] = useState<{ fileId: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const cats = dir === "in" ? IN_CATS : OUT_CATS;
  const category = cats.includes(f.category as never) ? f.category : cats[0]!;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const amount = Number(f.amount);
    if (!amount || amount <= 0) { setWarn("Enter an amount greater than zero."); return; }
    const confirmed = warn.startsWith("Possible duplicate");
    if (!confirmed) {
      const dup = findDuplicate(data.entries.filter((x) => !x.voided), { direction: dir, amount, date: f.date });
      if (dup) { setWarn(duplicateWarning(amount, dup)); return; }
    }
    setBusy(true);
    const clientUuid = crypto.randomUUID();
    const body = {
      clientUuid, direction: dir, amount, method: f.method, category, date: f.date,
      note: f.note.trim(), isPersonal: dir === "out" && f.isPersonal,
      stockItemId: f.stockItemId || null,
      qty: f.stockItemId ? Number(f.qty) || null : null,
      receiptFileId: receipt?.fileId ?? null, confirmDuplicate: confirmed,
    };
    const r = await enqueue({
      id: clientUuid, path: "/founder/entries", body, kind: "entry",
      label: `${dir === "in" ? "Money in" : "Money out"} ${R(amount)}${f.note ? ` · ${f.note}` : ""}`,
    });
    setBusy(false);
    if (r.state === "failed" && r.error?.code === "possible_duplicate") {
      await removeItem(clientUuid);
      setWarn(r.error.message);
      return;
    }
    if (r.state === "failed") {
      await removeItem(clientUuid);
      setWarn(r.error?.message ?? "Couldn't save. Try again.");
      return;
    }
    setWarn(""); setF({ ...blank(), method: f.method }); setReceipt(null);
    toast(r.state === "sent" ? "Saved to your books" : "Saved on this phone, will sync");
    void qc.invalidateQueries({ queryKey: ["founder"] });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Add an entry</CardTitle>
          {/* Money in / out toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden text-sm">
            <button
              type="button"
              className={`px-4 py-1.5 font-medium transition-colors ${dir === "in" ? "bg-good text-white" : "hover:bg-muted/50 text-muted-foreground"}`}
              onClick={() => { setDir("in"); setWarn(""); }}
            >
              <ArrowDown className="inline h-3.5 w-3.5 mr-1" />Money in
            </button>
            <button
              type="button"
              className={`px-4 py-1.5 font-medium transition-colors border-l border-border ${dir === "out" ? "bg-destructive text-white" : "hover:bg-muted/50 text-muted-foreground"}`}
              onClick={() => { setDir("out"); setWarn(""); }}
            >
              <ArrowUp className="inline h-3.5 w-3.5 mr-1" />Money out
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} noValidate>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <div>
              <Label htmlFor="e-amount">Amount (R)</Label>
              <Input id="e-amount" type="number" min={1} step="0.01" inputMode="decimal" placeholder="0"
                value={f.amount} onChange={(e) => { setF({ ...f, amount: e.target.value }); setWarn(""); }}
                className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="e-method">Paid by</Label>
              <Select value={f.method} onValueChange={(v) => setF({ ...f, method: v as PayMethod })}>
                <SelectTrigger id="e-method" className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAY_METHOD_KEYS.map((m) => <SelectItem key={m} value={m}>{PAY_METHODS[m]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="e-cat">Category</Label>
              <Select value={category} onValueChange={(v) => setF({ ...f, category: v })}>
                <SelectTrigger id="e-cat" className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {cats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="e-date">Date</Label>
              <Input id="e-date" type="date" value={f.date} max={todayZA()}
                onChange={(e) => { setF({ ...f, date: e.target.value }); setWarn(""); }}
                className="mt-1.5" />
            </div>
            <div className="col-span-2 sm:col-span-3 lg:col-span-4">
              <Label htmlFor="e-note">What was it for?</Label>
              <Input id="e-note" type="text" maxLength={200}
                placeholder={dir === "in" ? "e.g. Lash lift, client paid cash" : "e.g. Gel polish restock"}
                value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })}
                className="mt-1.5" />
            </div>
            {data.stockOn && data.stock.length > 0 && (
              <>
                <div className="sm:col-span-2">
                  <Label htmlFor="e-stock">{dir === "in" ? "Stock used (optional)" : "Stock bought (optional)"}</Label>
                  <Select value={f.stockItemId || "none"} onValueChange={(v) => setF({ ...f, stockItemId: v === "none" ? "" : v })}>
                    <SelectTrigger id="e-stock" className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {data.stock.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name} ({s.qty} {s.unit})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="e-qty">Quantity</Label>
                  <Input id="e-qty" type="number" min={0} step="0.1" value={f.qty}
                    onChange={(e) => setF({ ...f, qty: e.target.value })} className="mt-1.5" />
                </div>
              </>
            )}
          </div>

          {warn && (
            <div className="flex items-start gap-2 rounded-lg border border-warn/30 bg-warn-soft p-3 text-sm text-warn mt-3" role="alert">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{warn}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
            <div className="flex items-center gap-3">
              {dir === "out" && (
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" className="rounded border-border" checked={f.isPersonal}
                    onChange={(e) => setF({ ...f, isPersonal: e.target.checked })} />
                  Personal purchase
                </label>
              )}
              {online ? (
                receipt ? (
                  <span className="text-sm text-muted-foreground">
                    {receipt.name}
                    <button type="button" className="ml-2 text-xs text-destructive hover:underline"
                      onClick={() => setReceipt(null)}>Remove</button>
                  </span>
                ) : (
                  <FilePick label="Add receipt" purpose="receipt" accept="image/*,.pdf"
                    onUploaded={(r) => setReceipt({ fileId: r.fileId, name: r.name })} onError={setWarn} />
                )
              ) : (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <WifiOff className="h-3.5 w-3.5" />Receipt photos need a connection.
                </span>
              )}
            </div>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {warn.startsWith("Possible duplicate") ? "Save again" : "Save entry"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Entries table ───────────────────────────────────────────────────────────
function Entries({ data, month, setMonth }: { data: BooksData; month: string; setMonth: (m: string) => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const waiting = useOutbox("entry");
  const refresh = () => qc.invalidateQueries({ queryKey: ["founder"] });
  const paidBack = useMutation({
    mutationFn: (id: string) => api<{ message: string }>(`/founder/entries/${id}/paid-back`, { body: {} }),
    onSuccess: (r) => { toast(r.message); void refresh(); },
  });
  const correct = async (e: Entry) => {
    const reason = window.prompt("Why is this entry wrong? It's removed from your totals but kept in your history.");
    if (!reason?.trim()) return;
    try {
      toast((await api<{ message: string }>(`/founder/entries/${e.id}/void`, { body: { reason } })).message);
      void refresh();
    } catch (x) {
      toast(x instanceof ApiError ? x.message : "Try again.");
    }
  };
  const current = month === monthOf(todayZA());
  const live = data.entries.filter((e) => !e.voided);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" className="h-8 w-8"
              aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="text-base">
              {current ? "This month" : `${monthLabel(month)} ${month.slice(0, 4)}`}
            </CardTitle>
            {!current && (
              <Button size="icon" variant="ghost" className="h-8 w-8"
                aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {live.length} {live.length === 1 ? "entry" : "entries"}
            {data.lastEntryDays !== null && ` · last ${data.lastEntryDays === 0 ? "today" : `${data.lastEntryDays}d ago`}`}
          </p>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Details</TableHead>
              <TableHead className="hidden sm:table-cell">Category</TableHead>
              <TableHead className="hidden md:table-cell">Paid by</TableHead>
              <TableHead className="hidden sm:table-cell">Receipt</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Pending offline items */}
            {current && waiting.map((w) => (
              <TableRow key={w.id} className="bg-warn-soft/30">
                <TableCell className="tabular-nums text-sm">{shortDate(String(w.body.date))}</TableCell>
                <TableCell>
                  <p className="text-sm">{w.label}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {w.error
                      ? <><AlertCircle className="h-3 w-3 text-destructive" /><span className="text-[11px] text-destructive">{w.error}</span></>
                      : <><WifiOff className="h-3 w-3 text-warn" /><span className="text-[11px] text-warn">Waiting to sync</span></>
                    }
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{String(w.body.category)}</TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{PAY_METHODS[w.body.method as PayMethod]}</TableCell>
                <TableCell className="hidden sm:table-cell" />
                <TableCell className={`text-right tabular-nums font-medium ${w.body.direction === "in" ? "text-good" : ""}`}>
                  {sign(w.body.direction as "in" | "out")}{R(Number(w.body.amount))}
                </TableCell>
                <TableCell className="text-right">
                  {w.error && (
                    <div className="flex items-center justify-end gap-1">
                      {w.errorCode === "possible_duplicate" && (
                        <Button size="sm" variant="outline" onClick={() => void retry(w.id, { confirmDuplicate: true })}>
                          <RotateCcw className="h-3 w-3" />Save anyway
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => void removeItem(w.id)}>
                        <X className="h-3 w-3" />Discard
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {/* Saved entries */}
            {data.entries.map((e) => (
              <TableRow key={e.id} className={e.voided ? "opacity-50" : ""}>
                <TableCell className="tabular-nums text-sm">{shortDate(e.date)}</TableCell>
                <TableCell>
                  {e.voided ? <s className="text-sm">{e.note || "—"}</s> : <span className="text-sm">{e.note || "—"}</span>}
                  {e.isPersonal && <Badge variant="warning" className="ml-1.5 text-[10px]">Personal</Badge>}
                  {e.voided && e.voidReason && <p className="text-[11px] text-muted-foreground mt-0.5">Removed: {e.voidReason}</p>}
                </TableCell>
                <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{e.category}</TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{PAY_METHODS[e.method]}</TableCell>
                <TableCell className="hidden sm:table-cell">
                  {e.receipt
                    ? <Badge variant="success" className="text-[10px]">Kept</Badge>
                    : <Badge variant="outline" className="text-[10px]">None</Badge>
                  }
                </TableCell>
                <TableCell className={`text-right tabular-nums font-semibold ${e.direction === "in" ? "text-good" : ""}`}>
                  {sign(e.direction)}{R(e.amount)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {e.isPersonal && !e.paidBack && (
                      <Button size="sm" variant="outline" onClick={() => paidBack.mutate(e.id)}>Paid back</Button>
                    )}
                    {!e.voided && e.source !== "proof" && (
                      <Button size="sm" variant="ghost" onClick={() => void correct(e)}>Correct</Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!data.entries.length && !(current && waiting.length) && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  <BookOpen className="h-7 w-7 mx-auto mb-2 opacity-30" />
                  No entries {current ? "this month yet" : "in this month"}.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─── Earlier months ──────────────────────────────────────────────────────────
function EarlierMonths({ history }: { history: BooksData["history"] }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [h, setH] = useState({ month: addMonths(monthOf(todayZA()), -1), moneyIn: "", moneyOut: "" });
  const save = useMutation({
    mutationFn: () => api<{ message: string }>("/founder/history", {
      method: "PUT", body: { month: h.month, moneyIn: Number(h.moneyIn) || 0, moneyOut: Number(h.moneyOut) || 0 },
    }),
    onSuccess: (r) => { toast(r.message); void qc.invalidateQueries({ queryKey: ["founder"] }); },
  });

  return (
    <Card>
      <button
        type="button"
        className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-muted/30 transition-colors rounded-lg"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="text-sm font-medium">Earlier months, before you used ProofPocket</span>
        <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <CardContent className="pt-0 space-y-4">
          <p className="text-sm text-muted-foreground">
            Add each month's totals from your notebook or old statements. Funders see these marked as your own figures, not checked books.
          </p>
          <form noValidate onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="col-span-2 sm:col-span-1">
                <Label htmlFor="em-month">Month</Label>
                <Input id="em-month" type="month" max={addMonths(monthOf(todayZA()), -1)}
                  value={h.month} onChange={(e) => setH({ ...h, month: e.target.value })} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="em-in">Money in (R)</Label>
                <Input id="em-in" type="number" min={0} placeholder="0" value={h.moneyIn}
                  onChange={(e) => setH({ ...h, moneyIn: e.target.value })} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="em-out">Money out (R)</Label>
                <Input id="em-out" type="number" min={0} placeholder="0" value={h.moneyOut}
                  onChange={(e) => setH({ ...h, moneyOut: e.target.value })} className="mt-1.5" />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={save.isPending} className="mt-1.5 w-full">
                  {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save month
                </Button>
              </div>
            </div>
            {save.error && (
              <p className="text-sm text-destructive mt-2">{(save.error as ApiError).message}</p>
            )}
          </form>
          {history.length > 0 && (
            <div className="divide-y divide-border">
              {history.map((m) => (
                <div key={m.month} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-muted-foreground">{monthLabel(m.month)} {m.month.slice(0, 4)}</span>
                  <span className="tabular-nums">
                    <span className="text-good">+{R(m.moneyIn)}</span>
                    <span className="text-muted-foreground mx-1">·</span>
                    <span>−{R(m.moneyOut)}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function Books() {
  const qc = useQueryClient();
  const [month, setMonth] = useState(monthOf(todayZA()));
  const q = useQuery({
    queryKey: ["founder", "books", month],
    queryFn: () => api<BooksData>(`/founder/books?month=${month}`),
  });

  if (!q.data) {
    return (
      <>
        <FounderHead title="Bookkeeping" sub={SUB} />
        {q.isError
          ? <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />Couldn't load your books. Check your connection.
            </div>
          : <Spinner />
        }
      </>
    );
  }

  const d = q.data;
  const profit = d.totals.moneyIn - d.totals.moneyOut;
  const refresh = () => qc.invalidateQueries({ queryKey: ["founder"] });

  return (
    <>
      <FounderHead title="Bookkeeping" sub={SUB} />

      <Statement lines={d.statementLines} onChange={refresh} />
      <EntryForm data={d} />

      {/* Month summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Money in</p>
            <p className="text-2xl font-bold tabular-nums text-good mt-1">{R(d.totals.moneyIn)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Money out</p>
            <p className="text-2xl font-bold tabular-nums mt-1">{R(d.totals.moneyOut)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Profit</p>
            <p className={`text-2xl font-bold tabular-nums mt-1 ${profit < 0 ? "text-destructive" : ""}`}>{R(profit)}</p>
          </CardContent>
        </Card>
      </div>

      <Entries data={d} month={month} setMonth={setMonth} />

      {/* Funder advice */}
      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        <Info className="h-4 w-4 mt-0.5 shrink-0 text-foreground/60" />
        <p>
          Funders check that personal spending stays out of the business and that owners pay themselves a set salary.
          Record your pay under <strong className="text-foreground">Owner salary</strong>, and mark personal purchases
          so you can pay them back.
        </p>
      </div>

      <EarlierMonths history={d.history} />
    </>
  );
}
