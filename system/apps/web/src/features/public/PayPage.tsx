// The public payment page (v2/app.js payPageHTML). No account. The link is /pay/PP-4821-{token}.
import { R, Rc, RAILS, shortDate, todayZA, type PaymentStatus, type Rail } from "@proofpocket/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import { ClipboardCopy, Flag, Loader2 } from "lucide-react";
import { useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect, TextField } from "@/components/ui/field";
import { FilePick } from "../../components/FilePick";
import { PageHeader } from "../../components/PageHeader";
import { LevelBadge } from "../../components/ToneBadge";
import { Spinner, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { PublicShell } from "./Directory";

/** One way to pay: a heading and its details, in the same box style everywhere. */
const Way = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="space-y-2 rounded-lg border border-border p-4"><b className="block text-sm">{title}</b>{children}</div>
);

interface Page {
  business: { name: string; verified: boolean; slug: string; whatsapp: string };
  ref: string; client: string; amount: number; what: string; requestedOn: string; items: { name: string; qty: number; unitPrice: number }[]; expiresOn: string; status: PaymentStatus; attempts: number;
  rails: { key: Rail; label: string }[]; canSendProof: boolean;
  ways: { payshap?: { shapId: string }; eft?: { bank: string; accountName: string; accountNumber: string }; cash?: true; card_machine?: true; payfast?: true };
}

