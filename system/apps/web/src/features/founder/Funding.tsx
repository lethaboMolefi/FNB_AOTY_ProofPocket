// Funding readiness (v2/app.js vFunding).
import { R, shortDate, type ReadinessItem, type Tone } from "@proofpocket/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, TrendingUp } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Spinner, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { FounderHead } from "./FounderHead";

export interface Offer { amount: number; date: string; reason: string }
export interface Application {
  id: string; company: string; companyId: string; programme: string; funder: string; requested: number; appliedOn: string; status: string; statusLabel: string; statusTone: Tone;
  statusReason: string; reasonRequested: boolean; offers: Offer[]; currentOffer: number; changedWithoutReason: boolean; canAskReason?: boolean; canWithdraw?: boolean;
}
interface Data {
  verified: boolean; readiness: { score: number; label: string; tone: Tone; items: ReadinessItem[] };
  programmes: { id: string; name: string; funder: string; kind: string | null; min: number; max: number; left: number; gaps: string[]; applied: boolean }[];
  applications: Application[];
}
const SUB = "Funders set their own requirements on ProofPocket. See what each one checks, and what you still need, before you apply.";
const VARIANT: Record<Tone, "success" | "warning" | "destructive" | "secondary" | "default"> = { good: "success", warn: "warning", bad: "destructive", plain: "secondary", info: "default" };

export function OfferHistory({ offers }: { offers: Offer[] }) {
  return (
    <ol className="space-y-1.5">{offers.map((o, i) => (
      <li key={i} className="flex gap-3 text-sm">
        <span className="w-20 shrink-0 text-xs text-muted-foreground">{shortDate(o.date)}</span>
        <span><b className="tabular-nums">{R(o.amount)}</b>{i ? " · " : " "}{o.reason ? o.reason : <span className="font-semibold text-bad">No reason given</span>}</span>
      </li>
    ))}</ol>
  );
}

function ScoreItems({ items, group }: { items: ReadinessItem[]; group: ReadinessItem["group"] }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{group}</p>
      <ul className="space-y-2">{items.filter((i) => i.group === group).map((i) => (
        <li key={i.key} className="flex items-start justify-between gap-3 text-sm">
          <span className="flex items-start gap-2">
            {i.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-good" aria-label="Done" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-label="Not yet" />}
            <span className={i.ok ? "" : "text-muted-foreground"}>{i.label}</span>
          </span>
          <Badge variant={i.ok ? "success" : "secondary"} className="shrink-0 tabular-nums">{i.ok ? `+${i.pts}` : i.pts}</Badge>
        </li>
      ))}</ul>
    </div>
  );
}

