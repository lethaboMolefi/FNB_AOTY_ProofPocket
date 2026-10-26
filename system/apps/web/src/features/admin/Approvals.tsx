// User approvals: everyone who isn't a founder. Applications (pending, rejected) can be approved or turned down;
// accounts can be suspended and reinstated. Founders never appear; other admins and yourself are read-only.
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Check, RotateCcw, UserCheck, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect, TextField } from "@/components/ui/field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader } from "../../components/PageHeader";
import { ToneBadge } from "../../components/ToneBadge";
import { Spinner, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { qs, when } from "./when";

type Status = "pending" | "approved" | "rejected" | "suspended";
interface Item { type: "application" | "user"; id: string; name: string; email: string; role: string; organisation: string | null; registeredAt: string; status: Status; canAct: boolean }
interface Detail extends Omit<Item, "status"> { status: string; reason: string | null; decidedAt: string | null; details: Record<string, unknown> }

const SUB = "Everyone who isn't a founder: approve or turn down applications, and suspend accounts that shouldn't have access. Founders aren't managed here.";
const TONE = { pending: "warn", approved: "good", rejected: "bad", suspended: "bad" } as const;
const ROLE: Record<string, string> = { funder: "Funder", adviser: "Adviser (incubator or NGO)", buyer: "Buyer", admin: "Admin" };
const nice = (s: string) => s.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const show = (v: unknown) => (Array.isArray(v) ? v.join(", ") : typeof v === "boolean" ? (v ? "Yes" : "No") : v == null || v === "" ? "—" : String(v));

function DetailPanel({ item, onClose }: { item: Item; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["admin", "approval", item.type, item.id], queryFn: () => api<Detail>(`/admin/approvals/${item.type}/${item.id}`) });
  const [mode, setMode] = useState<"reject" | "suspend" | null>(null);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const done = (message: string) => { toast(message); setMode(null); setReason(""); void qc.invalidateQueries({ queryKey: ["admin"] }); };
  const call = async (path: string, body: object, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setErr("");
    try { done((await api<{ message: string }>(path, { body })).message); } catch (x) { setErr(x instanceof ApiError ? x.message : "Try again."); }
  };
  const submitReason = (e: FormEvent) => {
    e.preventDefault();
    if (mode === "reject") void call(`/admin/approvals/application/${item.id}`, { decision: "reject", reason });
    else void call(`/admin/approvals/user/${item.id}/suspend`, { reason });
  };
  const d = q.data;
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-base">{item.name}</CardTitle>
          <CardDescription className="break-all">{item.email} · {ROLE[item.role] ?? item.role}{item.organisation && ` · ${item.organisation}`}</CardDescription>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}><X className="h-4 w-4" />Close</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {!d ? (q.isError ? <Callout tone="bad">{(q.error as ApiError).message}</Callout> : <Spinner />) : <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <ToneBadge tone={TONE[d.status as Status] ?? "plain"}>{nice(d.status)}</ToneBadge>
            <span className="text-muted-foreground">Registered {when(d.registeredAt)}{d.decidedAt && ` · ${d.status === "suspended" ? "suspended" : "decided"} ${when(d.decidedAt)}`}</span>
          </div>
          {d.reason && <Callout tone={d.status === "approved" ? "info" : "bad"}><b>Reason:</b> {d.reason}</Callout>}
          <dl className="grid grid-cols-[minmax(0,1fr)] gap-x-4 gap-y-2 text-sm sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
            {Object.entries(d.details).filter(([, v]) => v !== undefined).map(([k, v]) => (
              <div key={k} className="contents"><dt className="text-muted-foreground">{nice(k)}</dt><dd className="break-words">{show(v)}</dd></div>
            ))}
          </dl>
          {!d.canAct ? (
            <p className="text-sm text-muted-foreground">{item.role === "admin" ? "Admin accounts can't be changed here." : "No action needed."}</p>
          ) : mode ? (
            <form className="space-y-3" onSubmit={submitReason} noValidate>
              <Label htmlFor="ap-reason">{mode === "reject" ? "Why it's turned down (the applicant sees this)" : "Why it's suspended (the person sees this)"}</Label>
              <Textarea id="ap-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
              {err && <Callout tone="bad" role="alert">{err}</Callout>}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="destructive" disabled={reason.trim().length < 10}>{mode === "reject" ? "Turn down" : "Suspend"}</Button>
                <Button type="button" variant="ghost" onClick={() => { setMode(null); setErr(""); }}>Cancel</Button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              {err && <Callout tone="bad" role="alert">{err}</Callout>}
              <div className="flex flex-wrap gap-2">
                {item.type === "application" && <>
                  <Button onClick={() => void call(`/admin/approvals/application/${item.id}`, { decision: "approve" }, `Approve ${item.organisation}? This creates their portal and account.`)}><Check className="h-4 w-4" />Approve</Button>
                  <Button variant="outline" onClick={() => setMode("reject")}><X className="h-4 w-4" />Reject</Button>
                </>}
                {item.type === "user" && (d.status === "suspended"
                  ? <Button variant="outline" onClick={() => void call(`/admin/approvals/user/${item.id}/reinstate`, {})}><RotateCcw className="h-4 w-4" />Reinstate</Button>
                  : <Button variant="destructive" onClick={() => setMode("suspend")}><Ban className="h-4 w-4" />Suspend</Button>)}
              </div>
            </div>
          )}
        </>}
      </CardContent>
    </Card>
  );
}