/** PayFast card or instant EFT. Only shown when ProofPocket's PayFast account is switched on (the API leaves it out otherwise). */
function PayFastSection({ path, headers }: { path: string; headers: Record<string, string> }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const pay = async () => {
    setErr(""); setBusy(true);
    try {
      const { host, fields } = await api<{ host: string; fields: Record<string, string> }>(`${path}/payfast/initiate`, { body: {}, headers });
      // PayFast takes a form POST; build it and send the client there.
      const form = Object.assign(document.createElement("form"), { method: "POST", action: `https://${host}/eng/process` });
      for (const [name, value] of Object.entries(fields)) form.append(Object.assign(document.createElement("input"), { type: "hidden", name, value }));
      document.body.append(form);
      form.submit();
    } catch (e) { setErr(e instanceof ApiError ? e.message : "PayFast didn't open. Try again, or use another way to pay."); setBusy(false); }
  };
  return (
    <Way title="Card or instant EFT (PayFast)">
      <p className="text-sm text-muted-foreground">You'll pay on PayFast's secure page. The business is told once PayFast confirms the payment.</p>
      {err && <Callout tone="bad" role="alert">{err}</Callout>}
      <Button disabled={busy} onClick={() => void pay()}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? "Opening PayFast…" : "Pay by card or EFT"}</Button>
    </Way>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const toast = useToast();
  const copy = async () => { try { await navigator.clipboard.writeText(value); toast("Copied"); } catch { toast(value); } };
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span><span className="min-w-0 flex-1 break-all font-mono">{value}</span>
      <Button type="button" size="sm" variant="outline" onClick={() => void copy()} aria-label={`Copy ${label.toLowerCase()}`}><ClipboardCopy className="h-4 w-4" />Copy</Button>
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
    <Card>
      <form onSubmit={submit} noValidate>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Paid? Send your proof of payment</CardTitle>
          <CardDescription>{page.business.name} checks it against their bank and confirms when the money is in.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Your name" value={f.payer} onChange={(e) => setF({ ...f, payer: e.target.value })} />
            <TextField label="Amount you paid (R)" type="number" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
            <TextField label="Date you paid" type="date" max={todayZA()} value={f.paidOn} onChange={(e) => setF({ ...f, paidOn: e.target.value })} />
            <NativeSelect label="Paid by" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value as Rail })}>{digital.map((r) => <option key={r.key} value={r.key}>{RAILS[r.key]}</option>)}</NativeSelect>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={f.usedReference} onChange={(e) => setF({ ...f, usedReference: e.target.checked })} />I used reference <span className="font-mono">{page.ref}</span></label>
          <div className="flex flex-wrap items-center gap-3">
            <FilePick label={file ? "Replace proof" : "Attach proof"} purpose="proof" base={path} headers={headers} primary={!file} onUploaded={(u) => setFile({ fileId: u.fileId, name: u.name })} onError={setErr} />
            {file && <span className="text-sm">{file.name}</span>}
          </div>
          {err && <Callout tone="bad" role="alert">{err}</Callout>}
          <Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? "Sending…" : "Send proof of payment"}</Button>
        </CardContent>
      </form>
    </Card>
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
    <PublicShell narrow>
      {payfastResult === "success" && <Callout tone="good"><b>Payment submitted to PayFast.</b> The business will be notified automatically once your payment is confirmed.</Callout>}
      {payfastResult === "cancelled" && <Callout tone="warn"><b>Payment cancelled.</b> You can try again below.</Callout>}
      {!m || q.isError ? <>
        <PageHeader title="Payment link not valid" />
        <Callout tone="bad" role="alert"><b>This payment link isn't valid.</b> Check that you copied the whole link, or ask the business to send it again.</Callout>
      </> : !q.data ? <Spinner /> : (() => {
        const p = q.data;
        const closed = ["paid", "cancelled", "expired", "flagged"].includes(p.status);
        return <>
          <PageHeader title={p.business.name} sub="You're paying this business directly. ProofPocket never holds your money." />
          <Card>
            <CardContent className="space-y-2 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-3xl font-bold tabular-nums">{R(p.amount)}</p>
                <LevelBadge verified={p.business.verified} />
              </div>
              {p.items.length > 0 && (
                <ul className="divide-y divide-border rounded-lg border border-border text-sm">
                  {p.items.map((i) => (
                    <li key={i.name} className="flex justify-between gap-3 px-3 py-2"><span>{i.qty} × {i.name} <span className="text-muted-foreground">@ {Rc(i.unitPrice)}</span></span><span className="tabular-nums">{Rc(Math.round(i.qty * i.unitPrice * 100) / 100)}</span></li>
                  ))}
                </ul>
              )}
              <p className="text-sm text-muted-foreground">{p.what || "Payment"} · reference <b className="font-mono text-foreground">{p.ref}</b> · requested {shortDate(p.requestedOn)}</p>
            </CardContent>
          </Card>
          {p.status === "paid" && <Callout tone="good"><b>Paid. Thank you.</b> {p.business.name} confirmed the money is in their account.</Callout>}
          {p.status === "checking" && <Callout tone="info"><b>Proof of payment sent.</b> {p.business.name} will confirm once the money shows in their bank. Open this link again to see when it's confirmed.</Callout>}
          {p.status === "not_received" && <Callout tone="warn">{p.business.name} hasn't received this payment yet. Check your bank, then upload your proof again.</Callout>}
          {p.status === "expired" && <Callout tone="warn">This request has expired. Ask {p.business.name} for a new link.</Callout>}
          {p.status === "cancelled" && <Callout tone="warn">{p.business.name} cancelled this request. Don't pay it.</Callout>}
          {p.status === "flagged" && <Callout tone="bad">This request is closed. Contact {p.business.name} directly.</Callout>}
          {!closed && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">How to pay</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {/* PayFast card/EFT — shown when the rail is included on this request */}
                {p.ways.payfast && <PayFastSection path={path} headers={headers} />}
                {p.ways.payshap && <Way title="PayShap"><CopyRow label="ShapID" value={p.ways.payshap.shapId} /><CopyRow label="Reference" value={p.ref} /></Way>}
                {p.ways.eft && <Way title="Bank EFT">
                  <CopyRow label="Bank" value={p.ways.eft.bank} /><CopyRow label="Account name" value={p.ways.eft.accountName} />
                  <CopyRow label="Account number" value={p.ways.eft.accountNumber} /><CopyRow label="Reference" value={p.ref} /></Way>}
                {p.ways.cash && <Way title="Cash"><p className="text-sm text-muted-foreground">Pay {p.business.name} in person and quote reference <span className="font-mono text-foreground">{p.ref}</span>. They will mark it paid.</p></Way>}
                {p.ways.card_machine && <Way title="Card machine"><p className="text-sm text-muted-foreground">Tap or insert your card on {p.business.name}'s card machine.</p></Way>}
                <Callout tone="warn"><b>Only pay to the details on this page.</b> If anyone sends you different bank details for {p.business.name}, don't pay. Check with the business first.</Callout>
              </CardContent>
            </Card>
          )}
          {p.canSendProof && <ProofForm page={p} path={path} headers={headers} onSent={() => { toast("Proof sent to the business. They'll confirm once the money is in."); void qc.invalidateQueries({ queryKey: ["pay", param] }); }} />}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Something wrong?</CardTitle><CardDescription>If this business asked you to pay in a way that felt unsafe, tell us.</CardDescription></CardHeader>
            <CardContent className="pt-0"><Button variant="destructive" onClick={() => void report()}><Flag className="h-4 w-4" />Report this request</Button></CardContent>
          </Card>
        </>;
      })()}
    </PublicShell>
  );
}
