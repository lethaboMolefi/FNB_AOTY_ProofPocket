// Fraud protection (v2/app.js vProtection), plus "Check a message" (inventory 12.2).
import { DOCS, shortDate, shortFingerprint, type DocType } from "@proofpocket/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Ban, CheckCircle2, Fingerprint, Flag, Search, ShieldCheck } from "lucide-react";
import { Fragment, useId, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TextField } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Spinner, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { FounderHead } from "./FounderHead";

interface Msg { id: string; sender: string; address: string; verified: boolean; body: string; flags: string[]; status: "open" | "blocked" | "safe"; date: string; kind: string }
interface Supplier { id: string; name: string; bank: string; pending: { bank: string; since: string } | null }
interface Data { messages: Msg[]; suppliers: Supplier[]; fingerprints: { docType: DocType; fileName: string | null; sha256: string; status: string }[] }

const SUB = "Scam warnings, holds on changed bank details, and a fingerprint of every document you upload.";
const RULES = [
  "Verified funders and incubators show a badge. Anyone else offering funding is a warning sign.",
  "Be wary of any request to pay a fee before money is released. Check with your adviser first.",
  "When a supplier changes bank details, ProofPocket holds payments until you confirm by phone.",
  "ProofPocket will never ask for your banking PIN, password or Google Authenticator code.",
];

function CheckMessage({ onDone }: { onDone: () => void }) {
  const textId = useId();
  const [f, setF] = useState({ sender: "", text: "" });
  const [res, setRes] = useState<{ flags: string[]; reports: number; confirmedScam: boolean } | null>(null);
  const [err, setErr] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr("");
    try { setRes(await api("/founder/check-message", { body: f })); onDone(); }
    catch (x) { setErr((x as ApiError).message); }
  };
  return (
    <Card>
      <form onSubmit={submit} noValidate>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Check a message</CardTitle>
          <CardDescription>Got a WhatsApp, SMS or email offering money or asking you to pay? Paste it here before you reply.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <TextField label="From (email address or number)" value={f.sender} onChange={(e) => setF({ ...f, sender: e.target.value })} />
          <div className="space-y-1.5">
            <Label htmlFor={textId}>The message</Label>
            <Textarea id={textId} rows={4} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} />
          </div>
          {err && <Callout tone="bad" role="alert">{err}</Callout>}
          <Button type="submit"><Search className="h-4 w-4" />Check it</Button>
          {res && (res.flags.length
            ? <Callout tone="bad">
                <b>{res.flags.length} warning sign{res.flags.length > 1 ? "s" : ""}. Don't pay and don't share codes.</b>
                <ul className="mt-1 list-disc pl-5">{res.flags.map((x) => <li key={x}>{x}</li>)}</ul>
                {res.reports > 0 && <span>{res.reports} founder{res.reports > 1 ? "s" : ""} reported this sender{res.confirmedScam ? ", and ProofPocket confirmed it's a scam" : ""}.</span>}
                <span> It's saved below so you can report it.</span>
              </Callout>
            : <Callout tone="good">No warning signs found. Still, never pay a fee to receive money, and check with your adviser if you're unsure.</Callout>)}
        </CardContent>
      </form>
    </Card>
  );
}

