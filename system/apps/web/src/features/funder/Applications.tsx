// Applications (v2/app.js funderApplications).
import { R, shortDate } from "@proofpocket/shared";
import { useQuery } from "@tanstack/react-query";
import { Inbox, PanelRightOpen } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScoreCell } from "../../components/charts";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader } from "../../components/PageHeader";
import { ToneBadge } from "../../components/ToneBadge";
import { Spinner } from "../../components/ui";
import { api } from "../../lib/api";
import type { Application } from "../founder/Funding";
import { FunderDrawer } from "./FunderDrawer";

const SUB = "Every change to an offer needs a reason, and founders see the full history.";

export default function Applications() {
  const q = useQuery({ queryKey: ["funder", "applications"], queryFn: () => api<{ funder: { name: string }; applications: (Application & { score: number | null })[] }>("/funder/applications") });
  const [open, setOpen] = useState<string | null>(null);
  if (!q.data) return <><PageHeader title="Applications" sub={SUB} /><Spinner /></>;
  return (
    <>
      <PageHeader label={q.data.funder.name} title="Applications" sub={SUB} />
      <Card><CardContent className="p-0">
        {q.data.applications.length ? (
          <Table>
            <TableHeader><TableRow><TableHead>Company</TableHead><TableHead>Programme</TableHead><TableHead className="text-right">Requested</TableHead><TableHead className="text-right">Current offer</TableHead><TableHead>Status</TableHead><TableHead>Readiness</TableHead><TableHead className="relative"><span className="sr-only">Open</span></TableHead></TableRow></TableHeader>
            <TableBody>{q.data.applications.map((a) => (
              <TableRow key={a.id}>
                <TableCell><div className="font-medium">{a.company}</div><div className="text-xs text-muted-foreground">{shortDate(a.appliedOn)}</div></TableCell>
                <TableCell>{a.programme}</TableCell>
                <TableCell className="text-right tabular-nums">{R(a.requested)}</TableCell>
                <TableCell className="text-right tabular-nums">{R(a.currentOffer)}
                  {a.changedWithoutReason && <div className="text-xs text-bad">No reason given</div>}
                  {a.reasonRequested && <div className="text-xs text-warn">Founder asked why</div>}</TableCell>
                <TableCell><ToneBadge tone={a.statusTone}>{a.statusLabel}</ToneBadge></TableCell>
                <TableCell>{a.score !== null ? <ScoreCell score={a.score} /> : "—"}</TableCell>
                <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => setOpen(a.companyId)}><PanelRightOpen className="h-4 w-4" />Open</Button></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        ) : <EmptyState icon={Inbox}>No applications yet.</EmptyState>}
      </CardContent></Card>
      {open && <FunderDrawer companyId={open} onClose={() => setOpen(null)} />}
    </>
  );
}