export default function Funding() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["founder", "funding"], queryFn: () => api<Data>("/founder/funding") });
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  if (!q.data) return <><FounderHead title="Funding readiness" sub={SUB} /><Spinner /></>;
  const d = q.data;
  const act = async (path: string, body: object = {}) => {
    try { toast((await api<{ message: string }>(path, { body })).message); void qc.invalidateQueries({ queryKey: ["founder"] }); }
    catch (e) { toast((e as ApiError).message); }
  };
  return (
    <>
      <FounderHead title="Funding readiness" sub={SUB} />
      {!d.verified && <Callout tone="warn" action={<Button size="sm" variant="outline" asChild><Link to="/app/start">Get verified</Link></Button>}>
        <b>Funders can't see you yet.</b> You can see your score and every programme's requirements now. You can apply once you're verified.
      </Callout>}

      <div className="grid gap-6 desktop:grid-cols-3">
        <Card>
          <CardContent className="space-y-3 pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><TrendingUp className="h-4 w-4" />Readiness score</div>
            <div className="flex items-baseline gap-1"><span className="text-4xl font-bold tabular-nums">{d.readiness.score}</span><span className="text-sm text-muted-foreground">/100</span></div>
            <Progress value={d.readiness.score} className="h-2.5" aria-label={`Readiness ${d.readiness.score} out of 100`} />
            <Badge variant={VARIANT[d.readiness.tone]}>{d.readiness.label}</Badge>
            <p className="text-sm text-muted-foreground">From your checked documents and the state of your books. Funders see the same score.</p>
          </CardContent>
        </Card>
        <Card className="desktop:col-span-2">
          <CardHeader className="pb-3"><CardTitle className="text-base">What makes up your score</CardTitle></CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2">
            <ScoreItems items={d.readiness.items} group="Documents" />
            <ScoreItems items={d.readiness.items} group="Bookkeeping" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Programmes and what you're missing</CardTitle>
          <CardDescription>Only verified funders are listed.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Programme</TableHead><TableHead className="hidden sm:table-cell">Amount</TableHead><TableHead className="hidden md:table-cell">Funds left</TableHead><TableHead className="hidden sm:table-cell">What you still need</TableHead><TableHead>Apply</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {d.programmes.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">{p.name}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">{p.funder}{p.kind && <> · {p.kind}</>}<Badge variant="success" className="text-[10px]">Verified funder</Badge></div>
                    <div className="mt-1 space-y-1 sm:hidden">
                      <p className="text-xs tabular-nums">{R(p.min)}–{R(p.max)}</p>
                      {p.gaps.length ? <div className="flex flex-wrap gap-1">{p.gaps.map((g) => <Badge key={g} variant="outline" className="font-normal">× {g}</Badge>)}</div> : <Badge variant="success">Nothing, you qualify</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap tabular-nums sm:table-cell">{R(p.min)}–{R(p.max)}</TableCell>
                  <TableCell className="hidden tabular-nums md:table-cell">{R(p.left)}</TableCell>
                  <TableCell className="hidden sm:table-cell">{p.gaps.length
                    ? <div className="flex flex-wrap gap-1">{p.gaps.map((g) => <Badge key={g} variant="outline" className="font-normal">× {g}</Badge>)}</div>
                    : <Badge variant="success">Nothing, you qualify</Badge>}</TableCell>
                  <TableCell>{p.applied ? <Badge>Applied</Badge> : p.gaps.length ? <span className="text-sm text-muted-foreground">—</span> : (
                    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                      <Input type="number" className="w-28" aria-label={`Amount to request from ${p.name}`} min={p.min} max={p.max} value={amounts[p.id] ?? String(p.max)} onChange={(e) => setAmounts({ ...amounts, [p.id]: e.target.value })} />
                      <Button size="sm" onClick={() => void act("/founder/applications", { programmeId: p.id, amount: Number(amounts[p.id] ?? p.max) })}>Apply</Button>
                    </div>)}</TableCell>
                </TableRow>
              ))}
              {!d.programmes.length && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No programmes yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Your applications</h2>
        {d.applications.length ? <div className="grid gap-4 desktop:grid-cols-2">{d.applications.map((a) => (
          <Card key={a.id}>
            <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-3">
              <div>
                <CardTitle as="h3" className="text-base">{a.programme}</CardTitle>
                <CardDescription className="mt-0.5">{a.funder} · applied {shortDate(a.appliedOn)}</CardDescription>
              </div>
              <Badge variant={VARIANT[a.statusTone]} className="shrink-0">{a.statusLabel}</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm text-muted-foreground"><span>Requested <b className="tabular-nums text-foreground">{R(a.requested)}</b></span><span>Current offer <b className="tabular-nums text-foreground">{R(a.currentOffer)}</b></span></div>
              <div className="rounded-lg bg-surface-2 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Offer history</p>
                <OfferHistory offers={a.offers} />
              </div>
              {a.statusReason && <p className="text-sm">{a.statusReason}</p>}
              {(a.changedWithoutReason || a.canWithdraw) && <div className="flex flex-wrap gap-2">
                {a.changedWithoutReason && <Button size="sm" variant="outline" disabled={!a.canAskReason} onClick={() => void act(`/founder/applications/${a.id}/ask-reason`)}>{a.reasonRequested ? "Reason requested" : "Ask the funder for a reason"}</Button>}
                {a.canWithdraw && <Button size="sm" variant="ghost" onClick={() => window.confirm(`Withdraw your ${a.programme} application?`) && void act(`/founder/applications/${a.id}/withdraw`)}>Withdraw</Button>}
              </div>}
            </CardContent>
          </Card>
        ))}</div> : <p className="text-sm text-muted-foreground">No applications yet.</p>}
      </section>
    </>
  );
}
