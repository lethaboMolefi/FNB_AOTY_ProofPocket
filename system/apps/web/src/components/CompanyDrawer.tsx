// Company detail for funders and advisers (v2/app.js drawerHTML): a side drawer on desktop, full screen on phones.
import { R, shortDate, type DocState, type Flag, type ReadinessItem, type Tone } from "@proofpocket/shared";
import { useQuery } from "@tanstack/react-query";
import { Activity, BarChart3, FileText, Flag as FlagIcon, HeartPulse, LifeBuoy, ReceiptText, X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { api } from "../lib/api";
import { BarChart, Checklist, Ring, type Point } from "./charts";
import { EmptyState } from "./EmptyState";
import { LevelBadge, ToneBadge } from "./ToneBadge";
import { Spinner } from "./ui";

export interface Drawer {
  company: { id: string; name: string; sector: string; town: string; province: string; area: string; cipcNumber: string | null; stage: string; employees: number; verified: boolean; sharing: string; recordMonths: number };
  readiness: { score: number; label: string; tone: Tone; items: ReadinessItem[] };
  documentsChecked: number;
  figures: { income5: number; avgProfit: number; cash: number; people: number };
  flags: Flag[]; series: Point[];
  entries: { id: string; date: string; note: string; method: string; direction: "in" | "out"; amount: number; isPersonal: boolean; voided: boolean }[] | null;
  documents: { docType: string; name: string; state: DocState }[];
  support: { incubator: string | null; stage: number; stageName: string; adviser: string | null; adviserId: string | null; logs: { id: string; date: string; type: string; note: string }[] };
  activity: { date: string; text: string }[];
}

const DOC_PILL: Record<DocState, [Tone, string]> = { verified: ["good", "Verified"], pending: ["warn", "Being checked"], missing: ["bad", "Missing"], expired: ["bad", "Expired"] };
const STAGES = ["Assessment", "Adviser assigned", "Service agreement", "Intervention", "Monitoring & evaluation"];

export function CompanyDrawer<T extends Drawer>({ path, onClose, children, supportControls }: {
  path: string; onClose: () => void; children?: (d: T) => ReactNode; supportControls?: (d: T) => ReactNode;
}) {
  const q = useQuery({ queryKey: ["drawer", path], queryFn: () => api<T>(path) });
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = ""; };
  }, [onClose]);
  const d = q.data;
  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <aside ref={ref} className="drawer" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="dr-title">
        <div className="sticky top-0 z-[2] flex items-start justify-between gap-3 border-b border-border bg-background px-5 py-4">
          <div className="min-w-0">
            {d && <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{d.company.sector} · {d.company.town}, {d.company.province}</p>}
            <h2 id="dr-title" className="text-xl font-bold tracking-tight">{d?.company.name ?? "Loading…"}</h2>
            {d && <div className="mt-1.5 flex flex-wrap gap-1.5">
              <LevelBadge verified={d.company.verified} />{d.company.cipcNumber && <ToneBadge tone="plain">CIPC {d.company.cipcNumber}</ToneBadge>}
              <ToneBadge tone="plain">{d.company.area[0]!.toUpperCase() + d.company.area.slice(1)}</ToneBadge><ToneBadge tone="plain">{d.company.recordMonths} months on record</ToneBadge>
            </div>}
          </div>
          <Button size="sm" variant="outline" onClick={onClose}><X className="h-4 w-4" />Close</Button>
        </div>
        <div className="flex flex-col gap-4 p-5">
          {!d ? (q.isError ? <Callout tone="bad">Couldn't open this company.</Callout> : <Spinner />) : <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Card><CardContent className="flex items-center gap-4 pt-6"><Ring score={d.readiness.score} />
                <div className="space-y-1.5"><ToneBadge tone={d.readiness.tone}>{d.readiness.label}</ToneBadge><p className="text-sm text-muted-foreground">{d.documentsChecked} of 9 documents checked</p></div></CardContent></Card>
              <Card><CardContent className="grid grid-cols-2 gap-3 pt-6">
                {([["Income, 5 months", R(d.figures.income5)], ["Avg monthly profit", R(d.figures.avgProfit)], ["Cash on hand", R(d.figures.cash)], ["People", d.figures.people]] as const).map(([label, v]) => (
                  <div key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="text-lg font-bold tabular-nums">{v}</p></div>
                ))}
              </CardContent></Card>
            </div>
            {d.flags.length > 0 && <Card><CardHeader className="pb-2"><CardTitle as="h3" className="flex items-center gap-2 text-base"><FlagIcon className="h-4 w-4 text-primary" aria-hidden="true" />Flags</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-1.5 pt-0">{d.flags.map((f) => <ToneBadge key={f.code} tone={f.level} className="whitespace-normal">{f.text}</ToneBadge>)}</CardContent></Card>}
            <Card><CardHeader className="pb-2"><CardTitle as="h3" className="flex items-center gap-2 text-base"><BarChart3 className="h-4 w-4 text-primary" aria-hidden="true" />Money in and out</CardTitle></CardHeader><CardContent className="pt-0"><BarChart series={d.series} /></CardContent></Card>
            {d.entries ? (
              <Card><CardHeader className="pb-2"><CardTitle as="h3" className="flex items-center gap-2 text-base"><ReceiptText className="h-4 w-4 text-primary" aria-hidden="true" />Latest entries</CardTitle></CardHeader>
                <CardContent className="p-0">{d.entries.length ? <Table><TableBody>{d.entries.map((e) => (
                  <TableRow key={e.id} className={cn(e.voided && "opacity-50")}>
                    <TableCell className="whitespace-nowrap tabular-nums">{shortDate(e.date)}</TableCell>
                    <TableCell>{e.note}{e.isPersonal && <> <ToneBadge tone="warn">Personal</ToneBadge></>}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", e.direction === "in" && "text-good")}>{e.direction === "in" ? "+" : "−"}{R(e.amount)}</TableCell>
                  </TableRow>
                ))}</TableBody></Table> : <EmptyState icon={ReceiptText}>No entries.</EmptyState>}</CardContent></Card>
            ) : <Callout tone="info">This founder shares a summary only. Individual book entries are private.</Callout>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Card><CardHeader className="pb-2"><CardTitle as="h3" className="flex items-center gap-2 text-base"><FileText className="h-4 w-4 text-primary" aria-hidden="true" />Documents</CardTitle></CardHeader>
                <CardContent className="pt-0"><ul>{d.documents.map((x) => <li key={x.docType} className="flex items-center justify-between gap-2 border-b border-border py-2 text-sm last:border-b-0"><span>{x.name}</span><ToneBadge tone={DOC_PILL[x.state][0]}>{DOC_PILL[x.state][1]}</ToneBadge></li>)}</ul></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle as="h3" className="flex items-center gap-2 text-base"><HeartPulse className="h-4 w-4 text-primary" aria-hidden="true" />Bookkeeping health</CardTitle></CardHeader>
                <CardContent className="pt-0"><Checklist items={d.readiness.items.filter((i) => i.group === "Bookkeeping")} /></CardContent></Card>
            </div>
            {children?.(d)}
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle as="h3" className="flex items-center gap-2 text-base"><LifeBuoy className="h-4 w-4 text-primary" aria-hidden="true" />Incubator support</CardTitle>
                <span className="text-sm text-muted-foreground">{d.support.incubator ?? "No incubator"}</span>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <ol className="flex flex-wrap gap-1.5" aria-label="Support stages">{STAGES.map((st, i) => (
                  <li key={st} aria-current={i === d.support.stage ? "step" : undefined}
                    className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", i < d.support.stage ? "border-transparent bg-good-soft text-good" : i === d.support.stage ? "border-transparent bg-primary text-primary-foreground" : "border-border text-muted-foreground")}>{st}</li>
                ))}</ol>
                {supportControls ? supportControls(d) : <p className="text-sm">Adviser: {d.support.adviser ?? "not assigned"}</p>}
                {d.support.logs.length ? <ul>{d.support.logs.map((l) => <li key={l.id} className="flex gap-3 border-b border-border py-2 text-sm last:border-b-0"><span className="w-20 shrink-0 text-xs tabular-nums text-muted-foreground">{shortDate(l.date)}</span><span><b>{l.type}</b><br /><span className="text-xs text-muted-foreground">{l.note}</span></span></li>)}</ul>
                  : <p className="text-sm text-muted-foreground">No support logged yet.</p>}
              </CardContent>
            </Card>
            <Card><CardHeader className="pb-2"><CardTitle as="h3" className="flex items-center gap-2 text-base"><Activity className="h-4 w-4 text-primary" aria-hidden="true" />Activity</CardTitle></CardHeader>
              <CardContent className="pt-0">{d.activity.length ? <ul>{d.activity.map((a, i) => <li key={i} className="flex gap-3 border-b border-border py-2 text-sm last:border-b-0"><span className="w-20 shrink-0 text-xs tabular-nums text-muted-foreground">{shortDate(a.date.slice(0, 10))}</span><span>{a.text}</span></li>)}</ul>
                : <EmptyState icon={Activity}>No activity yet.</EmptyState>}</CardContent></Card>
          </>}
        </div>
      </aside>
    </>
  );
}
