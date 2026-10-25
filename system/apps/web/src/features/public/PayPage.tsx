// The public payment page (v2/app.js payPageHTML). No account. The link is /pay/PP-4821-{token}.
import { R, RAILS, shortDate, todayZA, type PaymentStatus, type Rail } from "@proofpocket/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Info } from "lucide-react";
import { FilePick } from "../../components/FilePick";
import { TopBar } from "../../components/layout/TopBar";
import { LevelPill, Notice, Spinner, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";

interface Page {
  business: { name: string; verified: boolean; slug: string; whatsapp: string };
  ref: string; client: string; amount: number; what: string; requestedOn: string; expiresOn: string; status: PaymentStatus; attempts: number;
  rails: { key: Rail; label: string }[]; canSendProof: boolean;
  ways: { payshap?: { shapId: string }; eft?: { bank: string; accountName: string; accountNumber: string }; cash?: true; card_machine?: true; payfast?: true };
}

/** PayFast card / EFT — shown when the rail is enabled. Currently shows a pending notice while credentials are being processed. */
function PayFastSection() {
  return (
    <div className="way">
      <b>Card or EFT (PayFast)</b>
      <div className="flex items-start gap-2 rounded border border-border bg-muted/40 p-3 mt-1">
        <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="small text-muted-foreground">
          Card and instant EFT payments via PayFast are coming soon.
          Our PayFast merchant application is being processed — once approved, clients will be able to pay by card and the books will update automatically.
          In the meantime, use PayShap, EFT or cash.
        </p>
      </div>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const toast = useToast();
  const copy = async () => { try { await navigator.clipboard.writeText(value); toast("Copied"); } catch { toast(value); } };
  return (
    <div className="copyrow">
      <span className="hint">{label}</span><span className="mono">{value}</span>
      <button type="button" className="btn sm" onClick={() => void copy()} aria-label={`Copy ${label.toLowerCase()}`}>Copy</button>
    </div>
  );
}

function ProofForm({ page, path, headers, onSent }: { page: Page; path: string; headers: Record<string, string>; onSent: () => void }) {
  const digital = page.rails.filter((r) => r.key === "payshap" || r.key === "eft");
  const [f, setF] = useState({ payer: page.client, amount: String(page.amount), paidOn: todayZA(), method: digital[0]?.key ?? "eft", usedReference: true });
  const [file, setFile] = useState<{ fileId: string; name: string } | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr("");
    if (!f.payer.trim() || !Number(f.amount)) { setErr("Add your name and the amount you paid."); return; }
    if (!file) { setErr("Attach your proof of payment (a screenshot or PDF from your bank)."); return; }
    setBusy(true);
    try { await api(`${path}/proof`, { body: { ...f, amount: Number(f.amount), fileId: file.fileId }, headers }); onSent(); }
    catch (x) { setErr((x as ApiError).message); }
    finally { setBusy(false); }
  };
  return (
    <form className="panel stack" onSubmit={submit} noValidate>
      <h2>Paid? Send your proof of payment</h2>
      <p className="small muted">{page.business.name} checks it against their bank and confirms when the money is in.</p>
      <div className="form-grid">
        <label className="field"><span>Your name</span><input type="text" value={f.payer} onChange={(e) => setF({ ...f, payer: e.target.value })} /></label>
        <label className="field"><span>Amount you paid (R)</span><input type="number" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
        <label className="field"><span>Date you paid</span><input type="date" max={todayZA()} value={f.paidOn} onChange={(e) => setF({ ...f, paidOn: e.target.value })} /></label>
        <label className="field"><span>Paid by</span><select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value as Rail })}>{digital.map((r) => <option key={r.key} value={r.key}>{RAILS[r.key]}</option>)}</select></label>
      </div>
      <label className="check"><input type="checkbox" checked={f.usedReference} onChange={(e) => setF({ ...f, usedReference: e.target.checked })} />I used reference <span className="mono">{page.ref}</span></label>
      <div className="row">
        <FilePick label={file ? "Replace proof" : "Attach proof"} purpose="proof" base={path} headers={headers} primary={!file} onUploaded={(u) => setFile({ fileId: u.fileId, name: u.name })} onError={setErr} />
        {file && <span className="small">{file.name}</span>}
      </div>
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn primary self-start" type="submit" disabled={busy}>{busy ? "Sending…" : "Send proof of payment"}</button>
    </form>
  );
}

