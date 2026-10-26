// Admin people & companies: every account and every business, with search. Opening a company is audited.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Building2, Users } from "lucide-react";
import { useCallback, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect, TextField } from "@/components/ui/field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CompanyDrawer } from "../../components/CompanyDrawer";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader } from "../../components/PageHeader";
import { LevelBadge, ToneBadge } from "../../components/ToneBadge";
import { Spinner } from "../../components/ui";
import { api } from "../../lib/api";
import { qs, when } from "./when";

interface Person { id: string; email: string; name: string; role: string; organisation: string | null; createdAt: string; lastSeenAt: string | null; example: boolean; twoFactor: "locked" | "on" | "required_not_set" | "off" }
interface Company { id: string; name: string; owner: string; incubator: string | null; example: boolean; createdAt: string; status: "verified" | "starter" | "unfinished"; sharing: string; documentsChecked: number; score: number | null; recordMonths: number | null }

const SUB = "Every account and business on ProofPocket. Opening a business shows its books and is recorded in Activity.";
const TWO_FACTOR = { on: ["good", "On"], off: ["plain", "Off"], required_not_set: ["warn", "Not set up"], locked: ["bad", "Locked"] } as const;

function Pager({ page, more, set }: { page: number; more: boolean; set: (p: number) => void }) {
  if (page === 0 && !more) return null;
  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-3">
      <Button size="sm" variant="outline" disabled={page === 0} onClick={() => set(page - 1)}>Previous</Button>
      <span className="text-sm text-muted-foreground">Page {page + 1}</span>
      <Button size="sm" variant="outline" disabled={!more} onClick={() => set(page + 1)}>Next</Button>
    </div>
  );
}

function PeopleTable() {
  const [form, setForm] = useState({ q: "", role: "" });
  const [f, setF] = useState(form);
  const [page, setPage] = useState(0);
  const q = useQuery({ queryKey: ["admin", "people", f, page], queryFn: () => api<{ more: boolean; people: Person[] }>(`/admin/people?${qs({ ...f, page })}`), placeholderData: keepPreviousData });
  const submit = (e: FormEvent) => { e.preventDefault(); setF(form); setPage(0); };
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4 text-primary" aria-hidden="true" />People</CardTitle></CardHeader>
      <CardContent className="space-y-4 p-0">
        <form className="flex flex-wrap items-end gap-3 px-6" onSubmit={submit} noValidate>
          <TextField className="min-w-[200px] flex-1" label="Search people" placeholder="Name or email" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} />
          <NativeSelect className="w-40" label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="">All</option>{["founder", "funder", "adviser", "buyer", "admin"].map((r) => <option key={r} value={r}>{r[0]!.toUpperCase() + r.slice(1)}</option>)}
          </NativeSelect>
          <Button type="submit" variant="outline">Search</Button>
        </form>
        {!q.data ? <Spinner /> : !q.data.people.length ? <EmptyState icon={Users}>No one matches.</EmptyState> : <>
          <div className="overflow-x-auto"><Table>
            <TableHeader><TableRow><TableHead>Person</TableHead><TableHead className="hidden md:table-cell">Role</TableHead><TableHead>Two-step</TableHead><TableHead className="hidden md:table-cell">Last seen</TableHead><TableHead className="hidden md:table-cell">Joined</TableHead></TableRow></TableHeader>
            <TableBody>{q.data.people.map((p) => {
              const [tone, label] = TWO_FACTOR[p.twoFactor];
              return (
                <TableRow key={p.id}>
                  <TableCell className="break-all"><span className="block font-medium">{p.name}</span><span className="text-xs text-muted-foreground">{p.email}</span>{p.example && <> <ToneBadge tone="plain">Example</ToneBadge></>}<span className="block text-xs text-muted-foreground md:hidden">{p.role} · last seen {when(p.lastSeenAt)}</span></TableCell>
                  <TableCell className="hidden md:table-cell">{p.role}{p.organisation && <span className="block text-xs text-muted-foreground">{p.organisation}</span>}</TableCell>
                  <TableCell><ToneBadge tone={tone}>{label}</ToneBadge></TableCell>
                  <TableCell className="hidden whitespace-nowrap tabular-nums md:table-cell">{when(p.lastSeenAt)}</TableCell>
                  <TableCell className="hidden whitespace-nowrap tabular-nums md:table-cell">{when(p.createdAt)}</TableCell>
                </TableRow>
              );
            })}</TableBody>
          </Table></div>
          <Pager page={page} more={q.data.more} set={setPage} />
        </>}
      </CardContent>
    </Card>
  );
}

