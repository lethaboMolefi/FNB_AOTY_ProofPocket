// Company pipeline (v2/app.js funderPipeline).
import { AREAS } from "@proofpocket/shared";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Gauge, Inbox, SearchX, Target } from "lucide-react";
import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NativeSelect, TextField } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScoreCell, Spark } from "../../components/charts";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader } from "../../components/PageHeader";
import { StatCard } from "../../components/StatCard";
import { ToneBadge } from "../../components/ToneBadge";
import { Spinner } from "../../components/ui";
import { api } from "../../lib/api";
import { FunderDrawer } from "./FunderDrawer";

interface Row { id: string; name: string; sector: string; stage: string; town: string; area: keyof typeof AREAS; sharing: string; score: number; spark: number[]; lastEntryDays: number | null; qualifies: number }
interface Data { funder: { name: string; kind: string | null }; tiles: { visible: number; hidden: number; qualify: number; ready: number; applications: number }; sectors: string[]; rows: Row[] }

const SUB = "Verified companies that chose to share with funders, ranked by readiness. Scores come from checked documents and live books, not self-reported figures.";

export default function Pipeline() {
  const q = useQuery({ queryKey: ["funder", "pipeline"], queryFn: () => api<Data>("/funder/pipeline") });
  const [f, setF] = useState({ q: "", sector: "", area: "", min: 0 });
  const [open, setOpen] = useState<string | null>(null);
  const minId = useId();
  if (!q.data) return <><PageHeader title="Company pipeline" sub={SUB} /><Spinner /></>;
  const d = q.data;
  const rows = d.rows.filter((r) => (!f.q || `${r.name} ${r.town} ${r.sector}`.toLowerCase().includes(f.q.toLowerCase())) && (!f.sector || r.sector === f.sector) && (!f.area || r.area === f.area) && r.score >= f.min);
  const books = (n: number | null) => n === null ? <ToneBadge tone="bad">None</ToneBadge> : n <= 7 ? <ToneBadge tone="good">Up to date</ToneBadge> : n <= 14 ? <ToneBadge tone="warn">{n} days</ToneBadge> : <ToneBadge tone="bad">{n} days</ToneBadge>;
  return (
    <>
      <PageHeader title="Company pipeline" sub={SUB} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Verified and sharing" value={d.tiles.visible} sub={`${d.tiles.hidden} Starter or private`} icon={BadgeCheck} />
        <StatCard label="Meet your requirements" value={d.tiles.qualify} sub="For at least one programme" icon={Target} />
        <StatCard label="Funding ready (70+)" value={d.tiles.ready} icon={Gauge} />
        <StatCard label="Applications to you" value={d.tiles.applications} icon={Inbox}>
          <Button size="sm" variant="ghost" asChild className="-ml-3 mt-1"><Link to="/funder/applications">Open</Link></Button>
        </StatCard>
      </div>
      <Card><CardContent className="grid gap-3 pt-6 sm:grid-cols-2 lg:grid-cols-4">
        <TextField label="Search" placeholder="Name, town or sector" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        <NativeSelect label="Sector" value={f.sector} onChange={(e) => setF({ ...f, sector: e.target.value })}><option value="">All sectors</option>{d.sectors.map((s) => <option key={s}>{s}</option>)}</NativeSelect>
        <NativeSelect label="Area" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })}><option value="">Township, urban and rural</option>{Object.entries(AREAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect>
        <div className="space-y-1.5">
          <Label htmlFor={minId}>Minimum readiness: <b className="tabular-nums">{f.min}</b></Label>
          <input id={minId} type="range" min={0} max={100} step={5} value={f.min} onChange={(e) => setF({ ...f, min: Number(e.target.value) })} className="h-10 w-full accent-[var(--accent)]" />
        </div>
      </CardContent></Card>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Company</TableHead><TableHead className="hidden sm:table-cell">Area</TableHead><TableHead>Readiness</TableHead><TableHead className="hidden md:table-cell">Your programmes</TableHead><TableHead className="hidden lg:table-cell">Income, 5 months</TableHead><TableHead className="hidden lg:table-cell">Books</TableHead><TableHead className="hidden lg:table-cell">Sharing</TableHead></TableRow></TableHeader>
          <TableBody>{rows.map((r) => (
            <TableRow key={r.id} className="cursor-pointer" tabIndex={0} onClick={() => setOpen(r.id)} onKeyDown={(e) => { if (e.key === "Enter") setOpen(r.id); }}>
              <TableCell><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.sector} · {r.stage}<span className="sm:hidden"> · {r.town}</span></div>
                <div className="mt-1 md:hidden">{r.qualifies ? <ToneBadge tone="good">Qualifies for {r.qualifies}</ToneBadge> : <ToneBadge tone="plain">Not yet</ToneBadge>}</div></TableCell>
              <TableCell className="hidden sm:table-cell">{r.town}<div className="text-xs text-muted-foreground">{AREAS[r.area]}</div></TableCell>
              <TableCell><ScoreCell score={r.score} /></TableCell>
              <TableCell className="hidden md:table-cell">{r.qualifies ? <ToneBadge tone="good">Qualifies for {r.qualifies}</ToneBadge> : <ToneBadge tone="plain">Not yet</ToneBadge>}</TableCell>
              <TableCell className="hidden lg:table-cell"><Spark values={r.spark} /></TableCell><TableCell className="hidden lg:table-cell">{books(r.lastEntryDays)}</TableCell>
              <TableCell className="hidden text-sm lg:table-cell">{r.sharing === "full" ? "Full books" : "Summary"}</TableCell>
            </TableRow>
          ))}{!rows.length && <TableRow className="hover:bg-transparent"><TableCell colSpan={7}><EmptyState icon={SearchX}>No companies match these filters.</EmptyState></TableCell></TableRow>}</TableBody>
        </Table>
      </CardContent></Card>
      {open && <FunderDrawer companyId={open} onClose={() => setOpen(null)} />}
    </>
  );
}