export default function PayPage() {
  const { ref: param = "" } = useParams();
  const [searchParams] = useSearchParams();
  const payfastResult = searchParams.get("payfast"); // "success" | "cancelled" | null
  const toast = useToast();
  const qc = useQueryClient();
  const m = /^(PP-\d{4,6})-([A-Za-z0-9_-]{8,64})$/.exec(param);
  const ref = m?.[1] ?? "", headers = { "X-Pay-Token": m?.[2] ?? "" }, path = `/pay/${ref}`;
  const q = useQuery({ queryKey: ["pay", param], queryFn: () => api<Page>(path, { headers }), enabled: !!m, retry: false });
  const report = async () => {
    if (!window.confirm("Report this payment request to ProofPocket?")) return;
    try { toast((await api<{ message: string }>(`${path}/report`, { body: {}, headers })).message); } catch (e) { toast((e as ApiError).message); }
  };

  return (
    <>
      <TopBar home="/directory" />
      <main id="main" className="mx-auto flex max-w-[640px] flex-col gap-4 px-4 pb-12 pt-5">
        {payfastResult === "success" && (
          <Notice tone="good" icon="✓">
            <span className="small"><b>Payment submitted to PayFast.</b> The business will be notified automatically once your payment is confirmed.</span>
          </Notice>
        )}
        {payfastResult === "cancelled" && (
          <Notice tone="warn" icon="!">
            <span className="small"><b>Payment cancelled.</b> You can try again below.</span>
          </Notice>
        )}
        {!m || q.isError ? (
          <Notice tone="bad" icon="!"><span className="small"><b>This payment link isn't valid.</b> Check that you copied the whole link, or ask the business to send it again.</span></Notice>
        ) : !q.data ? <Spinner /> : (() => {
          const p = q.data;
          const closed = ["paid", "cancelled", "expired", "flagged"].includes(p.status);
          return <>
            <section className="panel stack">
              <span className="label">You're paying</span>
              <div className="row between"><h1>{p.business.name}</h1><LevelPill verified={p.business.verified} /></div>
              <span className="num payamt">{R(p.amount)}</span>
              <span className="small">{p.what || "Payment"} · reference <b className="mono">{p.ref}</b> · requested {shortDate(p.requestedOn)}</span>
            </section>
            {p.status === "paid" && <Notice tone="good" icon="✓"><span className="small"><b>Paid. Thank you.</b> {p.business.name} confirmed the money is in their account.</span></Notice>}
            {p.status === "checking" && <Notice tone="info" icon="i"><span className="small"><b>Proof of payment sent.</b> {p.business.name} will confirm once the money shows in their bank. Open this link again to see when it's confirmed.</span></Notice>}
            {p.status === "not_received" && <Notice tone="warn" icon="!"><span className="small">{p.business.name} hasn't received this payment yet. Check your bank, then upload your proof again.</span></Notice>}
            {p.status === "expired" && <Notice tone="warn" icon="!"><span className="small">This request has expired. Ask {p.business.name} for a new link.</span></Notice>}
            {p.status === "cancelled" && <Notice tone="warn" icon="!"><span className="small">{p.business.name} cancelled this request. Don't pay it.</span></Notice>}
            {p.status === "flagged" && <Notice tone="bad" icon="!"><span className="small">This request is closed. Contact {p.business.name} directly.</span></Notice>}
            {!closed && (
              <section className="panel stack">
                <h2>How to pay</h2>
                {/* PayFast card/EFT — shown when the rail is included on this request */}
                {p.ways.payfast && <PayFastSection />}
                {p.ways.payshap && <div className="way"><b>PayShap</b><CopyRow label="ShapID" value={p.ways.payshap.shapId} /><CopyRow label="Reference" value={p.ref} /></div>}
                {p.ways.eft && <div className="way"><b>Bank EFT</b>
                  <CopyRow label="Bank" value={p.ways.eft.bank} /><CopyRow label="Account name" value={p.ways.eft.accountName} />
                  <CopyRow label="Account number" value={p.ways.eft.accountNumber} /><CopyRow label="Reference" value={p.ref} /></div>}
                {p.ways.cash && <div className="way"><b>Cash</b><span className="small">Pay {p.business.name} in person and quote reference <span className="mono">{p.ref}</span>. They will mark it paid.</span></div>}
                {p.ways.card_machine && <div className="way"><b>Card machine</b><span className="small">Tap or insert your card on {p.business.name}'s card machine.</span></div>}
                <Notice tone="warn" icon="!"><span className="small"><b>Only pay to the details on this page.</b> If anyone sends you different bank details for {p.business.name}, don't pay. Check with the business first.</span></Notice>
              </section>
            )}
            {p.canSendProof && <ProofForm page={p} path={path} headers={headers} onSent={() => { toast("Proof sent to the business. They'll confirm once the money is in."); void qc.invalidateQueries({ queryKey: ["pay", param] }); }} />}
            <section className="panel stack">
              <span className="label">Something wrong?</span>
              <p className="small">If this business asked you to pay in a way that felt unsafe, tell us.</p>
              <button className="btn sm danger self-start" onClick={() => void report()}>Report this request</button>
            </section>
          </>;
        })()}
      </main>
    </>
  );
}