export default function Approvals() {
  const [form, setForm] = useState({ q: "", role: "", status: "" });
  const [f, setF] = useState(form);
  const [open, setOpen] = useState<Item | null>(null);
  const q = useQuery({ queryKey: ["admin", "approvals", f], queryFn: () => api<{ items: Item[] }>(`/admin/approvals?${qs(f)}`), placeholderData: keepPreviousData });
  return (
    <>
      <PageHeader title="User approvals" sub={SUB} />
      <Card>
        <CardContent className="pt-6">
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end" onSubmit={(e) => { e.preventDefault(); setF(form); }} noValidate>
            <TextField label="Search" placeholder="Name, email or organisation" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} />
            <NativeSelect label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="">All</option><option value="funder">Funder</option><option value="adviser">Adviser</option><option value="buyer">Buyer</option><option value="admin">Admin</option>
            </NativeSelect>
            <NativeSelect label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="">All</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="suspended">Suspended</option>
            </NativeSelect>
            <Button type="submit" variant="outline">Filter</Button>
          </form>
        </CardContent>
      </Card>
      {open && <DetailPanel key={`${open.type}-${open.id}`} item={open} onClose={() => setOpen(null)} />}
      <Card>
        <CardContent className="p-0">
          {!q.data ? <Spinner /> : !q.data.items.length ? <EmptyState icon={UserCheck}>No one matches.</EmptyState> : (
            <Table>
              <TableHeader><TableRow><TableHead>Person</TableHead><TableHead className="hidden md:table-cell">Role</TableHead><TableHead className="hidden lg:table-cell">Registered</TableHead><TableHead>Status</TableHead><TableHead><span className="sr-only">Open</span></TableHead></TableRow></TableHeader>
              <TableBody>{q.data.items.map((i) => (
                <TableRow key={`${i.type}-${i.id}`}>
                  <TableCell className="break-all"><span className="block font-medium">{i.name}</span><span className="text-xs text-muted-foreground">{i.email}</span>
                    <span className="block text-xs text-muted-foreground">{i.organisation ?? ""}<span className="md:hidden">{i.organisation ? " · " : ""}{ROLE[i.role] ?? i.role}</span></span></TableCell>
                  <TableCell className="hidden md:table-cell">{ROLE[i.role] ?? i.role}</TableCell>
                  <TableCell className="hidden whitespace-nowrap tabular-nums lg:table-cell">{when(i.registeredAt)}</TableCell>
                  <TableCell><ToneBadge tone={TONE[i.status]}>{nice(i.status)}</ToneBadge></TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => setOpen(i)}>Open</Button></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
