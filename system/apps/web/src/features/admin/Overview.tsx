// Admin overview: how ProofPocket is doing today, from the database (totals only; no single founder's figures).
import { R } from "@proofpocket/shared";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Banknote, Building2, FileCheck, Flag, Inbox, ShieldAlert, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ListRow } from "../../components/ListRow";
import { PageHeader } from "../../components/PageHeader";
import { StatCard } from "../../components/StatCard";
import { ToneBadge } from "../../components/ToneBadge";
import { Spinner } from "../../components/ui";
import { api } from "../../lib/api";

interface Data {
  today: string;
  founders: { starters: number; verified: number; unfinished: number };
  organisations: { funders: number; incubators: number; buyers: number };
  users: number;
  waiting: { documents: number; portalApplications: number; reports: number; flaggedPayments: number };
  money: { month: string; moneyIn: number; moneyOut: number; entries: number };
  payments: { status: string; count: number }[];
  applications: { status: string; count: number }[];
  trend: { day: string; signups: number; joins: number; verified: number }[];
}

const SUB = "How ProofPocket is doing today: who's joining, what's waiting, and money recorded across all businesses.";
const LABEL = "ProofPocket admin";
const nice = (s: string) => s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

function Trend({ data }: { data: Data["trend"] }) {
  const series = [["signups", "Sign-ups", "bg-accent"], ["joins", "Finished joining", "bg-warn"], ["verified", "Verified", "bg-good"]] as const;
  const max = Math.max(1, ...data.flatMap((d) => [d.signups, d.joins, d.verified]));
  return (
    <div className="space-y-3">
      <div className="flex h-36 items-end gap-[3px]" role="img" aria-label={`Last 30 days: ${data.reduce((a, d) => a + d.signups, 0)} sign-ups, ${data.reduce((a, d) => a + d.joins, 0)} finished joining, ${data.reduce((a, d) => a + d.verified, 0)} verified`}>
        {data.map((d) => (
          <div key={d.day} className="flex h-full min-w-0 flex-1 items-end gap-px" title={`${d.day}: ${d.signups} sign-ups, ${d.joins} joined, ${d.verified} verified`}>
            {series.map(([k, , color]) => <div key={k} className={`${color} w-full rounded-t-sm`} style={{ height: `${(d[k] / max) * 100}%`, minHeight: d[k] ? 2 : 0 }} />)}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {series.map(([k, label, color]) => <span key={k} className="flex items-center gap-1.5"><span className={`${color} h-2.5 w-2.5 rounded-sm`} aria-hidden="true" />{label}: {data.reduce((a, d) => a + d[k], 0)}</span>)}
        <span>{data[0]?.day} to {data.at(-1)?.day}</span>
      </div>
    </div>
  );
}

export default function Overview() {
  const q = useQuery({ queryKey: ["admin", "overview"], queryFn: () => api<Data>("/admin/overview") });
  const head = <PageHeader label={LABEL} title="Overview" sub={SUB} />;
  if (!q.data) return <>{head}<Spinner /></>;
  const d = q.data;
  const attention = [
    { n: d.waiting.documents, text: "documents waiting for a check", to: "/admin/checks" },
    { n: d.waiting.portalApplications, text: "funder or NGO applications waiting", to: "/admin/applications" },
    { n: d.waiting.reports, text: "open reports", to: "/admin/reports" },
    { n: d.waiting.flaggedPayments, text: "flagged payment requests", to: "/admin/flagged" },
  ].filter((a) => a.n > 0);
  return (
    <>
      {head}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Verified businesses" value={d.founders.verified} sub={`${d.founders.starters} Starter · ${d.founders.unfinished} not finished joining`} icon={BadgeCheck} valueClass="text-good" />
        <StatCard label="People" value={d.users} sub="Accounts of every kind" icon={Users} />
        <StatCard label="Organisations" value={d.organisations.funders + d.organisations.incubators + d.organisations.buyers} sub={`${d.organisations.funders} funders · ${d.organisations.incubators} incubators · ${d.organisations.buyers} buyers`} icon={Building2} />
        <StatCard label={`Recorded in ${d.money.month}`} value={R(d.money.moneyIn)} sub={`${R(d.money.moneyOut)} out · ${d.money.entries} entries, all businesses`} icon={Banknote} />
        <StatCard label="Documents waiting" value={d.waiting.documents} icon={FileCheck} valueClass={d.waiting.documents ? "text-warn" : undefined} />
        <StatCard label="Applications waiting" value={d.waiting.portalApplications} sub="Funder and NGO portals" icon={Inbox} valueClass={d.waiting.portalApplications ? "text-warn" : undefined} />
        <StatCard label="Open reports" value={d.waiting.reports} icon={Flag} valueClass={d.waiting.reports ? "text-warn" : undefined} />
        <StatCard label="Flagged payments" value={d.waiting.flaggedPayments} sub="Proof rejected twice" icon={ShieldAlert} valueClass={d.waiting.flaggedPayments ? "text-bad" : undefined} />
      </div>
      <div className="grid gap-6 desktop:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Last 30 days</CardTitle><CardDescription>New accounts, businesses that finished joining, and businesses verified, per day.</CardDescription></CardHeader>
          <CardContent><Trend data={d.trend} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Needs attention</CardTitle></CardHeader>
          <CardContent className="pt-0">
            {attention.length ? <ul>{attention.map((a) => (
              <ListRow key={a.to} side={<Button size="sm" variant="outline" asChild><Link to={a.to}>Open</Link></Button>}><p><b>{a.n}</b> {a.text}</p></ListRow>
            ))}</ul> : <p className="py-4 text-sm text-muted-foreground">Nothing waiting.</p>}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-6 desktop:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Payment requests</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2 pt-0">{d.payments.length ? d.payments.map((p) => <ToneBadge key={p.status} tone={p.status === "flagged" ? "bad" : p.status === "paid" ? "good" : p.status === "checking" ? "warn" : "plain"}>{nice(p.status)}: {p.count}</ToneBadge>) : <span className="text-sm text-muted-foreground">None yet.</span>}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Funding applications</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2 pt-0">{d.applications.length ? d.applications.map((a) => <ToneBadge key={a.status} tone={a.status === "approved" ? "good" : a.status === "declined" ? "bad" : "plain"}>{nice(a.status)}: {a.count}</ToneBadge>) : <span className="text-sm text-muted-foreground">None yet.</span>}</CardContent>
        </Card>
      </div>
    </>
  );
}