export default function Protection() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["founder", "protection"], queryFn: () => api<Data>("/founder/protection") });
  const refresh = () => qc.invalidateQueries({ queryKey: ["founder"] });
  const call = async (path: string, body: object = {}) => {
    try { toast((await api<{ message: string }>(path, { body })).message); void refresh(); }
    catch (e) { toast((e as ApiError).message); }
  };
  const changeBank = async (s: Supplier) => {
    const bank = window.prompt(`New bank for ${s.name} (as they told you)`);
    if (!bank) return;
    const acc = window.prompt("New account number (or its last 4 digits)");
    if (!acc) return;
    try { toast((await api<{ message: string }>(`/founder/suppliers/${s.id}/bank`, { method: "PUT", body: { bank, accountNumber: acc } })).message); void refresh(); }
    catch (e) { toast((e as ApiError).message); }
  };
  if (!q.data) return <><FounderHead title="Fraud protection" sub={SUB} /><Spinner /></>;
  const d = q.data;
  const needAttention = d.messages.filter((m) => m.status === "open" && !m.verified).length;
  const onHold = d.suppliers.filter((s) => s.pending).length;
  return (
    <>
      <FounderHead title="Fraud protection" sub={SUB} />
      {needAttention || onHold
        ? <Callout tone="bad">
            <b>{[needAttention && `${needAttention} unverified ${needAttention === 1 ? "message needs" : "messages need"} your attention`, onHold && `${onHold} supplier ${onHold === 1 ? "payment is" : "payments are"} on hold`].filter(Boolean).join(" · ")}.</b>{" "}
            Check before you pay anyone or share any banking details.
          </Callout>
        : <Callout tone="good">Nothing needs your attention right now.</Callout>}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Messages about money</CardTitle></CardHeader>
        <CardContent className="p-0 pb-2">
          {d.messages.length ? d.messages.map((m, i) => (
            <Fragment key={m.id}>
              {i > 0 && <Separator />}
              <div className="flex flex-col gap-3 px-6 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{m.sender}</span>
                    {m.verified ? <Badge variant="success">Verified on ProofPocket</Badge> : <Badge variant="destructive">Not verified</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground"><span className="font-mono">{m.address}</span> · {shortDate(m.date)}</p>
                  <p className="text-sm">“{m.body}”</p>
                  {m.flags.length > 0 && <div className="flex flex-wrap gap-1 pt-1">{m.flags.map((x) => <Badge key={x} variant="warning"><AlertTriangle className="mr-1 h-3 w-3" />{x}</Badge>)}</div>}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {m.status === "open" && !m.verified ? <>
                    <Button size="sm" variant="destructive" onClick={() => void call(`/founder/messages/${m.id}`, { action: "block" })}><Flag className="h-4 w-4" />Report and block</Button>
                    <Button size="sm" variant="outline" onClick={() => void call(`/founder/messages/${m.id}`, { action: "safe" })}>It's genuine</Button>
                  </> : m.status === "blocked" ? <Badge variant="outline"><Ban className="mr-1 h-3 w-3" />Reported and blocked</Badge>
                    : m.status === "safe" && !m.verified ? <Badge variant="outline">Marked genuine</Badge> : null}
                </div>
              </div>
            </Fragment>
          )) : <p className="px-6 pb-4 text-sm text-muted-foreground">No messages.</p>}
        </CardContent>
      </Card>

      <CheckMessage onDone={() => void refresh()} />

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Supplier bank details</CardTitle></CardHeader>
        <CardContent className="p-0 pb-2">
          {d.suppliers.length ? d.suppliers.map((s, i) => (
            <Fragment key={s.id}>
              {i > 0 && <Separator />}
              <div className="flex flex-col gap-3 px-6 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="text-sm"><span className="font-medium">{s.name}</span> · {s.bank}</div>
                  {s.pending
                    ? <p className="text-sm text-bad">New details received {shortDate(s.pending.since)}: {s.pending.bank}. Payments are on hold until you confirm by phone, on a number you already had.</p>
                    : <p className="text-xs text-muted-foreground">No changes</p>}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {s.pending ? <>
                    <Button size="sm" variant="outline" onClick={() => void call(`/founder/suppliers/${s.id}/confirm`)}>I've confirmed by phone</Button>
                    <Button size="sm" variant="destructive" onClick={() => void call(`/founder/suppliers/${s.id}/reject`)}>Reject change</Button>
                  </> : <>
                    <Badge variant="success">Unchanged</Badge>
                    <Button size="sm" variant="ghost" onClick={() => void changeBank(s)}>Supplier sent new details</Button>
                  </>}
                </div>
              </div>
            </Fragment>
          )) : <p className="px-6 pb-4 text-sm text-muted-foreground">No suppliers saved. Add one under Payments.</p>}
        </CardContent>
      </Card>

      <div className="grid gap-6 desktop:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Fingerprint className="h-4 w-4 text-primary" />Document fingerprints</CardTitle>
            <CardDescription>If a file is changed after it was checked, the fingerprint stops matching and funders are warned.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {d.fingerprints.length ? d.fingerprints.map((f) => (
              <div key={f.docType} className="flex items-center justify-between gap-3 text-sm">
                <span>{DOCS[f.docType].name}</span><span className="fp font-mono text-xs text-muted-foreground">{shortFingerprint(f.sha256)}</span>
              </div>
            )) : <p className="text-sm text-muted-foreground">No documents yet.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-primary" />Rules that keep you safe</CardTitle></CardHeader>
          <CardContent className="space-y-2.5">
            {RULES.map((t) => <div key={t} className="flex items-start gap-2.5 text-sm"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-good" /><span>{t}</span></div>)}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
