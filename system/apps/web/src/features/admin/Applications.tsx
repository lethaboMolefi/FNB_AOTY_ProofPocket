// Applications for a funder or support-organisation portal. Approving creates the organisation and the person's
// account; turning one down needs a reason, which the applicant sees and is emailed.
import { R, shortDate } from "@proofpocket/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, CheckCircle2, Loader2, Users } from "lucide-react";
import { useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHead, Spinner, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";

interface Application {
  id: string; kind: "funder" | "support_org"; status: "pending" | "approved" | "rejected"; email: string; contactName: string; orgName: string;
  idNumber: string; details: Record<string, unknown>; reason: string | null; sentOn: string; reviewedOn: string | null;
}

const LABELS: Record<string, string> = {
  repRole: "Role", contactRole: "Role", repEmail: "Work email", contactEmail: "Work email", repPhone: "Cellphone", contactPhone: "Cellphone",
  entityType: "Type", orgType: "Type", website: "Website", email: "Organisation email", orgEmail: "Organisation email", phone: "Organisation phone",
  orgPhone: "Organisation phone", province: "Province", town: "Town", physicalAddress: "Address", cipcNumber: "CIPC number", npoNumber: "NPO number",
  sectors: "Sectors", stages: "Stages", instruments: "How they fund", ticketMin: "Smallest amount", ticketMax: "Largest amount", aumBand: "Funds under management",
  beneficiaryGroups: "Who they support", foundedYear: "Year started", annualBudgetBand: "Yearly budget", description: "Description",
};
const show = (k: string, v: unknown) => (Array.isArray(v) ? v.join(", ") : (k === "ticketMin" || k === "ticketMax") && typeof v === "number" ? R(v) : String(v ?? ""));

function Decide({ a }: { a: Application }) {
  const toast = useToast();
  const qc = useQueryClient();
  const reasonId = useId();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const decide = async (body: object) => {
    setErr(""); setBusy(true);
    try {
      toast((await api<{ message: string }>(`/admin/applications/${a.id}`, { body })).message);
      await qc.invalidateQueries({ queryKey: ["admin", "applications"] });
      await qc.invalidateQueries({ queryKey: ["founder", "counts"] });
    } catch (x) { setErr(x instanceof ApiError ? x.message : "Try again."); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      {rejecting && (
        <div className="space-y-1.5">
          <Label htmlFor={reasonId}>Reason the applicant will see</Label>
          <Textarea id={reasonId} rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      )}
      {err && <Callout tone="bad" role="alert">{err}</Callout>}
      <div className="flex flex-wrap gap-2">
        {!rejecting && <Button disabled={busy} onClick={() => window.confirm(`Approve ${a.orgName}? ${a.contactName} gets a ${a.kind === "funder" ? "funder" : "support organisation"} portal.`) && void decide({ decision: "approve" })}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Approve
        </Button>}
        {rejecting
          ? <><Button variant="destructive" disabled={busy} onClick={() => void decide({ decision: "reject", reason })}>Turn down</Button><Button variant="ghost" onClick={() => setRejecting(false)}>Cancel</Button></>
          : <Button variant="outline" onClick={() => setRejecting(true)}>Turn down…</Button>}
      </div>
    </div>
  );
}

export default function Applications() {
  const q = useQuery({ queryKey: ["admin", "applications"], queryFn: () => api<{ applications: Application[] }>("/admin/applications") });
  const sub = "Funders and support organisations asking for a portal. Call the contact person and check the registration before you approve.";
  if (!q.data) return <><PageHead label="ProofPocket admin" title="Applications" sub={sub} /><Spinner /></>;
  const pending = q.data.applications.filter((a) => a.status === "pending");
  const decided = q.data.applications.filter((a) => a.status !== "pending");
  return (
    <>
      <PageHead label="ProofPocket admin" title="Applications" sub={sub} />
      {!pending.length && <Callout tone="good">No applications waiting.</Callout>}
      {pending.map((a) => (
        <Card key={a.id} role="group" aria-label={a.orgName}>
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-3">
            <div className="min-w-0 space-y-1.5">
              <CardTitle className="flex items-center gap-2 text-base">{a.kind === "funder" ? <Building2 className="h-4 w-4 text-primary" /> : <Users className="h-4 w-4 text-primary" />}{a.orgName}</CardTitle>
              <CardDescription>{a.contactName} · {a.email} · ID {a.idNumber} · sent {shortDate(a.sentOn.slice(0, 10))}</CardDescription>
            </div>
            <Badge variant="secondary" className="shrink-0">{a.kind === "funder" ? "Funder" : "Support organisation"}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {Object.entries(a.details).filter(([k, v]) => LABELS[k] && v !== undefined && v !== "" && !(Array.isArray(v) && !v.length)).map(([k, v]) => (
                <div key={k} className={k === "description" || k === "physicalAddress" ? "sm:col-span-2" : ""}>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">{LABELS[k]}</dt>
                  <dd className="break-words">{show(k, v)}</dd>
                </div>
              ))}
            </dl>
            <Decide a={a} />
          </CardContent>
        </Card>
      ))}
      {decided.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Decided</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {decided.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2 text-sm last:border-0">
                <span><b>{a.orgName}</b> · {a.contactName}{a.reason && <span className="text-muted-foreground"> · {a.reason}</span>}</span>
                <Badge variant={a.status === "approved" ? "success" : "destructive"}>{a.status === "approved" ? "Approved" : "Turned down"}{a.reviewedOn ? ` ${shortDate(a.reviewedOn.slice(0, 10))}` : ""}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}
