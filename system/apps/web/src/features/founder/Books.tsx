// Bookkeeping (v2/app.js vBooks): statement lines to sort, add an entry (works offline), this month's entries.
import {
  IN_CATS, OUT_CATS, PAY_METHODS, PAY_METHOD_KEYS, R, addMonths, duplicateWarning, findDuplicate, monthLabel, monthOf, shortDate, todayZA, type PayMethod,
} from "@proofpocket/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Stat } from "../../components/charts";
import { FilePick } from "../../components/FilePick";
import { Notice, Pill, Spinner, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { useOnline } from "../../lib/pwa";
import { enqueue, remove as removeItem, retry } from "../../lib/outbox";
import { useOutbox } from "../../lib/use-outbox";
import { FounderHead } from "./FounderHead";

export interface Entry {
  id: string; clientUuid: string; date: string; direction: "in" | "out"; amount: number; method: PayMethod; category: string; note: string;
  isPersonal: boolean; paidBack: boolean; receipt: boolean; source: string; slipNumber: string | null; voided: boolean; voidReason: string | null;
}
interface StockOpt { id: string; name: string; unit: string; qty: number }
interface Line { id: string; date: string; description: string; amount: number; direction: "in" | "out"; status: "unsorted" | "already_in_books"; matched: { note: string; date: string } | null }
interface BooksData {
  month: string; entries: Entry[]; totals: { moneyIn: number; moneyOut: number }; lastEntryDays: number | null;
  statementLines: Line[]; stock: StockOpt[]; stockOn: boolean; history: { month: string; moneyIn: number; moneyOut: number }[];
}

const SUB = "Record every sale and expense here, including cash. ProofPocket works out your profit and keeps the records funders ask for.";
const sign = (d: "in" | "out") => (d === "in" ? "+" : "−");

// ---------------------------------------------------------------- statement import and lines
function Statement({ lines, onChange }: { lines: Line[]; onChange: () => void }) {
  const toast = useToast();
  const [err, setErr] = useState("");
  const [mapping, setMapping] = useState<{ fileId: string; preview: string[][]; columnCount: number } | null>(null);
  const [cols, setCols] = useState({ date: 0, description: 1, amount: 2, moneyIn: -1, moneyOut: -1 });
  const [cats, setCats] = useState<Record<string, string>>({});

  const importFile = async (fileId: string, map?: object) => {
    setErr("");
    try {
      const r = await api<{ ok: true; added: number; alreadyInBooks: number; repeated: number } | { ok: false; needsMapping: true; preview: string[][]; columnCount: number }>(
        "/founder/statements", { body: { fileId, ...(map ? { mapping: map } : {}) } });
      if (!r.ok) { setMapping({ fileId, preview: r.preview, columnCount: r.columnCount }); return; }
      setMapping(null);
      toast(`${r.added} new ${r.added === 1 ? "line" : "lines"} to sort${r.alreadyInBooks ? `, ${r.alreadyInBooks} already in your books` : ""}${r.repeated ? `, ${r.repeated} imported before` : ""}.`);
      onChange();
    } catch (e) { setErr(e instanceof ApiError ? e.message : "Try again."); }
  };
  const act = async (l: Line, action: "add" | "personal" | "skip") => {
    try {
      const r = await api<{ message: string }>(`/founder/statement-lines/${l.id}`, { body: { action, category: cats[l.id] ?? (l.direction === "in" ? IN_CATS[0] : OUT_CATS[0]) } });
      toast(r.message); onChange();
    } catch (e) { setErr(e instanceof ApiError ? e.message : "Try again."); }
  };
  const colSelect = (k: keyof typeof cols, label: string, optional = false) => (
    <label className="field"><span>{label}</span>
      <select value={cols[k]} onChange={(e) => setCols({ ...cols, [k]: Number(e.target.value) })}>
        {optional && <option value={-1}>Not in this file</option>}
        {Array.from({ length: mapping?.columnCount ?? 0 }, (_, i) => <option key={i} value={i}>Column {i + 1}</option>)}
      </select>
    </label>
  );

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>From your bank statement</h2>
        <FilePick label="Import a statement (CSV)" purpose="statement" accept=".csv,text/csv" onUploaded={(f) => importFile(f.fileId)} onError={setErr} />
      </div>
      <p className="hint mb-2">Download the CSV statement from your banking app and import it here. ProofPocket lists the lines so you can sort them into your books. It never connects to your bank.</p>
      {err && <p className="err" role="alert">{err}</p>}
      {mapping && (
        <div className="popbox stack mb-3">
          <b>Which columns are which?</b>
          <div className="table-wrap"><table><tbody>{mapping.preview.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="small">{c}</td>)}</tr>)}</tbody></table></div>
          <div className="form-grid">
            {colSelect("date", "Date")}{colSelect("description", "Description")}{colSelect("amount", "Amount (− for money out)", true)}
            {colSelect("moneyIn", "Money in", true)}{colSelect("moneyOut", "Money out", true)}
          </div>
          <button className="btn primary self-start" onClick={() => importFile(mapping.fileId, {
            date: cols.date, description: cols.description,
            ...(cols.amount >= 0 ? { amount: cols.amount } : { moneyIn: cols.moneyIn, moneyOut: cols.moneyOut }),
          })}>Import with these columns</button>
        </div>
      )}
      {lines.length ? lines.map((l) => (
        <div key={l.id} className="li">
          <div className="li-main">
            <span className="mono small">{l.description}</span>
            <span className="hint">{shortDate(l.date)}</span>
            {l.status === "already_in_books" && l.matched && <span className="small" style={{ color: "var(--warn)" }}>Already in your books: “{l.matched.note}” on {shortDate(l.matched.date)}. Adding it again would count it twice.</span>}
          </div>
          <div className="li-side">
            <span className={`num ${l.direction === "in" ? "in" : ""}`}>{sign(l.direction)}{R(l.amount)}</span>
            <div className="row" style={{ gap: 6 }}>
              <select aria-label="Category" value={cats[l.id] ?? (l.direction === "in" ? IN_CATS[0] : OUT_CATS[0])} onChange={(e) => setCats({ ...cats, [l.id]: e.target.value })} style={{ width: "auto" }}>
                {(l.direction === "in" ? IN_CATS : OUT_CATS).map((c) => <option key={c}>{c}</option>)}
              </select>
              <button className="btn sm primary" onClick={() => act(l, "add")}>{l.status === "already_in_books" ? "Add anyway" : "Add"}</button>
              {l.direction === "out" && l.status === "unsorted" && <button className="btn sm" onClick={() => act(l, "personal")}>Personal</button>}
              <button className="btn sm ghost" onClick={() => act(l, "skip")}>Skip</button>
            </div>
          </div>
        </div>
      )) : <p className="muted small">No statement lines waiting.</p>}
    </section>
  );
}

