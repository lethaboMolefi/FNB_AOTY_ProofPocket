// Programmes & requirements (v2/app.js funderProgrammes).
import { DOCS, FUNDER_REQUIRABLE_DOCS, R, type DocType } from "@proofpocket/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ListChecks, Lock, LockOpen, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader } from "../../components/PageHeader";
import { ToneBadge } from "../../components/ToneBadge";
import { Spinner, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { ProgrammeForm } from "./ProgrammeForm";

interface Prog { id: string; name: string; status: "open" | "closed"; min: number; max: number; budget: number; committed: number; left: number; minMonths: number; minScore: number; requiredDocs: DocType[]; qualify: number }

const SUB = "Founders see these requirements before they apply. Changes reach them straight away.";

export default function Programmes() {
  const qc = useQueryClient();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const q = useQuery({ queryKey: ["funder", "programmes"], queryFn: () => api<{ funder: { name: string; kind: string | null }; programmes: Prog[] }>("/funder/programmes") });
  if (!q.data) return <><PageHeader title="Programmes & requirements" sub={SUB} /><Spinner /></>;
  const call = async (path: string, body: object) => {
    try { toast((await api<{ message: string }>(path, { body })).message); void qc.invalidateQueries({ queryKey: ["funder"] }); }
    catch (e) { toast((e as ApiError).message); }
  };
  return (
    <>
      <PageHeader title="Programmes & requirements" sub={SUB}
        action={!adding && <Button variant="outline" onClick={() => setAdding(true)}><Plus className="h-4 w-4" />Add a programme</Button>} />
      {adding && <ProgrammeForm onDone={() => { setAdding(false); void qc.invalidateQueries({ queryKey: ["funder"] }); }} onCancel={() => setAdding(false)} />}
      {q.data.programmes.length ? q.data.programmes.map((p) => (
        <Card key={p.id}>
          <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-3">
            <div className="space-y-1.5">
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">{p.name}{p.status === "closed" && <ToneBadge tone="plain">Closed</ToneBadge>}</CardTitle>
              <CardDescription>{q.data.funder.kind} · {R(p.min)} to {R(p.max)} per business · {p.minMonths} months of records · score {p.minScore}+</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ToneBadge tone="info">{p.qualify} verified {p.qualify === 1 ? "company qualifies" : "companies qualify"}</ToneBadge>
              <Button size="sm" variant="ghost" onClick={() => void call(`/funder/programmes/${p.id}/status`, { status: p.status === "open" ? "closed" : "open" })}>
                {p.status === "open" ? <><Lock className="h-4 w-4" />Close to applications</> : <><LockOpen className="h-4 w-4" />Reopen</>}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {([["Budget", p.budget], ["Committed", p.committed], ["Left", p.left]] as const).map(([label, v]) => (
                <div key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold tabular-nums">{R(v)}</p></div>
              ))}
              <Progress className="h-2 sm:col-span-3" value={Math.min(100, Math.round((p.committed / (p.budget || 1)) * 100))} aria-label={`${R(p.committed)} of ${R(p.budget)} committed`} />
            </div>
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">Required documents (click to change)</legend>
              <div className="flex flex-wrap gap-2">{FUNDER_REQUIRABLE_DOCS.map((k) => {
                const on = p.requiredDocs.includes(k);
                return <Button key={k} type="button" size="sm" variant={on ? "default" : "outline"} aria-pressed={on} className={cn("rounded-full", !on && "text-muted-foreground")}
                  onClick={() => void call(`/funder/programmes/${p.id}/requirements`, { docType: k })}>{DOCS[k].name}</Button>;
              })}</div>
            </fieldset>
          </CardContent>
        </Card>
      )) : !adding && <Card><CardContent><EmptyState icon={ListChecks} action={<Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" />Add a programme</Button>}>No programmes yet.</EmptyState></CardContent></Card>}
    </>
  );
}
