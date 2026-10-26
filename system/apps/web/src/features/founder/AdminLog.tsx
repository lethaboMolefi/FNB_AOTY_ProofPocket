// Admin decisions, for founders: when ProofPocket admins approved, turned down, suspended or reinstated a funder,
// adviser or buyer account. A summary only: no names, emails or reasons (POPIA).
import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "../../components/EmptyState";
import { ToneBadge } from "../../components/ToneBadge";
import { Spinner } from "../../components/ui";
import { api } from "../../lib/api";
import { when } from "../admin/when";
import { FounderHead } from "./FounderHead";

const SUB = "Who ProofPocket's admins let in, turned down or suspended, so you can see funders and advisers are checked. Names and reasons stay private.";
const TONE: Record<string, "good" | "bad" | "warn" | "plain"> = { Approved: "good", "Turned down": "bad", Suspended: "bad", Reinstated: "good" };
const ROLE: Record<string, string> = { funder: "Funder", adviser: "Incubator or NGO adviser", buyer: "Buyer" };

export default function AdminLog() {
  const q = useQuery({ queryKey: ["admin-log"], queryFn: () => api<{ entries: { at: string; action: string; role: string | null; organisation: string | null }[] }>("/admin-log") });
  return (
    <>
      <FounderHead title="Admin decisions" sub={SUB} />
      {!q.data ? <Spinner /> : !q.data.entries.length ? <EmptyState icon={ScrollText}>No decisions yet.</EmptyState> : (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Decision</TableHead><TableHead>Organisation</TableHead></TableRow></TableHeader>
            <TableBody>{q.data.entries.map((e, i) => (
              <TableRow key={i}>
                <TableCell className="whitespace-nowrap tabular-nums">{when(e.at)}</TableCell>
                <TableCell><ToneBadge tone={TONE[e.action] ?? "plain"}>{e.action}</ToneBadge></TableCell>
                <TableCell>{e.organisation ?? "—"}<span className="block text-xs text-muted-foreground">{e.role ? ROLE[e.role] ?? e.role : ""}</span></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </CardContent></Card>
      )}
    </>
  );
}