// ---------------------------------------------------------------- add an entry
function EntryForm({ data }: { data: BooksData }) {
  const toast = useToast();
  const qc = useQueryClient();
  const online = useOnline();
  const [dir, setDir] = useState<"in" | "out">("in");
  const blank = () => ({ amount: "", method: "cash" as PayMethod, category: "", date: todayZA(), note: "", stockItemId: "", qty: "1", isPersonal: false });
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
    // The same check runs on the server; doing it here too means it works offline.
    const confirmed = warn.startsWith("Possible duplicate");
    if (!confirmed) {
      const dup = findDuplicate(data.entries.filter((x) => !x.voided), { direction: dir, amount, date: f.date });
      if (dup) { setWarn(duplicateWarning(amount, dup)); return; }
    }
    setBusy(true);
    const clientUuid = crypto.randomUUID();
    const body = {
      clientUuid, direction: dir, amount, method: f.method, category, date: f.date, note: f.note.trim(), isPersonal: dir === "out" && f.isPersonal,
      stockItemId: f.stockItemId || null, qty: f.stockItemId ? Number(f.qty) || null : null, receiptFileId: receipt?.fileId ?? null, confirmDuplicate: confirmed,
    };
    const r = await enqueue({ id: clientUuid, path: "/founder/entries", body, kind: "entry", label: `${dir === "in" ? "Money in" : "Money out"} ${R(amount)}${f.note ? ` · ${f.note}` : ""}` });
    setBusy(false);
    if (r.state === "failed" && r.error?.code === "possible_duplicate") {
      await removeItem(clientUuid);
      setWarn(r.error.message);
      return;
    }
    if (r.state === "failed") { await removeItem(clientUuid); setWarn(r.error?.message ?? "Couldn't save. Try again."); return; }
    setWarn(""); setF({ ...blank(), method: f.method }); setReceipt(null);
    toast(r.state === "sent" ? "Saved to your books" : "Saved on this phone, will sync");
    void qc.invalidateQueries({ queryKey: ["founder"] });
  };

  return (
    <form className="panel stack" onSubmit={save} noValidate>
      <div className="panel-head">
        <h2>Add an entry</h2>
        <div className="seg" role="group" aria-label="Entry type">
          <button type="button" aria-pressed={dir === "in"} onClick={() => { setDir("in"); setWarn(""); }}>Money in</button>
          <button type="button" aria-pressed={dir === "out"} onClick={() => { setDir("out"); setWarn(""); }}>Money out</button>
        </div>
      </div>
      <div className="form-grid">
        <label className="field"><span>Amount (R)</span><input type="number" min={1} step="0.01" inputMode="decimal" placeholder="0" value={f.amount} onChange={(e) => { setF({ ...f, amount: e.target.value }); setWarn(""); }} /></label>
        <label className="field"><span>Paid by</span><select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value as PayMethod })}>{PAY_METHOD_KEYS.map((m) => <option key={m} value={m}>{PAY_METHODS[m]}</option>)}</select></label>
        <label className="field"><span>Category</span><select value={category} onChange={(e) => setF({ ...f, category: e.target.value })}>{cats.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label className="field"><span>Date</span><input type="date" value={f.date} max={todayZA()} onChange={(e) => { setF({ ...f, date: e.target.value }); setWarn(""); }} /></label>
        <label className="field" style={{ gridColumn: "1/-1" }}><span>What was it for?</span><input type="text" maxLength={200} placeholder={dir === "in" ? "e.g. Lash lift, client paid cash" : "e.g. Gel polish restock"} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
        {data.stockOn && data.stock.length > 0 && <>
          <label className="field"><span>{dir === "in" ? "Stock used (optional)" : "Stock bought (optional)"}</span>
            <select value={f.stockItemId} onChange={(e) => setF({ ...f, stockItemId: e.target.value })}><option value="">None</option>{data.stock.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.qty} {s.unit})</option>)}</select>
          </label>
          <label className="field"><span>Quantity</span><input type="number" min={0} step="0.1" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} /></label>
        </>}
      </div>
      <div className="row between">
        <div className="row">
          {dir === "out" && <label className="check"><input type="checkbox" checked={f.isPersonal} onChange={(e) => setF({ ...f, isPersonal: e.target.checked })} />This was a personal purchase</label>}
          {online
            ? receipt ? <span className="small">Receipt: {receipt.name} <button type="button" className="btn ghost sm" onClick={() => setReceipt(null)}>Remove</button></span>
              : <FilePick label="Add a receipt photo" purpose="receipt" accept="image/*,.pdf" onUploaded={(r) => setReceipt({ fileId: r.fileId, name: r.name })} onError={setWarn} />
            : <span className="hint">Receipt photos need a connection.</span>}
        </div>
        <button className="btn primary" type="submit" disabled={busy}>{warn.startsWith("Possible duplicate") ? "Save again" : "Save entry"}</button>
      </div>
      {warn && <Notice tone="warn" icon="!"><span className="small">{warn}</span></Notice>}
    </form>
  );
}

