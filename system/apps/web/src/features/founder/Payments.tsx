// Payments (v2/app.js vPayments). Clients pay the founder directly; ProofPocket records it and checks proofs.
import { PAYMENT_REQUEST_DAYS, R, RAILS, RAIL_KEYS, shortDate, todayZA, type PaymentStatus, type ProofCheck, type Rail, type Tone } from "@proofpocket/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Notice, Pill, Spinner, useToast } from "../../components/ui";
import { API_BASE, ApiError, api } from "../../lib/api";
import { useMe } from "../../lib/me";
import { enqueue } from "../../lib/outbox";
import { CodeInput } from "../auth/TwoFactor";
import { FounderHead } from "./FounderHead";

interface Proof { id: string; payer: string; amount: number; paidOn: string; method: Rail; usedReference: boolean; fileId: string | null; checks: ProofCheck[] }
interface Req { id: string; ref: string; client: string; amount: number; what: string; rails: Rail[]; status: PaymentStatus; attempts: number; requestedOn: string; expiresOn: string; link: string; proof: Proof | null }
interface Supplier { id: string; name: string; bank: string; pending: { bank: string; since: string } | null }
interface PayData {
  requests: Req[]; suppliers: Supplier[]; authenticatorOn: boolean; businessType: string;
  details: { bank: string; accountName: string; accountMasked: string; shapId: string; inBusinessName: boolean | null } | null;
}

const SUB = "Clients pay you directly with the methods they already use. They upload proof of payment, and you confirm once the money is in your account.";
const STATUS: Record<PaymentStatus, [Tone, string]> = {
  waiting: ["plain", "Waiting for client"], checking: ["warn", "Proof to check"], paid: ["good", "Paid · in books"], not_received: ["bad", "Not received"],
  flagged: ["bad", "Flagged: possible fake proof"], expired: ["plain", "Expired"], cancelled: ["plain", "Cancelled"],
};

function useRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["founder"] });
}

