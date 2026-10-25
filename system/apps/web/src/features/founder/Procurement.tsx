// Procurement (v2/app.js vProcurement).
import { R, shortDate, type DocType } from "@proofpocket/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building, Calendar, CheckCircle2, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Spinner, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { FounderHead } from "./FounderHead";

interface Data {
  recordMonths: number; verified: boolean; tenderDocs: number;
  tenders: { id: string; title: string; buyer: string; value: number; closesOn: string; months: number; yourSector: boolean; requirements: { docType: DocType; short: string; ok: boolean }[]; monthsOk: boolean;
    action: { kind: "verify_first" } | { kind: "add_documents"; missing: DocType[] } | { kind: "more_months"; months: number } | { kind: "can_express" }; interest: string | null }[];
}
const SUB = "Tenders and supplier opportunities. Buyers see your checked documents and your track record on ProofPocket, so you don't have to prove it from scratch each time.";

function Stat({ label, children, note }: { label: string; children: ReactNode; note?: ReactNode }) {
  return (
    <Card>
      <CardContent className="space-y-1.5 pt-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="text-2xl font-bold tabular-nums">{children}</div>
        {note}
      </CardContent>
    </Card>
  );
}

const Need = ({ ok, children }: { ok: boolean; children: ReactNode }) => (
  <Badge variant={ok ? "success" : "outline"} className="gap-1 font-normal">
    {ok ? <CheckCircle2 className="h-3 w-3" aria-label="Have it" /> : <XCircle className="h-3 w-3 text-bad" aria-label="Missing" />}{children}
  </Badge>
);

export default function Procurement() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["founder", "procurement"], queryFn: () => api<Data>("/founder/procurement") });
  if (!q.data) return <><FounderHead title="Procurement" sub={SUB} /><Spinner /></>;
  const d = q.data;
  const interest = async (id: string) => {
    try { toast((await api<{ message: string }>(`/founder/tenders/${id}/interest`, { body: {} })).message); void qc.invalidateQueries({ queryKey: ["founder", "procurement"] }); }
    catch (e) { toast((e as ApiError).message); }
  };
  return (
    <>
      <FounderHead title="Procurement" sub={SUB} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Track record" note={<Progress value={Math.min(100, (d.recordMonths / 6) * 100)} className="h-2" aria-label={`${d.recordMonths} of 6 months`} />}>
          {d.recordMonths}<span className="text-sm font-normal text-muted-foreground"> of 6 months</span>
        </Stat>
        <Stat label="Account" note={<p className="text-xs text-muted-foreground">{d.verified ? "Buyers can check your documents" : "Verify to apply"}</p>}>
          {d.verified ? "Verified" : "Starter"}
        </Stat>
        <Stat label="Tender documents" note={<p className="text-xs text-muted-foreground">Tax, CSD, B-BBEE</p>}>
          {d.tenderDocs}<span className="text-sm font-normal text-muted-foreground"> of 3</span>
        </Stat>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Open tenders</h2>
        {d.tenders.length ? d.tenders.map((t) => (
          <Card key={t.id}>
            <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-3">
              <div className="min-w-0">
                <CardTitle as="h3" className="text-base">{t.title}</CardTitle>
                <CardDescription className="mt-1 flex flex-wrap items-center gap-1.5"><Building className="h-3.5 w-3.5" />{t.buyer}{t.yourSector && <Badge className="text-[10px]">Your sector</Badge>}</CardDescription>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-lg font-bold tabular-nums">{R(t.value)}</p>
                <p className="mt-0.5 flex items-center justify-end gap-1 text-xs text-muted-foreground"><Calendar className="h-3 w-3" />Closes {shortDate(t.closesOn)}</p>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-wrap gap-1.5">
                {t.requirements.map((r) => <Need key={r.docType} ok={r.ok}>{r.short}</Need>)}
                <Need ok={t.monthsOk}>{t.months} months' record</Need>
              </div>
              <div className="shrink-0">
                {t.interest ? <Badge variant="success">{t.interest === "arranged" ? "Passed to buyer" : t.interest === "declined" ? "Not taken further" : "Interest sent"}</Badge>
                  : t.action.kind === "verify_first" ? <Badge variant="secondary">Verify first</Badge>
                  : t.action.kind === "add_documents" ? <Button size="sm" variant="outline" asChild><Link to="/app/start">Add {t.action.missing.length} document{t.action.missing.length > 1 ? "s" : ""}</Link></Button>
                  : t.action.kind === "more_months" ? <Badge variant="secondary">{t.action.months} more month{t.action.months > 1 ? "s" : ""}</Badge>
                  : <Button size="sm" onClick={() => void interest(t.id)}>Express interest</Button>}
              </div>
            </CardContent>
          </Card>
        )) : <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No open tenders right now.</CardContent></Card>}
      </section>
    </>
  );
}