// ---------------------------------------------------------------- entries table
function Entries({ data, month, setMonth }: { data: BooksData; month: string; setMonth: (m: string) => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const waiting = useOutbox("entry");
  const refresh = () => qc.invalidateQueries({ queryKey: ["founder"] });
  const paidBack = useMutation({ mutationFn: (id: string) => api<{ message: string }>(`/founder/entries/${id}/paid-back`, { body: {} }), onSuccess: (r) => { toast(r.message); void refresh(); } });
  const correct = async (e: Entry) => {
    const reason = window.prompt("Why is this entry wrong? It's removed from your totals but kept in your history.");
    if (!reason?.trim()) return;
    try { toast((await api<{ message: string }>(`/founder/entries/${e.id}/void`, { body: { reason } })).message); void refresh(); }
    catch (x) { toast(x instanceof ApiError ? x.message : "Try again."); }
  };
  const current = month === monthOf(todayZA());
  const live = data.entries.filter((e) => !e.voided);
  return (
    <section className="panel" style={{ padding: 0 }}>
      <div className="panel-head" style={{ padding: "16px 18px 0" }}>
        <div className="row">
          <button className="btn sm" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}>‹</button>
          <h2>{current ? "This month" : `${monthLabel(month)} ${month.slice(0, 4)}`}</h2>
          {!current && <button className="btn sm" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}>›</button>}
        </div>
        <span className="small muted">{live.length} entries · last entry {data.lastEntryDays === null ? "never" : `${data.lastEntryDays} days ago`}</span>
      </div>
      <div className="table-wrap flush">
        <table>
          <thead><tr><th>Date</th><th>Details</th><th>Category</th><th>Paid by</th><th>Receipt</th><th className="r">Amount</th><th /></tr></thead>
          <tbody>
            {current && waiting.map((w) => (
              <tr key={w.id}>
                <td className="num">{shortDate(String(w.body.date))}</td>
                <td>{w.label} {w.error ? <Pill tone="bad">Not saved</Pill> : <Pill tone="warn">Waiting to sync</Pill>}{w.error && <div className="hint" style={{ color: "var(--bad)" }}>{w.error}</div>}</td>
                <td>{String(w.body.category)}</td><td>{PAY_METHODS[w.body.method as PayMethod]}</td><td /><td className="r num">{sign(w.body.direction as "in" | "out")}{R(Number(w.body.amount))}</td>
                <td className="r">{w.error && <div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
                  {w.errorCode === "possible_duplicate" && <button className="btn sm" onClick={() => void retry(w.id, { confirmDuplicate: true })}>Save anyway</button>}
                  <button className="btn sm ghost" onClick={() => void removeItem(w.id)}>Discard</button>
                </div>}</td>
              </tr>
            ))}
            {data.entries.map((e) => (
              <tr key={e.id} style={e.voided ? { opacity: 0.55 } : undefined}>
                <td className="num">{shortDate(e.date)}</td>
                <td>{e.voided ? <s>{e.note || "—"}</s> : e.note || "—"} {e.isPersonal && <Pill tone="warn">Personal</Pill>}{e.voided && <div className="hint">Removed: {e.voidReason}</div>}</td>
                <td>{e.category}</td><td>{PAY_METHODS[e.method]}</td>
                <td>{e.receipt ? <Pill tone="good">Kept</Pill> : <Pill tone="plain">None</Pill>}</td>
                <td className={`r num ${e.direction === "in" ? "in" : ""}`}>{sign(e.direction)}{R(e.amount)}</td>
                <td className="r"><div className="row" style={{ gap: 4, flexWrap: "nowrap", justifyContent: "flex-end" }}>
                  {e.isPersonal && <button className="btn sm" onClick={() => paidBack.mutate(e.id)}>Paid back</button>}
                  {!e.voided && e.source !== "proof" && <button className="btn sm ghost" onClick={() => void correct(e)}>Correct</button>}
                </div></td>
              </tr>
            ))}
            {!data.entries.length && !(current && waiting.length) && <tr><td colSpan={7} className="muted">No entries {current ? "this month yet" : "in this month"}.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- earlier months
function EarlierMonths({ history }: { history: BooksData["history"] }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [h, setH] = useState({ month: addMonths(monthOf(todayZA()), -1), moneyIn: "", moneyOut: "" });
  const save = useMutation({
    mutationFn: () => api<{ message: string }>("/founder/history", { method: "PUT", body: { month: h.month, moneyIn: Number(h.moneyIn) || 0, moneyOut: Number(h.moneyOut) || 0 } }),
    onSuccess: (r) => { toast(r.message); void qc.invalidateQueries({ queryKey: ["founder"] }); },
  });
  return (
    <details className="panel">
      <summary>Earlier months, before you used ProofPocket</summary>
      <p className="hint mt-2">Add each month's totals from your notebook or old statements. Funders see these marked as your own figures, not checked books.</p>
      <form className="form-grid mt-2" noValidate onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <label className="field"><span>Month</span><input type="month" max={addMonths(monthOf(todayZA()), -1)} value={h.month} onChange={(e) => setH({ ...h, month: e.target.value })} /></label>
        <label className="field"><span>Money in (R)</span><input type="number" min={0} value={h.moneyIn} onChange={(e) => setH({ ...h, moneyIn: e.target.value })} /></label>
        <label className="field"><span>Money out (R)</span><input type="number" min={0} value={h.moneyOut} onChange={(e) => setH({ ...h, moneyOut: e.target.value })} /></label>
        <button className="btn" type="submit">Save month</button>
      </form>
      {save.error && <p className="err">{(save.error as ApiError).message}</p>}
      {history.length > 0 && <div className="mt-2">{history.map((m) => (
        <div key={m.month} className="li"><span className="small">{monthLabel(m.month)} {m.month.slice(0, 4)}</span><span className="num small">+{R(m.moneyIn)} · −{R(m.moneyOut)}</span></div>
      ))}</div>}
    </details>
  );
}

export default function Books() {
  const qc = useQueryClient();
  const [month, setMonth] = useState(monthOf(todayZA()));
  const q = useQuery({ queryKey: ["founder", "books", month], queryFn: () => api<BooksData>(`/founder/books?month=${month}`) });
  if (!q.data) return <><FounderHead title="Bookkeeping" sub={SUB} />{q.isError ? <p className="err">Couldn't load your books. Check your connection.</p> : <Spinner />}</>;
  const d = q.data;
  const profit = d.totals.moneyIn - d.totals.moneyOut;
  return (
    <>
      <FounderHead title="Bookkeeping" sub={SUB} />
      <Statement lines={d.statementLines} onChange={() => void qc.invalidateQueries({ queryKey: ["founder"] })} />
      <EntryForm data={d} />
      <div className="grid-3">
        <Stat label="Money in" value={R(d.totals.moneyIn)} tone="in" />
        <Stat label="Money out" value={R(d.totals.moneyOut)} />
        <Stat label="Profit" value={R(profit)} tone={profit < 0 ? "bad" : undefined} />
      </div>
      <Entries data={d} month={month} setMonth={setMonth} />
      <Notice tone="info" icon="i"><span className="small">Funders check that personal spending stays out of the business and that owners pay themselves a set salary. Record your pay under <b>Owner salary</b>, and mark personal purchases so you can pay them back.</span></Notice>
      <EarlierMonths history={d.history} />
    </>
  );
}