// ---------------------------------------------------------------- proofs to check
function ProofBox({ r }: { r: Req }) {
  const toast = useToast();
  const refresh = useRefresh();
  const [err, setErr] = useState("");
  const p = r.proof!;
  const failed = p.checks.filter((c) => !c.ok).length;
  const act = async (kind: "confirm" | "reject") => {
    try { toast((await api<{ message: string }>(`/founder/proofs/${p.id}/${kind}`, { body: {} })).message); void refresh(); }
    catch (e) { setErr((e as ApiError).message); }
  };
  const open = async () => {
    if (!p.fileId) return;
    try { const { url } = await api<{ url: string }>(`/files/${p.fileId}/download-url`); window.open(url.startsWith("/") ? `${API_BASE}${url}` : url, "_blank", "noopener"); }
    catch (e) { setErr((e as ApiError).message); }
  };
  return (
    <div className={`popbox stack ${failed ? "warn" : ""}`}>
      <div className="row between">
        <b>{r.client} says they paid {R(p.amount)}</b>
        {failed ? <Pill tone="warn">{failed} {failed === 1 ? "thing" : "things"} to check</Pill> : <Pill tone="good">Details match</Pill>}
      </div>
      <span className="small muted">For {r.what || "payment"} · reference <span className="mono">{r.ref}</span> · {RAILS[p.method]} on {shortDate(p.paidOn)} · from {p.payer}</span>
      <div>{p.checks.map((c) => (
        <div key={c.code} className="ck" style={{ gridTemplateColumns: "22px minmax(0,1fr)" }}>
          <span className={`mark ${c.ok ? "ok" : "no"}`} aria-hidden="true">{c.ok ? "✓" : "×"}</span><span className="small">{c.text}</span>
        </div>
      ))}</div>
      <Notice tone="warn" icon="!"><span className="small">A proof of payment can be faked. Open your banking app and check the money is really in your account before you hand anything over.</span></Notice>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="row">
        {p.fileId && <button className="btn sm" onClick={() => void open()}>Open proof</button>}
        <button className="btn sm primary" onClick={() => void act("confirm")}>The money is in my account</button>
        <button className="btn sm danger" onClick={() => void act("reject")}>Not received</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- ask a client to pay
function NewRequest({ business }: { business: string }) {
  const toast = useToast();
  const refresh = useRefresh();
  const [f, setF] = useState({ client: "", amount: "", what: "", rails: ["payshap", "eft", "cash"] as Rail[] });
  const [err, setErr] = useState("");
  const [made, setMade] = useState<{ ref: string; link: string; client: string; amount: number; what: string } | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr("");
    if (!f.client.trim() || !Number(f.amount)) { setErr("Add the client's name and an amount"); return; }
    if (!f.rails.length) { setErr("Choose at least one way to pay"); return; }
    try {
      const r = await api<{ ref: string; link: string; message: string }>("/founder/payment-requests", { body: { client: f.client, amount: Number(f.amount), what: f.what, rails: f.rails } });
      toast(r.message); setMade({ ...r, client: f.client, amount: Number(f.amount), what: f.what });
      setF({ ...f, client: "", amount: "", what: "" }); void refresh();
    } catch (x) { setErr((x as ApiError).message); }
  };
  return (
    <form className="panel stack" onSubmit={submit} noValidate>
      <h2>Ask a client to pay</h2>
      <div className="form-grid">
        <label className="field"><span>Client</span><input type="text" value={f.client} onChange={(e) => setF({ ...f, client: e.target.value })} /></label>
        <label className="field"><span>Amount (R)</span><input type="number" min={1} inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
        <label className="field" style={{ gridColumn: "span 2" }}><span>For</span><input type="text" placeholder="e.g. Lash fill" value={f.what} onChange={(e) => setF({ ...f, what: e.target.value })} /></label>
      </div>
      <fieldset><legend className="small muted font-semibold mb-1">Ways the client can pay</legend>
        <div className="row" style={{ gap: 6 }}>{RAIL_KEYS.map((k) => (
          <label key={k} className="chip"><input type="checkbox" checked={f.rails.includes(k)} onChange={(e) => setF({ ...f, rails: e.target.checked ? [...f.rails, k] : f.rails.filter((x) => x !== k) })} /> {RAILS[k]}</label>
        ))}</div>
      </fieldset>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="row between"><span className="hint">The link works for {PAYMENT_REQUEST_DAYS} days and shows only your saved payment details.</span><button className="btn primary" type="submit">Create payment request</button></div>
      {made && <Share req={made} business={business} />}
    </form>
  );
}

function waText(business: string, r: { client: string; amount: number; what: string; ref: string; link: string }) {
  return `Hi ${r.client}, here is how to pay ${business} ${R(r.amount)}${r.what ? ` for ${r.what}` : ""}. Use reference ${r.ref}. Pay and upload your proof here: ${r.link}`;
}

function Share({ req, business }: { req: { client: string; amount: number; what: string; ref: string; link: string }; business: string }) {
  const toast = useToast();
  const [qr, setQr] = useState<string | null>(null);
  const showQr = async () => {
    if (qr) { setQr(null); return; }
    const QR = await import("qrcode");
    setQr(await QR.toDataURL(req.link, { margin: 1, width: 220, color: { dark: "#181C27", light: "#FFFFFF" } }));
  };
  const copy = async () => { try { await navigator.clipboard.writeText(req.link); toast("Link copied"); } catch { toast(req.link); } };
  return (
    <div className="stack" style={{ gap: 6 }}>
      <span className="fp">{req.link}</span>
      <div className="row" style={{ gap: 6 }}>
        <a className="btn sm primary" href={`https://wa.me/?text=${encodeURIComponent(waText(business, req))}`} target="_blank" rel="noopener noreferrer">Send on WhatsApp</a>
        <button type="button" className="btn sm" onClick={() => void showQr()}>{qr ? "Hide QR" : "Show QR"}</button>
        <button type="button" className="btn sm" onClick={() => void copy()}>Copy link</button>
      </div>
      {qr && <div className="qrbox"><img src={qr} alt={`QR code for payment ${req.ref}`} width={180} height={180} /></div>}
    </div>
  );
}

// ---------------------------------------------------------------- payment requests list
function Requests({ data, business }: { data: PayData; business: string }) {
  const toast = useToast();
  const refresh = useRefresh();
  const [open, setOpen] = useState<string | null>(null);
  const act = async (r: Req, kind: "cash" | "cancel") => {
    if (kind === "cancel" && !window.confirm(`Cancel ${r.ref}? The link will stop working.`)) return;
    try { toast((await api<{ message: string }>(`/founder/payment-requests/${r.id}/${kind}`, { body: {} })).message); void refresh(); }
    catch (e) { toast((e as ApiError).message); }
  };
  return (
    <section className="panel">
      <h2>Payment requests</h2>
      {data.requests.length ? data.requests.map((r) => {
        const live = r.status === "waiting" || r.status === "not_received";
        return (
          <div key={r.id} className="li">
            <div className="li-main">
              <span><b>{r.client}</b> · {r.what || "Payment"} · <span className="num">{R(r.amount)}</span></span>
              <span className="hint"><span className="mono">{r.ref}</span> · {r.rails.map((x) => RAILS[x]).join(", ")} · {live ? `link works until ${shortDate(r.expiresOn)}` : shortDate(r.requestedOn)}</span>
              {r.status === "not_received" && <span className="small text-bad">You said the money didn't arrive. The client can upload proof once more.</span>}
              {open === r.id && <Share req={r} business={business} />}
            </div>
            <div className="li-side">
              <Pill tone={STATUS[r.status][0]}>{STATUS[r.status][1]}</Pill>
              <div className="row" style={{ gap: 6 }}>
                {live && <button className="btn sm" onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? "Hide link" : "Link & QR"}</button>}
                {r.rails.includes("cash") && (live || r.status === "expired") && <button className="btn sm" onClick={() => void act(r, "cash")}>Paid me cash</button>}
                {live && <button className="btn sm ghost" onClick={() => void act(r, "cancel")}>Cancel</button>}
              </div>
            </div>
          </div>
        );
      }) : <p className="muted">No payment requests yet.</p>}
    </section>
  );
}

// ---------------------------------------------------------------- payment details (Google Authenticator)
function Details({ data }: { data: PayData }) {
  const toast = useToast();
  const refresh = useRefresh();
  const d = data.details;
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ bank: d?.bank ?? "", accountName: d?.accountName ?? "", accountNumber: "", shapId: d?.shapId ?? "", inBusinessName: d?.inBusinessName ?? true, code: "" });
  const save = useMutation({
    mutationFn: () => api<{ message: string }>("/founder/payment-details", { method: "PUT", body: f }),
    onSuccess: (r) => { toast(r.message); setEdit(false); setF({ ...f, accountNumber: "", code: "" }); void refresh(); },
  });
  const personal = d && (d.inBusinessName === false || /personal/i.test(d.accountName));
  return (
    <section className="panel stack">
      <div className="row between"><h2>Your payment details</h2>{!edit && data.authenticatorOn && <button className="btn sm" onClick={() => setEdit(true)}>Change</button>}</div>
      <p className="small muted">Shown to clients on your payment page. Changing them needs a code from Google Authenticator, and your adviser is told, so nobody can quietly redirect your payments.</p>
      {d ? (
        <div className="small stack" style={{ gap: 2 }}>
          <span>{d.bank} · {d.accountName} · <span className="mono">{d.accountMasked}</span></span>
          {d.shapId && <span>PayShap ShapID <span className="mono">{d.shapId}</span></span>}
        </div>
      ) : <p className="muted small">No payment details yet. Clients can only pay cash or by card machine until you add them.</p>}
      {personal && <Notice tone="warn" icon="!"><span className="small">This looks like a personal account. Funders and buyers expect payments into an account in the business's name. Keep business and personal money apart.</span></Notice>}
      {!data.authenticatorOn && (
        <Notice tone="info" icon="2" action={<Link className="btn sm primary ml-auto" to="/app/settings">Set up</Link>}>
          <span className="small">To add or change payment details, first set up <b>Google Authenticator</b> in Business settings.</span>
        </Notice>
      )}
      {edit && (
        <form className="stack" noValidate onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="form-grid">
            <label className="field"><span>Bank</span><input type="text" value={f.bank} onChange={(e) => setF({ ...f, bank: e.target.value })} /></label>
            <label className="field"><span>Account name</span><input type="text" value={f.accountName} onChange={(e) => setF({ ...f, accountName: e.target.value })} /></label>
            <label className="field"><span>Account number</span><input type="text" inputMode="numeric" autoComplete="off" value={f.accountNumber} onChange={(e) => setF({ ...f, accountNumber: e.target.value })} /></label>
            <label className="field"><span>PayShap ShapID (optional)</span><input type="text" value={f.shapId} onChange={(e) => setF({ ...f, shapId: e.target.value })} /></label>
          </div>
          <label className="check"><input type="checkbox" checked={f.inBusinessName} onChange={(e) => setF({ ...f, inBusinessName: e.target.checked })} />This account is in the business's name</label>
          <CodeInput value={f.code} onChange={(code) => setF({ ...f, code })} />
          {save.error && <p className="err" role="alert">{(save.error as ApiError).message}</p>}
          <div className="row"><button className="btn primary" type="submit" disabled={f.code.length !== 6 || save.isPending}>Save payment details</button><button className="btn ghost" type="button" onClick={() => setEdit(false)}>Cancel</button></div>
        </form>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- money out: suppliers and cash
function MoneyOut({ data }: { data: PayData }) {
  const toast = useToast();
  const refresh = useRefresh();
  const [sp, setSp] = useState({ supplierId: data.suppliers[0]?.id ?? "", amount: "", what: "" });
  const [ns, setNs] = useState({ name: "", bank: "", accountNumber: "" });
  const [cash, setCash] = useState({ name: "", amount: "", what: "", noPhone: true });
  const [err, setErr] = useState<Record<string, string>>({});
  const fail = (k: string, e: unknown) => setErr({ ...err, [k]: e instanceof ApiError ? e.message : "Try again." });

  const paySupplier = async (e: FormEvent) => {
    e.preventDefault(); setErr({});
    const s = data.suppliers.find((x) => x.id === sp.supplierId);
    if (!s || !Number(sp.amount)) { setErr({ sp: "Choose a supplier and enter an amount" }); return; }
    if (s.pending) { setErr({ sp: `Payment blocked: ${s.name}'s bank details changed. Confirm by phone under Fraud protection first.` }); return; }
    try {
      toast((await api<{ message: string }>("/founder/supplier-payments", { body: { clientUuid: crypto.randomUUID(), supplierId: s.id, amount: Number(sp.amount), what: sp.what, date: todayZA() } })).message);
      setSp({ ...sp, amount: "", what: "" }); void refresh();
    } catch (x) { fail("sp", x); }
  };
  const addSupplier = async (e: FormEvent) => {
    e.preventDefault(); setErr({});
    try { toast((await api<{ message: string }>("/founder/suppliers", { body: ns })).message); setNs({ name: "", bank: "", accountNumber: "" }); void refresh(); }
    catch (x) { fail("ns", x); }
  };
  const payCash = async (e: FormEvent) => {
    e.preventDefault(); setErr({});
    if (!cash.name.trim() || !Number(cash.amount)) { setErr({ cash: "Add who you paid and the amount" }); return; }
    const clientUuid = crypto.randomUUID();
    const r = await enqueue({ id: clientUuid, path: "/founder/cash-payouts", kind: "cash", label: `Cash to ${cash.name} ${R(Number(cash.amount))}`,
      body: { clientUuid, name: cash.name, amount: Number(cash.amount), what: cash.what, noPhone: cash.noPhone, date: todayZA() } });
    if (r.state === "failed") { setErr({ cash: r.error?.message ?? "Try again." }); return; }
    toast(r.state === "saved" ? "Saved on this phone, will sync" : "Cash payment recorded. Find the slip number in Bookkeeping.");
    setCash({ ...cash, name: "", amount: "", what: "" }); void refresh();
  };

  return (
    <div className="grid-2">
      <div className="stack">
        <form className="panel stack" onSubmit={paySupplier} noValidate>
          <h2>Record a supplier payment</h2>
          <p className="small muted">Pay in your own banking app first, then record it here. ProofPocket never moves money.</p>
          <div className="form-grid">
            <label className="field"><span>Supplier</span><select value={sp.supplierId} onChange={(e) => setSp({ ...sp, supplierId: e.target.value })}>
              {data.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.bank}{s.pending ? " · ON HOLD" : ""}</option>)}
            </select></label>
            <label className="field"><span>Amount (R)</span><input type="number" min={1} value={sp.amount} onChange={(e) => setSp({ ...sp, amount: e.target.value })} /></label>
            <label className="field"><span>For</span><input type="text" value={sp.what} onChange={(e) => setSp({ ...sp, what: e.target.value })} /></label>
          </div>
          {err.sp && <p className="err" role="alert">{err.sp}</p>}
          <button className="btn primary self-start" type="submit" disabled={!data.suppliers.length}>Record payment</button>
        </form>
        <form className="panel stack" onSubmit={addSupplier} noValidate>
          <h3>Add a supplier</h3>
          <div className="form-grid">
            <label className="field"><span>Supplier</span><input type="text" value={ns.name} onChange={(e) => setNs({ ...ns, name: e.target.value })} /></label>
            <label className="field"><span>Bank</span><input type="text" value={ns.bank} onChange={(e) => setNs({ ...ns, bank: e.target.value })} /></label>
            <label className="field"><span>Account number (or last 4 digits)</span><input type="text" inputMode="numeric" value={ns.accountNumber} onChange={(e) => setNs({ ...ns, accountNumber: e.target.value })} /></label>
          </div>
          <p className="hint">Only the last four digits are kept.</p>
          {err.ns && <p className="err" role="alert">{err.ns}</p>}
          <button className="btn self-start" type="submit">Save supplier</button>
        </form>
      </div>
      <form className="panel stack" onSubmit={payCash} noValidate>
        <h2>Record a cash payment out</h2>
        <p className="small muted">For collectors, casual workers and anyone you pay in cash. Works offline.</p>
        <div className="form-grid">
          <label className="field"><span>Paid to</span><input type="text" value={cash.name} onChange={(e) => setCash({ ...cash, name: e.target.value })} /></label>
          <label className="field"><span>Amount (R)</span><input type="number" min={1} value={cash.amount} onChange={(e) => setCash({ ...cash, amount: e.target.value })} /></label>
          <label className="field"><span>For</span><input type="text" placeholder="e.g. PET bottles, 17 kg" value={cash.what} onChange={(e) => setCash({ ...cash, what: e.target.value })} /></label>
        </div>
        <label className="check"><input type="checkbox" checked={cash.noPhone} onChange={(e) => setCash({ ...cash, noPhone: e.target.checked })} />Payee has no phone, give a slip number</label>
        {err.cash && <p className="err" role="alert">{err.cash}</p>}
        <button className="btn primary self-start" type="submit">Record cash payment</button>
      </form>
    </div>
  );
}

export default function Payments() {
  const me = useMe().data;
  const q = useQuery({ queryKey: ["founder", "payments"], queryFn: () => api<PayData>("/founder/payments") });
  if (!q.data) return <><FounderHead title="Payments" sub={SUB} />{q.isError ? <p className="err">Couldn't load payments. Check your connection.</p> : <Spinner />}</>;
  const d = q.data, business = me?.company?.name ?? "";
  const toCheck = d.requests.filter((r) => r.proof);
  return (
    <>
      <FounderHead title="Payments" sub={SUB} />
      <Notice tone="info" icon="i"><span className="small"><b>ProofPocket never holds your money.</b> Clients pay you straight into your account, by card machine or in cash. ProofPocket records each payment and helps you spot fake proofs of payment.</span></Notice>
      {toCheck.length > 0 && (
        <section className="panel stack">
          <h2>Proof of payment to check</h2>
          {toCheck.map((r) => <ProofBox key={r.id} r={r} />)}
        </section>
      )}
      <div className="grid-2">
        <NewRequest business={business} />
        <Details key={JSON.stringify(d.details)} data={d} />
      </div>
      <Requests data={d} business={business} />
      <MoneyOut key={d.suppliers.map((s) => s.id).join()} data={d} />
    </>
  );
}
