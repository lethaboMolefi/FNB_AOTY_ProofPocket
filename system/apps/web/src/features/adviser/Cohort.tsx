// Cohort board (v2/app.js ngoCohort), plus requests to join (inventory 12.12).
import { type Flag } from "@proofpocket/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, CheckCircle2, FileCheck, Gauge, LifeBuoy, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoreCell } from "../../components/charts";
import { ListRow, RowHint } from "../../components/ListRow";
import { PageHeader } from "../../components/PageHeader";
import { StatCard } from "../../components/StatCard";
import { LevelBadge, ToneBadge } from "../../components/ToneBadge";
import { Spinner, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { AdviserDrawer } from "./AdviserDrawer";

interface Data {
  incubator: string; stages: string[];
  tiles: { companies: number; starters: number; avgReadiness: number; toCheck: number; sessions: number };
  companies: { id: string; name: string; sector: string; town: string; stage: number; verified: boolean; adviser: string | null; score: number; flags: Flag[] }[];
  requests: { id: string; name: string; sector: string; town: string }[];
}

const SUB = "Your companies by support stage. Starter companies are ones you're helping to register.";

export default function Cohort() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["adviser", "cohort"], queryFn: () => api<Data>("/adviser/cohort") });
  const [open, setOpen] = useState<string | null>(null);
  if (!q.data) return <><PageHeader title="Cohort board" sub={SUB} /><Spinner /></>;
  const d = q.data;
  const decide = async (id: string, accept: boolean) => {
    try { toast((await api<{ message: string }>(`/adviser/memberships/${id}`, { body: { accept } })).message); void qc.invalidateQueries({ queryKey: ["adviser"] }); }
    catch (e) { toast((e as ApiError).message); }
  };
  return (
    <>
      <PageHeader label={d.incubator} title="Cohort board" sub={SUB} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Companies" value={d.tiles.companies} sub={`${d.tiles.starters} Starter`} icon={Building2} />
        <StatCard label="Average readiness" value={d.tiles.avgReadiness} icon={Gauge} />
        <StatCard label="Documents to check" value={d.tiles.toCheck} icon={FileCheck} valueClass={d.tiles.toCheck ? "text-warn" : undefined}>
          <Button size="sm" variant="ghost" asChild className="-ml-3 mt-1"><Link to="/adviser/checks">Open</Link></Button>
        </StatCard>
        <StatCard label="Support sessions logged" value={d.tiles.sessions} icon={LifeBuoy} />
      </div>
      {d.requests.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><UserPlus className="h-4 w-4 text-primary" aria-hidden="true" />Asking to join</CardTitle></CardHeader>
          <CardContent className="pt-0"><ul>{d.requests.map((r) => (
            <ListRow key={r.id} side={<>
              <Button size="sm" onClick={() => void decide(r.id, true)}><CheckCircle2 className="h-4 w-4" />Accept</Button>
              <Button size="sm" variant="outline" onClick={() => void decide(r.id, false)}><X className="h-4 w-4" />Decline</Button>
            </>}>
              <p className="font-semibold">{r.name}</p>
              <RowHint>{r.sector} · {r.town}</RowHint>
            </ListRow>
          ))}</ul></CardContent>
        </Card>
      )}
      <div className="board">{d.stages.map((s, i) => {
        const col = d.companies.filter((c) => c.stage === i);
        return (
          <section key={s} className="col" aria-label={s}>
            <div className="flex items-center justify-between px-1 pb-1.5"><h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{s}</h2><span className="font-mono text-xs text-muted-foreground">{col.length}</span></div>
            {col.map((c) => (
              <Card key={c.id} className="relative space-y-1.5 p-3 transition-colors hover:border-primary">
                <div className="flex items-start justify-between gap-1.5">
                  {/* The name is the button; its ::after covers the card so the whole card opens it. */}
                  <button type="button" className="text-left text-sm font-semibold after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring" onClick={() => setOpen(c.id)}>{c.name}</button>
                  <LevelBadge verified={c.verified} />
                </div>
                <p className="text-xs text-muted-foreground">{c.sector} · {c.town}</p>
                <ScoreCell score={c.score} />
                <p className="text-xs text-muted-foreground">Adviser: {c.adviser ?? "not assigned"}</p>
                {c.flags.length > 0 && <div className="flex flex-wrap gap-1">{c.flags.slice(0, 2).map((f) => <ToneBadge key={f.code} tone={f.level} className="whitespace-normal">{f.text}</ToneBadge>)}{c.flags.length > 2 && <ToneBadge tone="plain">+{c.flags.length - 2}</ToneBadge>}</div>}
              </Card>
            ))}
            {!col.length && <p className="p-1 text-xs text-muted-foreground">None</p>}
          </section>
        );
      })}</div>
      {open && <AdviserDrawer companyId={open} onClose={() => setOpen(null)} />}
    </>
  );
}
