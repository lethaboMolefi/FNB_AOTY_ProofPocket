// Admin security & health: two-step status, recent security actions, scheduled jobs, email failures, rate limits.
import { useQuery } from "@tanstack/react-query";
import { Clock, Gauge, KeyRound, Mail, Server, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { LucideIcon } from "lucide-react";
import { ListRow, RowHint } from "../../components/ListRow";
import { PageHeader } from "../../components/PageHeader";
import { StatCard } from "../../components/StatCard";
import { ToneBadge } from "../../components/ToneBadge";
import { Spinner } from "../../components/ui";
import { api } from "../../lib/api";
import { when } from "./when";

interface Data {
  version: string;
  database: { reachable: boolean; time: string; version: string };
  chain: { rowsChecked: number; intact: boolean; firstBroken: number | null };
  twoFactor: { locked: { email: string; role: string; until: string }[]; staffWithout: { email: string; role: string }[]; foundersOn: number; foundersOff: number };
  recentSecurity: { at: string; action: string; role: string | null; person: string | null }[];
  jobs: { kind: "daily" | "weekly"; at: string; result: Record<string, number | boolean> }[];
  emailFailures: { lastWeek: number; recent: { at: string; subject: string }[] };
  rateLimits: { limiter: string; clients: number; hits: number; busiest: number }[];
}

const SUB = "Is anything going wrong? Sign-in security, scheduled checks, email and traffic limits.";
const JOB_LABELS: Record<string, string> = {
  requestsExpired: "Payment requests expired", documentsExpired: "Documents expired", filesChecked: "Files re-checked", filesMismatched: "Files changed",
  filesMissing: "Files missing", auditRowsChecked: "Audit rows checked", auditChainOk: "Audit chain intact", auditExported: "Audit rows exported",
  uploadsPurged: "Abandoned uploads removed", rateLimitRowsPurged: "Old rate-limit rows removed",
};

function Section({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Icon className="h-4 w-4 text-primary" aria-hidden="true" />{title}</CardTitle></CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

const None = ({ children }: { children: ReactNode }) => <p className="py-3 text-sm text-muted-foreground">{children}</p>;

export default function Health() {
  const q = useQuery({ queryKey: ["admin", "health"], queryFn: () => api<Data>("/admin/health"), refetchInterval: 60_000 });
  const head = <PageHeader label="ProofPocket admin" title="Security & health" sub={SUB} />;
  if (!q.data) return <>{head}<Spinner /></>;
  const d = q.data;
  const daily = d.jobs.find((j) => j.kind === "daily");
  const dailyLate = !daily || new Date(d.database.time).getTime() - new Date(daily.at).getTime() > 36 * 3600_000;
  return (
    <>
      {head}
      {!d.chain.intact && <Callout tone="bad" role="alert">Audit log chain broken at row {d.chain.firstBroken}. Rows may have been changed or removed outside ProofPocket.</Callout>}
      {d.twoFactor.locked.length > 0 && <Callout tone="warn" role="status">{d.twoFactor.locked.length} account{d.twoFactor.locked.length === 1 ? " is" : "s are"} locked out of Google Authenticator after wrong codes.</Callout>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Audit log" value={d.chain.intact ? "Intact" : "Broken"} sub={`${d.chain.rowsChecked} rows checked`} icon={ShieldCheck} valueClass={d.chain.intact ? "text-good" : "text-bad"} />
        <StatCard label="Staff without two-step" value={d.twoFactor.staffWithout.length} sub="Funders, advisers and admins" icon={KeyRound} valueClass={d.twoFactor.staffWithout.length ? "text-warn" : undefined} />
        <StatCard label="Founders with two-step" value={d.twoFactor.foundersOn} sub={`${d.twoFactor.foundersOff} without`} icon={KeyRound} />
        <StatCard label="Emails not sent" value={d.emailFailures.lastWeek} sub="Last 7 days" icon={Mail} valueClass={d.emailFailures.lastWeek ? "text-bad" : undefined} />
      </div>
      <div className="grid gap-6 desktop:grid-cols-2">
        <Section icon={KeyRound} title="Google Authenticator">
          {d.twoFactor.locked.length + d.twoFactor.staffWithout.length === 0 ? <None>No locked accounts, and every staff member has set it up.</None> : <ul>
            {d.twoFactor.locked.map((u) => <ListRow key={"l" + u.email} side={<ToneBadge tone="bad">Locked</ToneBadge>}><p className="font-medium">{u.email}</p><RowHint>{u.role} · until {when(u.until)}</RowHint></ListRow>)}
            {d.twoFactor.staffWithout.map((u) => <ListRow key={"s" + u.email} side={<ToneBadge tone="warn">Not set up</ToneBadge>}><p className="font-medium">{u.email}</p><RowHint>{u.role} · asked to set it up at next sign-in</RowHint></ListRow>)}
          </ul>}
        </Section>
        <Section icon={Clock} title="Scheduled checks">
          {dailyLate && <Callout tone="warn" className="mb-3">{daily ? `The daily check last ran ${when(daily.at)}, more than a day and a half ago.` : "The daily check hasn't run yet."}</Callout>}
          {d.jobs.length ? d.jobs.map((j) => (
            <div key={j.kind} className="border-b border-border py-3 last:border-0">
              <p className="font-medium">{j.kind === "daily" ? "Daily" : "Weekly"} · {when(j.at)}</p>
              <dl className="mt-1 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 text-sm">
                {Object.entries(j.result).filter(([k]) => JOB_LABELS[k]).map(([k, v]) => {
                  const bad = (k === "auditChainOk" && v === false) || ((k === "filesMismatched" || k === "filesMissing") && Number(v) > 0);
                  return <div key={k} className="contents"><dt className="text-muted-foreground">{JOB_LABELS[k]}</dt><dd className={bad ? "font-semibold text-bad" : "tabular-nums"}>{typeof v === "boolean" ? (v ? "Yes" : "No") : v}</dd></div>;
                })}
              </dl>
            </div>
          )) : <None>No runs recorded yet.</None>}
        </Section>
        <Section icon={Mail} title="Emails not sent">
          {d.emailFailures.recent.length ? <ul>{d.emailFailures.recent.map((e, i) => <ListRow key={i}><p>{e.subject || "(no subject)"}</p><RowHint>{when(e.at)}</RowHint></ListRow>)}</ul> : <None>Every email went out.</None>}
        </Section>
        <Section icon={Gauge} title="Traffic limits right now">
          {d.rateLimits.length ? <div className="overflow-x-auto"><Table>
            <TableHeader><TableRow><TableHead>Limit</TableHead><TableHead className="text-right">Clients</TableHead><TableHead className="text-right">Requests</TableHead><TableHead className="text-right">Busiest</TableHead></TableRow></TableHeader>
            <TableBody>{d.rateLimits.map((l) => <TableRow key={l.limiter}><TableCell>{l.limiter}</TableCell><TableCell className="text-right tabular-nums">{l.clients}</TableCell><TableCell className="text-right tabular-nums">{l.hits}</TableCell><TableCell className="text-right tabular-nums">{l.busiest}</TableCell></TableRow>)}</TableBody>
          </Table></div> : <None>No traffic in the current window.</None>}
        </Section>
      </div>
      <Section icon={ShieldCheck} title="Recent security actions">
        {d.recentSecurity.length ? <div className="overflow-x-auto"><Table>
          <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Who</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
          <TableBody>{d.recentSecurity.map((r, i) => <TableRow key={i}><TableCell className="whitespace-nowrap tabular-nums">{when(r.at)}</TableCell><TableCell>{r.person ?? "ProofPocket"}{r.role && <span className="block text-xs text-muted-foreground">{r.role}</span>}</TableCell><TableCell><ToneBadge tone="plain">{r.action}</ToneBadge></TableCell></TableRow>)}</TableBody>
        </Table></div> : <None>None yet.</None>}
      </Section>
      <Section icon={Server} title="System">
        <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Version</dt><dd className="font-mono">{d.version}</dd>
          <dt className="text-muted-foreground">Database</dt><dd>{d.database.reachable ? "Reachable" : "Not reachable"} · PostgreSQL {d.database.version}</dd>
          <dt className="text-muted-foreground">Database time</dt><dd className="tabular-nums">{when(d.database.time)}</dd>
        </dl>
      </Section>
    </>
  );
}
