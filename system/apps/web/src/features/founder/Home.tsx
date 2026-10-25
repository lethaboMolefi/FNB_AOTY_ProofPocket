// Home dashboard — rebuilt with shadcn, skeleton loading, proper empty states.
import { R, plural, type Flag, type JourneyStep, type ReadinessItem, type Tone } from "@proofpocket/shared";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle, AlertTriangle, ArrowRight, BadgeCheck, BarChart3,
  CheckCircle2, ChevronRight, Info, Mail, TrendingDown, TrendingUp, Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { BarChart, type Point } from "../../components/charts";
import { api } from "../../lib/api";
import { useMe } from "../../lib/me";

interface HomeData {
  company: { name: string; typeLabel: string; area: string; employees: number; foundedYear: number; verified: boolean };
  notices: { starter: boolean; proofsToCheck: number; fraudOpen: number };
  journey: JourneyStep[];
  tiles: { moneyIn: number; moneyOut: number; cash: number; score: number; label: string; tone: Tone };
  series: Point[];
  nextSteps: ReadinessItem[];
  flags: Flag[];
  messages: { id: string; sender: string; verified: boolean; body: string }[];
}

const AREA: Record<string, string> = { township: "Township", urban: "Urban", rural: "Rural" };

const VIEW: Record<JourneyStep["view"], string> = {
  start: "start", books: "books", payments: "payments", cashflow: "cashflow", markets: "markets",
};

function scoreTone(score: number): Tone {
  if (score >= 70) return "good";
  if (score >= 40) return "warn";
  return "bad";
}

const TONE_TEXT: Record<Tone, string> = {
  good: "text-good", warn: "text-warn", bad: "text-destructive", info: "text-primary", plain: "text-muted-foreground",
};

// ─── Skeleton ────────────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted/60", className)} />;
}

function HomeSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-4 pb-4">
              <Skeleton className="h-3 w-28 mb-3" />
              <Skeleton className="h-8 w-24 mb-2" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Chart row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="pt-4 space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardContent className="pt-4">
            <Skeleton className="h-44 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Metric card ─────────────────────────────────────────────────────────────
