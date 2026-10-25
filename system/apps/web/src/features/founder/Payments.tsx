// Payments (v2/app.js vPayments). Clients pay the founder directly; ProofPocket records it and checks proofs.
import { PAYMENT_REQUEST_DAYS, R, RAILS, RAIL_KEYS, shortDate, todayZA, type PaymentStatus, type ProofCheck, type Rail } from "@proofpocket/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ClipboardCopy, FileText, Link2, Loader2, MessageCircle, QrCode, XCircle } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect, TextField } from "@/components/ui/field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Spinner, useToast } from "../../components/ui";
import { API_BASE, ApiError, api } from "../../lib/api";
import { useMe } from "../../lib/me";
import { enqueue } from "../../lib/outbox";
import { CodeInput } from "../auth/TwoFactor";
import { FounderHead } from "./FounderHead";

interface Proof { id: string; payer: string; amount: number; paidOn: string; method: Rail; usedReference: boolean; fileId: string | null; checks: ProofCheck[] }
interface Req { id: string; ref: string; client: string; amount: number; what: string; rails: Rail[]; status: PaymentStatus; attempts: number; requestedOn: string; expiresOn: string; link: string; proof: Proof | null }
interface Supplier { id: string; name: string; bank: string; pending: { bank: string; since: string } | null }
interface PayData {
  requests: Req[]; suppliers: Supplier[]; authenticatorOn: boolean; payfastEnabled: boolean; businessType: string;
  details: { bank: string; accountName: string; accountMasked: string; shapId: string; inBusinessName: boolean | null } | null;
}