function CompaniesTable({ openCompany }: { openCompany: (id: string) => void }) {
  const [form, setForm] = useState({ q: "", status: "" });
  const [f, setF] = useState(form);
  const [page, setPage] = useState(0);
  const q = useQuery({ queryKey: ["admin", "companies", f, page], queryFn: () => api<{ more: boolean; companies: Company[] }>(`/admin/companies?${qs({ ...f, page })}`), placeholderData: keepPreviousData });
  const submit = (e: FormEvent) => { e.preventDefault(); setF(form); setPage(0); };
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4 text-primary" aria-hidden="true" />Businesses</CardTitle></CardHeader>
      <CardContent className="space-y-4 p-0">
        <form className="flex flex-wrap items-end gap-3 px-6" onSubmit={submit} noValidate>
          <TextField className="min-w-[200px] flex-1" label="Search businesses" placeholder="Business name or owner's email" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} />
          <NativeSelect className="w-44" label="Level" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="">All</option><option value="verified">Verified</option><option value="starter">Starter</option><option value="unfinished">Not finished joining</option>
          </NativeSelect>
          <Button type="submit" variant="outline">Search</Button>
        </form>
        {!q.data ? <Spinner /> : !q.data.companies.length ? <EmptyState icon={Building2}>No businesses match.</EmptyState> : <>
          <div className="overflow-x-auto"><Table>
            <TableHeader><TableRow><TableHead>Business</TableHead><TableHead>Level</TableHead><TableHead className="text-right">Score</TableHead><TableHead className="hidden text-right md:table-cell">Months</TableHead><TableHead className="hidden text-right md:table-cell">Documents</TableHead><TableHead className="hidden md:table-cell">Sharing</TableHead><TableHead><span className="sr-only">Open</span></TableHead></TableRow></TableHeader>
            <TableBody>{q.data.companies.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="break-all"><span className="block font-medium">{c.name}</span><span className="text-xs text-muted-foreground">{c.owner}{c.incubator && ` · ${c.incubator}`}</span>{c.example && <> <ToneBadge tone="plain">Example</ToneBadge></>}</TableCell>
                <TableCell>{c.status === "unfinished" ? <ToneBadge tone="plain">Not finished</ToneBadge> : <LevelBadge verified={c.status === "verified"} />}</TableCell>
                <TableCell className="text-right tabular-nums">{c.score ?? "—"}</TableCell>
                <TableCell className="hidden text-right tabular-nums md:table-cell">{c.recordMonths ?? "—"}</TableCell>
                <TableCell className="hidden text-right tabular-nums md:table-cell">{c.documentsChecked}</TableCell>
                <TableCell className="hidden md:table-cell">{c.sharing}</TableCell>
                <TableCell className="text-right">{c.status !== "unfinished" && <Button size="sm" variant="outline" onClick={() => openCompany(c.id)}>Open</Button>}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table></div>
          <Pager page={page} more={q.data.more} set={setPage} />
        </>}
      </CardContent>
    </Card>
  );
}

export default function People() {
  const [open, setOpen] = useState<string | null>(null);
  const close = useCallback(() => setOpen(null), []);
  return (
    <>
      <PageHeader title="People & companies" sub={SUB} />
      <PeopleTable />
      <CompaniesTable openCompany={setOpen} />
      {open && <CompanyDrawer path={`/admin/companies/${open}`} onClose={close} />}
    </>
  );
}
