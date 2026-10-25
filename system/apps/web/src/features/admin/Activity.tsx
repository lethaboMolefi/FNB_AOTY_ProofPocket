// Admin activity: the audit log, newest first, with filters and the hash-chain check.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { Fragment, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent } from "@/components/ui/card";
import { NativeSelect, TextField } from "@/components/ui/field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader } from "../../components/PageHeader";
import { ToneBadge } from "../../components/ToneBadge";
import { Spinner } from "../../components/ui";
import { api } from "../../lib/api";
import { qs, when } from "./when";

interface Entry { id: string; at: string; role: string | null; person: string | null; action: string; entity: string; entityId: string | null; company: string | null; before: unknown; after: unknown }
interface Data { page: number; more: boolean; entries: Entry[]; actionGroups: string[]; chain: { rowsChecked: number; intact: boolean; firstBroken: number | null } | null }

const SUB = "Everything that changed, who did it and when. The log can only be added to, and each row is chained to the one before.";
const EMPTY = { action: "", person: "", company: "", from: "", to: "" };

export default function Activity() {
  const [form, setForm] = useState(EMPTY);
  const [filters, setFilters] = useState(EMPTY);
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["admin", "activity", filters, page], queryFn: () => api<Data>(`/admin/activity?${qs({ ...filters, page })}`), placeholderData: keepPreviousData });
  const chainQ = useQuery({ queryKey: ["admin", "activity", "chain"], queryFn: () => api<Data>("/admin/activity").then((d) => d.chain) });
  const apply = (e: FormEvent) => { e.preventDefault(); setFilters(form); setPage(0); };
  const c = chainQ.data;
  return (
    <>
      <PageHeader label="ProofPocket admin" title="Activity" sub={SUB} />
      {c && (c.intact
        ? <Callout tone="good" role="status">Audit log intact: {c.rowsChecked} rows checked.</Callout>
        : <Callout tone="bad" role="alert">Audit log chain broken at row {c.firstBroken}. Rows may have been changed or removed outside ProofPocket.</Callout>)}
      <Card>
        <CardContent className="pt-6">
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end" onSubmit={apply} noValidate>
            <NativeSelect label="Action" value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })}>
              <option value="">All</option>{q.data?.actionGroups.map((a) => <option key={a} value={a + "."}>{a}</option>)}
            </NativeSelect>
            <TextField label="Person (email)" value={form.person} onChange={(e) => setForm({ ...form, person: e.target.value })} />
            <TextField label="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            <TextField label="From" type="date" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />
            <TextField label="To" type="date" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />
            <div className="flex gap-2">
              <Button type="submit">Filter</Button>
              <Button type="button" variant="outline" onClick={() => { setForm(EMPTY); setFilters(EMPTY); setPage(0); }}>Clear</Button>
            </div>
          </form>
        </CardContent>
      </Card>
      {!q.data ? <Spinner /> : !q.data.entries.length ? <EmptyState icon={History}>Nothing matches these filters.</EmptyState> : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Who</TableHead><TableHead>Action</TableHead><TableHead>Company</TableHead><TableHead><span className="sr-only">Details</span></TableHead></TableRow></TableHeader>
              <TableBody>{q.data.entries.map((e) => (
                <Fragment key={e.id}>
                  <TableRow>
                    <TableCell className="whitespace-nowrap tabular-nums">{when(e.at)}</TableCell>
                    <TableCell><span className="block">{e.person ?? "ProofPocket"}</span>{e.role && <span className="text-xs text-muted-foreground">{e.role}</span>}</TableCell>
                    <TableCell><ToneBadge tone={e.action.startsWith("email.failed") || e.action.includes("mismatch") ? "bad" : "plain"}>{e.action}</ToneBadge><span className="block text-xs text-muted-foreground">{e.entity}</span></TableCell>
                    <TableCell>{e.company ?? "—"}</TableCell>
                    <TableCell className="text-right">{(e.before != null || e.after != null) &&
                      <Button size="sm" variant="ghost" aria-expanded={open === e.id} onClick={() => setOpen(open === e.id ? null : e.id)}>{open === e.id ? "Hide" : "Details"}</Button>}</TableCell>
                  </TableRow>
                  {open === e.id && <TableRow><TableCell colSpan={5} className="bg-surface-2">
                    <div className="grid gap-3 md:grid-cols-2">
                      {([["Before", e.before], ["After", e.after]] as const).map(([label, v]) => (
                        <div key={label} className="min-w-0"><p className="mb-1 text-xs font-semibold text-muted-foreground">{label}</p>
                          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md border border-border bg-background p-2 text-xs">{v == null ? "—" : JSON.stringify(v, null, 2)}</pre></div>
                      ))}
                    </div>
                  </TableCell></TableRow>}
                </Fragment>
              ))}</TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      {q.data && (page > 0 || q.data.more) && <div className="flex items-center justify-between">
        <Button variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Newer</Button>
        <span className="text-sm text-muted-foreground">Page {page + 1}</span>
        <Button variant="outline" disabled={!q.data.more} onClick={() => setPage(page + 1)}>Older</Button>
      </div>}
    </>
  );
}