function MetricCard({
  label, value, sub, icon: Icon, valueClass,
}: {
  label: string; value: string; sub?: string; icon: React.ElementType; valueClass?: string;
}) {
  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between mb-2">
          <p className="text-xs font-medium text-muted-foreground leading-tight">{label}</p>
          <Icon className="h-4 w-4 text-muted-foreground/60 shrink-0" />
        </div>
        <p className={cn("text-2xl font-bold tabular-nums tracking-tight", valueClass ?? "text-foreground")}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ─── Turnover Tax education card ─────────────────────────────────────────────
/**
 * Addresses the "SARS panic" feedback: many informal founders avoid registering
 * because they fear tax bills. Under SARS Turnover Tax, the first R335,000 in
 * annual turnover is taxed at 0%. Showing this removes the psychological barrier.
 */
function TurnoverTaxCard() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-primary shrink-0" />
          <CardTitle className="text-sm text-primary">Good news about SARS and tax</CardTitle>
        </div>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground text-xs shrink-0 mt-0.5 leading-none"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss tax information"
        >
          &times;
        </button>
      </CardHeader>
      <CardContent className="text-sm space-y-2 pb-4">
        <p>
          Under <strong>SARS Turnover Tax</strong>, micro-businesses pay{" "}
          <strong className="text-good">R0 tax</strong> on their first{" "}
          <strong>R335,000</strong> in annual turnover.
        </p>
        <p className="text-xs text-muted-foreground">
          A salon doing R5,000–R20,000 a month (R60,000–R240,000 a year) owes nothing in tax.
          Being registered with SARS unlocks funding you cannot get without it — it does not cost you.
        </p>
        <a
          href="https://www.sars.gov.za/types-of-tax/turnover-tax/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary underline underline-offset-2 pt-1"
        >
          Read more on the SARS website
          <ArrowRight className="h-3 w-3" />
        </a>
      </CardContent>
    </Card>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function Home() {
  const { data: me } = useMe();
  const q = useQuery({ queryKey: ["founder", "home"], queryFn: () => api<HomeData>("/founder/home") });

  if (!q.data) {
    if (q.isError) {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Couldn't load your dashboard. Check your connection.
          </div>
        </div>
      );
    }
    return <HomeSkeleton />;
  }

  const d = q.data;
  const c = d.company;
  const t = d.tiles;
  const businessName = me?.company?.name ?? c.name;
  const tone = scoreTone(t.score);

  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">{businessName}</h1>
            {c.verified
              ? <Badge variant="success" className="gap-1 text-xs"><BadgeCheck className="h-3 w-3" />Verified</Badge>
              : <Badge variant="secondary" className="text-xs">Starter</Badge>}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {c.typeLabel} · {AREA[c.area] ?? c.area} · {c.employees} {plural(c.employees, "person", "people")} · since {c.foundedYear}
          </p>
        </div>
        <Button size="sm" variant="outline" asChild>
          <Link to="/app/books">
            Add entry <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      {/* ── Notices ── */}
      {(d.notices.fraudOpen > 0 || d.notices.proofsToCheck > 0 || d.notices.starter) && (
        <div className="space-y-2">
          {d.notices.fraudOpen > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3.5">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1 text-sm min-w-0">
                <span className="font-semibold text-destructive">{d.notices.fraudOpen} possible {plural(d.notices.fraudOpen, "scam")}.</span>
                <span className="text-muted-foreground ml-1">Check before paying anyone.</span>
              </div>
              <Button size="sm" variant="destructive" asChild className="shrink-0">
                <Link to="/app/protection">Review</Link>
              </Button>
            </div>
          )}
          {d.notices.proofsToCheck > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-warn/30 bg-warn-soft/60 p-3.5">
              <AlertTriangle className="h-4 w-4 text-warn shrink-0 mt-0.5" />
              <div className="flex-1 text-sm min-w-0">
                <span className="font-semibold">{d.notices.proofsToCheck} {d.notices.proofsToCheck === 1 ? "client" : "clients"} {d.notices.proofsToCheck === 1 ? "says they've" : "say they've"} paid.</span>
                <span className="text-muted-foreground ml-1">Confirm in your banking app first.</span>
              </div>
              <Button size="sm" variant="outline" asChild className="shrink-0">
                <Link to="/app/payments">Check</Link>
              </Button>
            </div>
          )}
          {d.notices.starter && !d.notices.fraudOpen && !d.notices.proofsToCheck && (
            <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3.5">
              <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="flex-1 text-sm min-w-0">
                <span className="font-semibold">Starter account.</span>
                <span className="text-muted-foreground ml-1">Finish registration to get Verified — funders and buyers look for the badge.</span>
              </div>
              <Button size="sm" asChild className="shrink-0">
                <Link to="/app/start">Continue</Link>
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Turnover Tax education — only for Starter founders ── */}
      {d.notices.starter && <TurnoverTaxCard />}

      {/* ── Key metrics ── */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">        <MetricCard
          label="Money in this month"
          value={R(t.moneyIn)}
          sub="Revenue in books"
          icon={TrendingUp}
          valueClass="text-good"
        />
        <MetricCard
          label="Money out this month"
          value={R(t.moneyOut)}
          sub="Expenses in books"
          icon={TrendingDown}
        />
        <MetricCard
          label="Cash on hand"
          value={R(t.cash)}
          sub="Bank + cash"
          icon={Wallet}
        />
        {/* Score card — slightly richer */}
        <Card className="hover:shadow-sm transition-shadow">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground">Funding readiness</p>
              <BarChart3 className={cn("h-4 w-4 shrink-0", TONE_TEXT[tone])} />
            </div>
            <div className="flex items-baseline gap-1 mb-1.5">
              <span className={cn("text-2xl font-bold tabular-nums", TONE_TEXT[tone])}>{t.score}</span>
              <span className="text-sm text-muted-foreground">/100</span>
            </div>
            <Progress value={t.score} className="h-1.5 mb-1" />
            <p className={cn("text-xs font-medium", TONE_TEXT[tone])}>{t.label}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Journey + chart ── */}
      <div className="grid gap-4 lg:grid-cols-3">

        {/* Journey */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Your journey</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0">
            {d.journey.map((s, i) => (
              <Link
                key={s.title}
                to={`/app/${VIEW[s.view]}`}
                className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/50 group"
              >
                <div className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  s.done ? "bg-good/15 text-good" : "bg-primary/10 text-primary",
                )}>
                  {s.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span>{i + 1}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium leading-snug", s.done ? "text-muted-foreground line-through decoration-muted-foreground/40" : "text-foreground")}>
                    {s.title}
                  </p>
                  {!s.done && (
                    <p className="text-xs text-muted-foreground truncate">{s.detail}</p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/30 shrink-0 group-hover:text-muted-foreground transition-colors" />
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Six months at a glance</CardTitle>
            <Button size="sm" variant="ghost" asChild className="text-muted-foreground gap-1.5">
              <Link to="/app/cashflow">
                Cash flow <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="pb-3">
            {d.series.some((p) => p.moneyIn > 0 || p.moneyOut > 0) ? (
              <BarChart series={d.series} />
            ) : (
              <div className="flex items-center justify-center h-36 text-sm text-muted-foreground flex-col gap-2">
                <BarChart3 className="h-8 w-8 opacity-20" />
                Add bookkeeping entries to see your chart.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Next steps / flags / messages ── */}
      <div className="grid gap-4 lg:grid-cols-3">

        {/* Next steps */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Next steps</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-3 pb-3">
            {d.nextSteps.length ? (
              <div className="space-y-2">
                {d.nextSteps.map((item) => (
                  <div key={item.key} className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.hint}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <Badge variant="secondary" className="text-[10px]">+{item.pts} pts</Badge>
                      <Button size="sm" variant="outline" className="h-6 text-xs px-2" asChild>
                        <Link to={item.group === "Documents" ? "/app/start" : "/app/books"}>Fix</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-good shrink-0" />
                Everything funders check is in place.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Things to watch */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Things to watch</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-3 pb-3">
            {d.flags.length ? (
              <div className="space-y-2">
                {d.flags.map((f) => (
                  <div key={f.code} className={cn(
                    "flex items-start gap-2.5 rounded-lg border p-3",
                    f.level === "bad" ? "border-destructive/30 bg-destructive/5" : "border-warn/30 bg-warn-soft/50",
                  )}>
                    <AlertTriangle className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", f.level === "bad" ? "text-destructive" : "text-warn")} />
                    <p className="text-sm flex-1">{f.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-good shrink-0" />
                Nothing needs attention.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Messages */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Messages</CardTitle>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground gap-1" asChild>
              <Link to="/app/protection">
                <Mail className="h-3.5 w-3.5" /> All
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-0 px-3 pb-3">
            {d.messages.length ? (
              <div className="divide-y divide-border/50">
                {d.messages.map((m) => (
                  <div key={m.id} className="py-2.5 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-sm font-medium truncate">{m.sender}</span>
                      {m.verified
                        ? <Badge variant="success" className="text-[10px] shrink-0">Verified</Badge>
                        : <Badge variant="outline" className="text-[10px] shrink-0 text-muted-foreground">Unverified</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{m.body}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-6 text-sm text-muted-foreground">
                <Mail className="h-6 w-6 opacity-20" />
                No messages yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
