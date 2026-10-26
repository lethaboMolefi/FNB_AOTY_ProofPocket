// Admin: reports, feature requests, flagged payments and the sender watch list, tenders and requests.
import { DOCS, FUNDER_REQUIRABLE_DOCS, R, SECTORS, shortDate, todayZA, type DocType } from "@proofpocket/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, Flag, Gavel, Megaphone, MailWarning, Send, ShieldAlert, Star, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TextField } from "@/components/ui/field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "../../components/EmptyState";
import { ListRow, RowHint } from "../../components/ListRow";
import { PageHeader } from "../../components/PageHeader";
import { ToggleChips } from "../../components/ToggleChips";
import { ToneBadge } from "../../components/ToneBadge";
import { Spinner, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { RequestRow } from "../adviser/Support";

function useCall() {
  const qc = useQueryClient();
  const toast = useToast();
  return async (path: string, body: object, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    try { toast((await api<{ message: string }>(path, { body })).message); void qc.invalidateQueries({ queryKey: ["admin"] }); }
    catch (e) { toast((e as ApiError).message); }
  };
}
const day = (iso: string) => shortDate(iso.slice(0, 10));

export function Reports() {
  const call = useCall();
  const q = useQuery({ queryKey: ["admin", "reports"], queryFn: () => api<{ reports: { id: string; target: string; company: string | null; reason: string; status: string; note: string | null; date: string }[] }>("/admin/reports") });
  const head = <PageHeader title="Reports" sub="Businesses and payment requests reported by the public and founders. ProofPocket promises a review within two working days." />;
  if (!q.data) return <>{head}<Spinner /></>;
  return (
    <>
      {head}
      <Card><CardContent className="pt-2">{q.data.reports.length ? <ul>{q.data.reports.map((r) => (
        <ListRow key={r.id} side={r.status === "open" ? <>
          <Button size="sm" onClick={() => { const note = window.prompt("What did you do?") ?? ""; void call(`/admin/reports/${r.id}`, { status: "resolved", note }); }}><CheckCircle2 className="h-4 w-4" />Resolve</Button>
          <Button size="sm" variant="outline" onClick={() => void call(`/admin/reports/${r.id}`, { status: "dismissed", note: "" })}><X className="h-4 w-4" />Dismiss</Button>
        </> : <ToneBadge tone={r.status === "resolved" ? "good" : "plain"}>{r.status === "resolved" ? "Resolved" : "Dismissed"}</ToneBadge>}>
          <p><b>{r.company ?? "Unknown"}</b> · {r.target === "payment_request" ? "payment request" : r.target === "data_request" ? "data request (reply within 30 days)" : r.target}</p>
          <p>{r.reason || "No reason given"}</p>
          <RowHint>{day(r.date)}{r.note ? ` · ${r.note}` : ""}</RowHint>
        </ListRow>
      ))}</ul> : <EmptyState icon={Flag}>No reports.</EmptyState>}</CardContent></Card>
    </>
  );
}

export function Features() {
  const call = useCall();
  const q = useQuery({ queryKey: ["admin", "features"], queryFn: () => api<{ posts: { id: string; company: string; verified: boolean; text: string; date: string; feature: string; featuredUntil: string | null }[] }>("/admin/features") });
  const head = <PageHeader title="Feature requests" sub="Posts Verified businesses asked to feature in the directory. Featured posts show for 7 days. Reject anything misleading or harmful." />;
  if (!q.data) return <>{head}<Spinner /></>;
  return (
    <>
      {head}
      <Card><CardContent className="pt-2">{q.data.posts.length ? <ul>{q.data.posts.map((p) => (
        <ListRow key={p.id} side={p.feature === "requested" ? <>
          <Button size="sm" onClick={() => void call(`/admin/features/${p.id}`, { approve: true })}><Star className="h-4 w-4" />Feature</Button>
          <Button size="sm" variant="outline" onClick={() => { const note = window.prompt("Reason the founder will see") ?? ""; void call(`/admin/features/${p.id}`, { approve: false, note }); }}><X className="h-4 w-4" />Reject</Button>
        </> : <ToneBadge tone="good">Featured{p.featuredUntil ? ` until ${shortDate(p.featuredUntil)}` : ""}</ToneBadge>}>
          <p className="flex flex-wrap items-center gap-2"><b>{p.company}</b>{!p.verified && <ToneBadge tone="warn">No longer verified</ToneBadge>}</p>
          <p>“{p.text}”</p>
          <RowHint>{shortDate(p.date)}</RowHint>
        </ListRow>
      ))}</ul> : <EmptyState icon={Megaphone}>No feature requests.</EmptyState>}</CardContent></Card>
    </>
  );
}

export function Flagged() {
  const call = useCall();
  const q = useQuery({ queryKey: ["admin", "flagged"], queryFn: () => api<{ payments: { id: string; ref: string; company: string; client: string; amount: number; attempts: number; date: string }[]; watchlist: { id: string; sender: string; reports: number; status: string; last: string }[] }>("/admin/flagged") });
  const head = <PageHeader title="Flagged payments" sub="Payment requests where a founder rejected the proof of payment twice, and senders founders reported." />;
  if (!q.data) return <>{head}<Spinner /></>;
  return (
    <>
      {head}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><ShieldAlert className="h-4 w-4 text-primary" aria-hidden="true" />Possible fake proofs of payment</CardTitle></CardHeader>
        <CardContent className="pt-0">{q.data.payments.length ? <ul>{q.data.payments.map((p) => (
          <ListRow key={p.id} side={<RowHint>{day(p.date)}</RowHint>}>
            <p><b>{p.company}</b> · <span className="font-mono">{p.ref}</span></p>
            <p>{p.client} · {R(p.amount)} · {p.attempts} proofs rejected</p>
          </ListRow>
        ))}</ul> : <EmptyState icon={ShieldAlert}>None.</EmptyState>}</CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><MailWarning className="h-4 w-4 text-primary" aria-hidden="true" />Reported senders</CardTitle></CardHeader>
        <CardContent className="pt-0">{q.data.watchlist.length ? <ul>{q.data.watchlist.map((w) => (
          <ListRow key={w.id} side={w.status === "watch" ? <>
            <Button size="sm" variant="destructive" onClick={() => void call(`/admin/watchlist/${w.id}`, { status: "confirmed_scam" })}><Ban className="h-4 w-4" />Confirm scam</Button>
            <Button size="sm" variant="outline" onClick={() => void call(`/admin/watchlist/${w.id}`, { status: "cleared" })}><CheckCircle2 className="h-4 w-4" />Clear</Button>
          </> : <ToneBadge tone={w.status === "confirmed_scam" ? "bad" : "plain"}>{w.status === "confirmed_scam" ? "Confirmed scam" : "Cleared"}</ToneBadge>}>
            <p className="font-mono">{w.sender}</p>
            <RowHint>{w.reports} report{w.reports > 1 ? "s" : ""} · last {day(w.last)}</RowHint>
          </ListRow>
        ))}</ul> : <EmptyState icon={MailWarning}>None.</EmptyState>}</CardContent>
      </Card>
    </>
  );
}

export function Tenders() {
  const call = useCall();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "tenders"], queryFn: () => api<{ tenders: { id: string; title: string; buyer: string; value: number; closesOn: string; minMonths: number; sectors: string[]; requiredDocs: DocType[]; interested: number }[]; requests: { kind: "intro" | "tender"; id: string; company: string; about: string; status: string }[] }>("/admin/tenders") });
  const [f, setF] = useState({ title: "", buyerName: "", value: "", closesOn: "", minMonths: "3", sectors: [] as string[], requiredDocs: ["tax"] as DocType[] });
  const [err, setErr] = useState("");
  const all = [...new Set(Object.values(SECTORS).flat())];
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr("");
    try { toast((await api<{ message: string }>("/admin/tenders", { body: { ...f, value: Number(f.value), minMonths: Number(f.minMonths) } })).message); setF({ ...f, title: "", buyerName: "", value: "" }); void qc.invalidateQueries({ queryKey: ["admin"] }); }
    catch (x) { setErr((x as ApiError).message); }
  };
  const head = <PageHeader title="Tenders & buyers" sub="Opportunities founders can express interest in. Buyers are organisations; add them under Organisations." />;
  if (!q.data) return <>{head}<Spinner /></>;
  return (
    <>
      {head}
      <Card>
        <form onSubmit={submit} noValidate>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Gavel className="h-4 w-4 text-primary" aria-hidden="true" />Publish a tender</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField className="sm:col-span-2" label="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
              <TextField label="Buyer" value={f.buyerName} onChange={(e) => setF({ ...f, buyerName: e.target.value })} />
              <TextField label="Value (R)" type="number" min={1} value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} />
              <TextField label="Closes" type="date" min={todayZA()} value={f.closesOn} onChange={(e) => setF({ ...f, closesOn: e.target.value })} />
              <TextField label="Months of records" type="number" min={0} max={36} value={f.minMonths} onChange={(e) => setF({ ...f, minMonths: e.target.value })} />
            </div>
            <ToggleChips legend="Sectors" options={all.map((s) => ({ value: s, label: s }))} value={f.sectors} onChange={(sectors) => setF({ ...f, sectors })} />
            <ToggleChips legend="Documents needed" options={FUNDER_REQUIRABLE_DOCS.map((k) => ({ value: k, label: DOCS[k].short }))} value={f.requiredDocs} onChange={(requiredDocs) => setF({ ...f, requiredDocs })} />
            {err && <Callout tone="bad" role="alert">{err}</Callout>}
            <Button type="submit"><Send className="h-4 w-4" />Publish</Button>
          </CardContent>
        </form>
      </Card>
      {q.data.requests.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Requests from companies without an incubator</CardTitle></CardHeader>
          <CardContent className="pt-0"><ul>
            {q.data.requests.map((r) => <RequestRow key={r.id} text={<><b>{r.company}</b> {r.kind === "intro" ? `asked to meet ${r.about}` : `is interested in “${r.about}”`}</>} status={r.status} onDecide={(s) => void call(`/admin/${r.kind}s/${r.id}`, { status: s })} />)}
          </ul></CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="p-0">
          {q.data.tenders.length ? (
            <Table>
              <TableHeader><TableRow><TableHead>Tender</TableHead><TableHead className="text-right">Value</TableHead><TableHead className="hidden sm:table-cell">Closes</TableHead><TableHead className="hidden md:table-cell">Needs</TableHead><TableHead className="text-right">Interested</TableHead></TableRow></TableHeader>
              <TableBody>{q.data.tenders.map((t) => (
                <TableRow key={t.id}>
                  <TableCell><div className="font-medium">{t.title}</div><div className="text-xs text-muted-foreground">{t.buyer} · {t.sectors.join(", ")}</div><div className="text-xs text-muted-foreground sm:hidden">Closes {shortDate(t.closesOn)}</div></TableCell>
                  <TableCell className="text-right tabular-nums">{R(t.value)}</TableCell>
                  <TableCell className="hidden tabular-nums sm:table-cell">{shortDate(t.closesOn)}{t.closesOn < todayZA() && <div className="text-xs text-muted-foreground">Closed</div>}</TableCell>
                  <TableCell className="hidden text-sm md:table-cell">{t.requiredDocs.map((k) => DOCS[k].short).join(", ")} · {t.minMonths} months</TableCell>
                  <TableCell className="text-right tabular-nums">{t.interested}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          ) : <EmptyState icon={Gavel}>No tenders yet. Publish one above.</EmptyState>}
        </CardContent>
      </Card>
    </>
  );
}