const SUB = "Clients pay you directly with the methods they already use. They upload proof of payment, and you confirm once the money is in your account.";
type Variant = "secondary" | "warning" | "success" | "destructive" | "outline";
const STATUS: Record<PaymentStatus, [Variant, string]> = {
  waiting: ["secondary", "Waiting for client"], checking: ["warning", "Proof to check"], paid: ["success", "Paid · in books"], not_received: ["destructive", "Not received"],
  flagged: ["destructive", "Flagged: possible fake proof"], expired: ["outline", "Expired"], cancelled: ["outline", "Cancelled"],
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
    <div className={cn("popbox space-y-3 rounded-lg border p-4", failed ? "border-warn/40 bg-warn-soft/40" : "border-line bg-surface")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <b className="text-sm">{r.client} says they paid {R(p.amount)}</b>
        {failed ? <Badge variant="warning">{failed} {failed === 1 ? "thing" : "things"} to check</Badge> : <Badge variant="success">Details match</Badge>}
      </div>
      <p className="text-xs text-muted-foreground">For {r.what || "payment"} · reference <span className="font-mono">{r.ref}</span> · {RAILS[p.method]} on {shortDate(p.paidOn)} · from {p.payer}</p>
      <ul className="space-y-1.5">{p.checks.map((c) => (
        <li key={c.code} className="flex items-start gap-2 text-sm">
          {c.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-good" aria-label="Passed" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-bad" aria-label="Failed" />}
          <span>{c.text}</span>
        </li>
      ))}</ul>
      <Callout tone="warn">A proof of payment can be faked. Open your banking app and check the money is really in your account before you hand anything over.</Callout>
      {err && <Callout tone="bad" role="alert">{err}</Callout>}
      <div className="flex flex-wrap gap-2">
        {p.fileId && <Button size="sm" variant="outline" onClick={() => void open()}><FileText className="h-4 w-4" />Open proof</Button>}
        <Button size="sm" onClick={() => void act("confirm")}><CheckCircle2 className="h-4 w-4" />The money is in my account</Button>
        <Button size="sm" variant="destructive" onClick={() => void act("reject")}>Not received</Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- ask a client to pay
function NewRequest({ business, payfastOn }: { business: string; payfastOn: boolean }) {
  const toast = useToast();
  const refresh = useRefresh();
  const [f, setF] = useState({ client: "", amount: "", what: "", rails: ["payshap", "eft", "cash"] as Rail[] });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<{ ref: string; link: string; client: string; amount: number; what: string } | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr("");
    if (!f.client.trim() || !Number(f.amount)) { setErr("Add the client's name and an amount"); return; }
    if (!f.rails.length) { setErr("Choose at least one way to pay"); return; }
    setBusy(true);
    try {
      const r = await api<{ ref: string; link: string; message: string }>("/founder/payment-requests", { body: { client: f.client, amount: Number(f.amount), what: f.what, rails: f.rails } });
      toast(r.message); setMade({ ...r, client: f.client, amount: Number(f.amount), what: f.what });
      setF({ ...f, client: "", amount: "", what: "" }); void refresh();
    } catch (x) { setErr((x as ApiError).message); }
    finally { setBusy(false); }
  };
  const toggle = (k: Rail) => setF({ ...f, rails: f.rails.includes(k) ? f.rails.filter((x) => x !== k) : [...f.rails, k] });
  return (
    <Card>
      <form onSubmit={submit} noValidate>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ask a client to pay</CardTitle>
          <CardDescription>The link works for {PAYMENT_REQUEST_DAYS} days and shows only your saved payment details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Client" value={f.client} onChange={(e) => setF({ ...f, client: e.target.value })} placeholder="e.g. Thandi Mokoena" />
            <TextField label="Amount (R)" type="number" min={1} inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
            <TextField label="For" className="sm:col-span-2" placeholder="e.g. Lash fill" value={f.what} onChange={(e) => setF({ ...f, what: e.target.value })} />
          </div>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Ways the client can pay</legend>
            <div className="flex flex-wrap gap-2">{RAIL_KEYS.map((k) => {
              const off = k === "payfast" && !payfastOn;
              return (
                <Button key={k} type="button" size="sm" variant={f.rails.includes(k) ? "default" : "outline"} aria-pressed={f.rails.includes(k)} disabled={off} onClick={() => toggle(k)}
                  aria-describedby={off ? "payfast-off" : undefined}
                  className={cn("rounded-full", !f.rails.includes(k) && "text-muted-foreground")}>
                  {RAILS[k]}
                </Button>
              );
            })}</div>
            {!payfastOn && <p id="payfast-off" className="mt-1.5 text-xs text-muted-foreground">Card and instant EFT through PayFast will be available once ProofPocket's PayFast account is approved.</p>}
          </fieldset>
          {err && <Callout tone="bad" role="alert">{err}</Callout>}
          <div className="flex justify-end">
            <Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Create payment request</Button>
          </div>
          {made && <Share req={made} business={business} />}
        </CardContent>
      </form>
    </Card>
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
    <div className="space-y-2 rounded-lg border border-good/30 bg-good-soft/50 p-3">
      <span className="fp block break-all font-mono text-xs">{req.link}</span>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" asChild><a href={`https://wa.me/?text=${encodeURIComponent(waText(business, req))}`} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4" />Send on WhatsApp</a></Button>
        <Button type="button" size="sm" variant="outline" onClick={() => void showQr()}><QrCode className="h-4 w-4" />{qr ? "Hide QR" : "Show QR"}</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => void copy()}><ClipboardCopy className="h-4 w-4" />Copy link</Button>
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
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">Payment requests</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="hidden md:table-cell">Methods</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.requests.map((r) => {
              const live = r.status === "waiting" || r.status === "not_received";
              return [
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{r.client}</div>
                    <div className="text-xs text-muted-foreground"><span className="font-mono">{r.ref}</span> · {r.what || "Payment"} · {live ? `link works until ${shortDate(r.expiresOn)}` : shortDate(r.requestedOn)}</div>
                    {r.status === "not_received" && <div className="mt-1 text-xs text-bad">You said the money didn't arrive. The client can upload proof once more.</div>}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{R(r.amount)}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">{r.rails.map((x) => <Badge key={x} variant="outline" className="text-[10px]">{RAILS[x]}</Badge>)}</div>
                  </TableCell>
                  <TableCell><Badge variant={STATUS[r.status][0]}>{STATUS[r.status][1]}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {live && <Button size="sm" variant="outline" onClick={() => setOpen(open === r.id ? null : r.id)}><Link2 className="h-4 w-4" />{open === r.id ? "Hide link" : "Link & QR"}</Button>}
                      {r.rails.includes("cash") && (live || r.status === "expired") && <Button size="sm" variant="outline" onClick={() => void act(r, "cash")}>Paid me cash</Button>}
                      {live && <Button size="sm" variant="ghost" onClick={() => void act(r, "cancel")}>Cancel</Button>}
                    </div>
                  </TableCell>
                </TableRow>,
                open === r.id && (
                  <TableRow key={`${r.id}-share`} className="hover:bg-transparent">
                    <TableCell colSpan={5}><Share req={r} business={business} /></TableCell>
                  </TableRow>
                ),
              ];
            })}
            {!data.requests.length && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No payment requests yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div className="space-y-1.5">
          <CardTitle className="text-base">Your payment details</CardTitle>
          <CardDescription>Shown to clients on your payment page. Changing them needs a code from Google Authenticator, and your adviser is told, so nobody can quietly redirect your payments.</CardDescription>
        </div>
        {!edit && data.authenticatorOn && <Button size="sm" variant="outline" onClick={() => setEdit(true)}>Change</Button>}
      </CardHeader>
      <CardContent className="space-y-3">
        {d ? (
          <div className="rounded-lg border border-line bg-surface-2 p-3 text-sm">
            <div><span className="font-medium">{d.bank}</span> · {d.accountName} · <span className="font-mono">{d.accountMasked}</span></div>
            {d.shapId && <div className="mt-1 text-muted-foreground">PayShap ShapID <span className="font-mono text-foreground">{d.shapId}</span></div>}
          </div>
        ) : <p className="text-sm text-muted-foreground">No payment details yet. Clients can only pay cash or by card machine until you add them.</p>}
        {personal && <Callout tone="warn">This looks like a personal account. Funders and buyers expect payments into an account in the business's name. Keep business and personal money apart.</Callout>}
        {!data.authenticatorOn && (
          <Callout tone="info" action={<Button size="sm" asChild><Link to="/app/settings">Set up</Link></Button>}>
            To add or change payment details, first set up <b>Google Authenticator</b> in Business settings.
          </Callout>
        )}
        {edit && (
          <form className="space-y-3" noValidate onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Bank" value={f.bank} onChange={(e) => setF({ ...f, bank: e.target.value })} />
              <TextField label="Account name" value={f.accountName} onChange={(e) => setF({ ...f, accountName: e.target.value })} />
              <TextField label="Account number" inputMode="numeric" autoComplete="off" value={f.accountNumber} onChange={(e) => setF({ ...f, accountNumber: e.target.value })} />
              <TextField label="PayShap ShapID (optional)" value={f.shapId} onChange={(e) => setF({ ...f, shapId: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={f.inBusinessName} onChange={(e) => setF({ ...f, inBusinessName: e.target.checked })} />This account is in the business's name</label>
            <CodeInput value={f.code} onChange={(code) => setF({ ...f, code })} />
            {save.error && <Callout tone="bad" role="alert">{(save.error as ApiError).message}</Callout>}
            <div className="flex gap-2">
              <Button type="submit" disabled={f.code.length !== 6 || save.isPending}>{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Save payment details</Button>
              <Button type="button" variant="ghost" onClick={() => setEdit(false)}>Cancel</Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
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
    <div className="grid gap-6 desktop:grid-cols-2">
      <div className="space-y-6">
        <Card>
          <form onSubmit={paySupplier} noValidate>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Record a supplier payment</CardTitle>
              <CardDescription>Pay in your own banking app first, then record it here. ProofPocket never moves money.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <NativeSelect label="Supplier" value={sp.supplierId} onChange={(e) => setSp({ ...sp, supplierId: e.target.value })}>
                {data.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.bank}{s.pending ? " · ON HOLD" : ""}</option>)}
              </NativeSelect>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label="Amount (R)" type="number" min={1} value={sp.amount} onChange={(e) => setSp({ ...sp, amount: e.target.value })} />
                <TextField label="For" value={sp.what} onChange={(e) => setSp({ ...sp, what: e.target.value })} />
              </div>
              {err.sp && <Callout tone="bad" role="alert">{err.sp}</Callout>}
              <Button type="submit" disabled={!data.suppliers.length}>Record payment</Button>
            </CardContent>
          </form>
        </Card>
        <Card>
          <form onSubmit={addSupplier} noValidate>
            <CardHeader className="pb-3"><CardTitle as="h3" className="text-base">Add a supplier</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label="Supplier" value={ns.name} onChange={(e) => setNs({ ...ns, name: e.target.value })} />
                <TextField label="Bank" value={ns.bank} onChange={(e) => setNs({ ...ns, bank: e.target.value })} />
                <TextField label="Account number (or last 4 digits)" className="sm:col-span-2" inputMode="numeric" hint="Only the last four digits are kept." value={ns.accountNumber} onChange={(e) => setNs({ ...ns, accountNumber: e.target.value })} />
              </div>
              {err.ns && <Callout tone="bad" role="alert">{err.ns}</Callout>}
              <Button type="submit" variant="outline">Save supplier</Button>
            </CardContent>
          </form>
        </Card>
      </div>
      <Card className="self-start">
        <form onSubmit={payCash} noValidate>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Record a cash payment out</CardTitle>
            <CardDescription>For collectors, casual workers and anyone you pay in cash. Works offline.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Paid to" value={cash.name} onChange={(e) => setCash({ ...cash, name: e.target.value })} />
              <TextField label="Amount (R)" type="number" min={1} value={cash.amount} onChange={(e) => setCash({ ...cash, amount: e.target.value })} />
              <TextField label="For" className="sm:col-span-2" placeholder="e.g. PET bottles, 17 kg" value={cash.what} onChange={(e) => setCash({ ...cash, what: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={cash.noPhone} onChange={(e) => setCash({ ...cash, noPhone: e.target.checked })} />Payee has no phone, give a slip number</label>
            {err.cash && <Callout tone="bad" role="alert">{err.cash}</Callout>}
            <Button type="submit">Record cash payment</Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}

export default function Payments() {
  const me = useMe().data;
  const q = useQuery({ queryKey: ["founder", "payments"], queryFn: () => api<PayData>("/founder/payments") });
  if (!q.data) return <><FounderHead title="Payments" sub={SUB} />{q.isError ? <Callout tone="bad">Couldn't load payments. Check your connection.</Callout> : <Spinner />}</>;
  const d = q.data, business = me?.company?.name ?? "";
  const toCheck = d.requests.filter((r) => r.proof);
  return (
    <>
      <FounderHead title="Payments" sub={SUB} />
      <Callout tone="info"><b>ProofPocket never holds your money.</b> Clients pay you straight into your account, by card machine or in cash. ProofPocket records each payment and helps you spot fake proofs of payment.</Callout>
      {toCheck.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Proof of payment to check</CardTitle></CardHeader>
          <CardContent className="space-y-3">{toCheck.map((r) => <ProofBox key={r.id} r={r} />)}</CardContent>
        </Card>
      )}
      <div className="grid gap-6 desktop:grid-cols-2">
        <NewRequest business={business} payfastOn={d.payfastEnabled} />
        <Details key={JSON.stringify(d.details)} data={d} />
      </div>
      <Requests data={d} business={business} />
      <MoneyOut key={d.suppliers.map((s) => s.id).join()} data={d} />
    </>
  );
}
