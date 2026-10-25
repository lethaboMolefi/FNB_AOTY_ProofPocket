// Funding readiness — score, checklist, and funding programmes to apply to.
import { APPLICATION_STATUS, R, type ApplicationStatus } from "@proofpocket/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  AlertCircle, BarChart3, CheckCircle2, Loader2, TrendingUp, XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Spinner, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { FounderHead } from "./FounderHead";
import { Link } from "react-router-dom";

interface ReadinessItem {
  group: string; key: string; label: string; pts: number; ok: boolean; hint: string; state?: string;
}
interface Programme {
  id: string; name: string; funderName: string;
  minAmount: number; maxAmount: number; minMonths: number; minScore: number;
  requiredDocs: string[]; gaps: string[]; eligible: boolean;
  application: { id: string; status: string; requestedAmount: number; appliedOn: string; statusReason: string } | null;
}
interface FundingData {
  score: number; tone: string; label: string; recordMonths: number;
  items: ReadinessItem[];
  programmes: Programme[];
}

// UI-only variant map — labels come from APPLICATION_STATUS in shared
const APP_STATUS_VARIANT: Record<string, "secondary" | "warning" | "success" | "destructive" | "outline"> = {
  submitted:          "secondary",
  under_review:       "outline",
  offer_made:         "warning",
  awaiting_cofunding: "warning",
  approved:           "success",
  declined:           "destructive",
  withdrawn:          "outline",
};

function appStatusMeta(status: string) {
  const shared = APPLICATION_STATUS[status as ApplicationStatus];
  const variant = APP_STATUS_VARIANT[status] ?? "outline";
  return { label: shared?.label ?? status, variant };
}

const SCORE_COLOR: Record<string, string> = {
  good: "text-good", warn: "text-warn", bad: "text-destructive",
};

function ApplyForm({ prog, onApplied }: { prog: Programme; onApplied: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [err, setErr] = useState("");

  const apply = useMutation({
    mutationFn: () => api<{ message: string }>("/founder/funding/apply", {
      body: { programmeId: prog.id, amount: Number(amount) },
    }),
    onSuccess: (r) => {
      toast(r.message);
      setAmount(""); setErr("");
      void qc.invalidateQueries({ queryKey: ["founder", "funding"] });
      onApplied();
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Try again."),
  });

  return (
    <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
      <p className="text-xs font-medium text-primary">Apply to this programme</p>
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Label htmlFor={`amt-${prog.id}`} className="text-xs">How much do you need (R)?</Label>
          <Input
            id={`amt-${prog.id}`}
            type="number" min={prog.minAmount} max={prog.maxAmount}
            placeholder={`${R(prog.minAmount)} – ${R(prog.maxAmount)}`}
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setErr(""); }}
            className="mt-1 h-8 text-sm"
          />
        </div>
        <Button size="sm" onClick={() => apply.mutate()} disabled={apply.isPending || !amount}>
          {apply.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Apply
        </Button>
      </div>
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}

export default function FundingReadiness() {
  const q = useQuery({ queryKey: ["founder", "funding"], queryFn: () => api<FundingData>("/founder/funding") });
  const [appliedTo, setAppliedTo] = useState<string | null>(null);

  if (!q.data) return <><FounderHead title="Funding readiness" /><Spinner /></>;
  const d = q.data;

  const byGroup: Record<string, ReadinessItem[]> = {};
  for (const item of d.items) {
    (byGroup[item.group] ??= []).push(item);
  }

  const scoreColor = SCORE_COLOR[d.tone] ?? "text-foreground";

  return (
    <>
      <FounderHead
        title="Funding readiness"
        sub="Funders set their own requirements. See what each one checks and what you still need before you apply."
      />

      {/* Score card */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="sm:col-span-2">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-baseline gap-2">
              <span className={`text-5xl font-bold tabular-nums ${scoreColor}`}>{d.score}</span>
              <span className="text-xl text-muted-foreground font-medium">/ 100</span>
            </div>
            <Progress value={d.score} className="mt-3 h-2.5" />
            <div className="flex items-center justify-between mt-2">
              <span className={`text-sm font-semibold ${scoreColor}`}>{d.label}</span>
              <span className="text-xs text-muted-foreground">{d.recordMonths} months of records</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <BarChart3 className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wide font-semibold">Score breakdown</span>
            </div>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Documents</span>
                <span className="font-medium tabular-nums">
                  {d.items.filter((i) => i.group === "Documents" && i.ok).reduce((a, i) => a + i.pts, 0)} /
                  {d.items.filter((i) => i.group === "Documents").reduce((a, i) => a + i.pts, 0)} pts
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bookkeeping</span>
                <span className="font-medium tabular-nums">
                  {d.items.filter((i) => i.group === "Bookkeeping" && i.ok).reduce((a, i) => a + i.pts, 0)} /
                  {d.items.filter((i) => i.group === "Bookkeeping").reduce((a, i) => a + i.pts, 0)} pts
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Checklist */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">What funders check</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-5">
          {Object.entries(byGroup).map(([group, items]) => (
            <div key={group}>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">{group}</p>
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.key} className={`flex items-start justify-between gap-3 rounded-lg border p-3 ${item.ok ? "border-good/30 bg-good/5" : "border-border"}`}>
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      {item.ok
                        ? <CheckCircle2 className="h-4 w-4 text-good shrink-0 mt-0.5" />
                        : <XCircle className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-0.5" />}
                      <div className="min-w-0">
                        <p className={`text-sm font-medium ${item.ok ? "text-foreground" : "text-muted-foreground"}`}>{item.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.hint}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={item.ok ? "success" : "secondary"} className="text-[10px]">
                        +{item.pts} pts
                      </Badge>
                      {!item.ok && item.group === "Documents" && (
                        <Button size="sm" variant="outline" asChild className="h-7 text-xs">
                          <Link to="/app/start">Upload</Link>
                        </Button>
                      )}
                      {!item.ok && item.group === "Bookkeeping" && (
                        <Button size="sm" variant="outline" asChild className="h-7 text-xs">
                          <Link to="/app/books">Fix</Link>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Programmes */}
      {d.programmes.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold tracking-tight mb-3">Funding programmes</h2>
          <div className="space-y-3">
            {d.programmes.map((prog) => {
              const app = prog.application;
              const appMeta = app ? appStatusMeta(app.status) : null;
              return (
                <Card key={prog.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">{prog.name}</CardTitle>
                        <CardDescription className="mt-0.5">{prog.funderName}</CardDescription>
                      </div>
                      {prog.eligible && !app && (
                        <Badge variant="success" className="shrink-0">Eligible</Badge>
                      )}
                      {app && appMeta && (
                        <Badge variant={appMeta.variant} className="shrink-0">{appMeta.label}</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-3.5 w-3.5" />
                        {R(prog.minAmount)} – {R(prog.maxAmount)}
                      </span>
                      {prog.minScore > 0 && (
                        <span className="flex items-center gap-1">
                          <BarChart3 className="h-3.5 w-3.5" />
                          Score {prog.minScore}+ needed
                        </span>
                      )}
                      {prog.minMonths > 0 && (
                        <span>{prog.minMonths} months of records</span>
                      )}
                    </div>

                    {prog.requiredDocs.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {prog.requiredDocs.map((doc) => (
                          <Badge key={doc} variant="outline" className="text-[10px]">{doc.toUpperCase()}</Badge>
                        ))}
                      </div>
                    )}

                    {/* Already applied */}
                    {app && (
                      <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                        <p className="text-sm">
                          Applied {R(app.requestedAmount)} on {app.appliedOn}
                        </p>
                        {app.statusReason && (
                          <p className="text-xs text-muted-foreground">{app.statusReason}</p>
                        )}
                      </div>
                    )}

                    {/* Gaps */}
                    {!app && prog.gaps.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Still needed:</p>
                        {prog.gaps.map((gap) => (
                          <div key={gap} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <AlertCircle className="h-3.5 w-3.5 text-warn shrink-0" />
                            {gap}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Apply form */}
                    {prog.eligible && !app && appliedTo !== prog.id && (
                      <ApplyForm prog={prog} onApplied={() => setAppliedTo(prog.id)} />
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {d.programmes.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            No open funding programmes at the moment. Check back soon.
          </CardContent>
        </Card>
      )}
    </>
  );
}
