// The funder's part of the company drawer (v2/app.js funderDrawerPart): applications, offers, invite.
import { R } from "@proofpocket/shared";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, Inbox, PenLine, Send, Users, XCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect, TextField } from "@/components/ui/field";
import { CompanyDrawer, type Drawer } from "../../components/CompanyDrawer";
import { EmptyState } from "../../components/EmptyState";
import { ToneBadge } from "../../components/ToneBadge";
import { useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { OfferHistory, type Application } from "../founder/Funding";

type FunderDrawerData = Drawer & { applications: Application[]; invitable: { id: string; name: string; gaps: number }[] };

function AppCard({ a, refresh }: { a: Application; refresh: () => void }) {
  const toast = useToast();
  const [amount, setAmount] = useState(String(a.currentOffer));
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const done = ["approved", "declined", "withdrawn"].includes(a.status);
  const call = async (path: string, body: object, confirmText?: string) => {
    setErr("");
    try { toast((await api<{ message: string }>(path, { body })).message); setReason(""); refresh(); }
    catch (e) {
      const x = e as ApiError;
      if (x.code === "over_budget" && window.confirm(x.message)) return call(path, { ...body, confirmOverBudget: true });
      setErr(confirmText ?? x.message);
    }
  };
  return (
    <Card className="bg-surface-2">
      <CardContent className="space-y-3 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div><p className="font-semibold">{a.programme}</p><p className="text-xs text-muted-foreground">Requested {R(a.requested)} · current offer {R(a.currentOffer)}</p></div>
          <ToneBadge tone={a.statusTone}>{a.statusLabel}</ToneBadge>
        </div>
        {a.reasonRequested && <Callout tone="warn">The founder asked why the offer changed. Add a reason with your next change.</Callout>}
        <OfferHistory offers={a.offers} />
        {a.statusReason && <p className="text-sm">{a.statusReason}</p>}
        {!done && (
          <form className="space-y-3" noValidate onSubmit={(e) => { e.preventDefault(); if (!reason.trim()) { setErr("Add a reason. Founders see every change to their offer."); return; } void call(`/funder/applications/${a.id}/offer`, { amount: Number(amount), reason }); }}>
            <div className="grid gap-3 sm:grid-cols-3">
              <TextField label="New offer (R)" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
              <TextField className="sm:col-span-2" label="Reason the founder will see" placeholder="e.g. Quarterly budget reduced by 30%" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" type="submit"><PenLine className="h-4 w-4" />Change offer</Button>
              <Button size="sm" type="button" onClick={() => void call(`/funder/applications/${a.id}/approve`, { reason })}><CheckCircle2 className="h-4 w-4" />Approve current offer</Button>
              <Button size="sm" variant="destructive" type="button" onClick={() => (reason.trim() ? void call(`/funder/applications/${a.id}/decline`, { reason }) : setErr("Add a reason before declining. The founder will see it."))}><XCircle className="h-4 w-4" />Decline</Button>
              {a.status === "submitted" && <Button size="sm" variant="ghost" type="button" onClick={() => void call(`/funder/applications/${a.id}/status`, { status: "under_review", reason })}><Clock className="h-4 w-4" />Mark under review</Button>}
              <Button size="sm" variant="ghost" type="button" onClick={() => (reason.trim() ? void call(`/funder/applications/${a.id}/status`, { status: "awaiting_cofunding", reason }) : setErr("Say what co-funding the founder needs to find."))}><Users className="h-4 w-4" />Awaiting co-funding</Button>
            </div>
            {err && <Callout tone="bad" role="alert">{err}</Callout>}
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export function FunderDrawer({ companyId, onClose }: { companyId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [prog, setProg] = useState("");
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["drawer"] }); void qc.invalidateQueries({ queryKey: ["funder"] }); };
  return (
    <CompanyDrawer<FunderDrawerData> path={`/funder/companies/${companyId}`} onClose={onClose}>
      {(d) => (
        <Card>
          <CardHeader className="pb-2"><CardTitle as="h3" className="flex items-center gap-2 text-base"><Inbox className="h-4 w-4 text-primary" aria-hidden="true" />Applications to you</CardTitle></CardHeader>
          <CardContent className="space-y-3 pt-0">
            {d.applications.length ? d.applications.map((a) => <AppCard key={a.id} a={a} refresh={refresh} />) : <EmptyState icon={Inbox}>No applications from this company yet.</EmptyState>}
            {d.invitable.length > 0 && (
              <div className="flex flex-wrap items-end gap-2">
                <NativeSelect className="min-w-[220px] flex-1" label="Invite to apply" value={prog} onChange={(e) => setProg(e.target.value)}>
                  <option value="">Choose a programme…</option>
                  {d.invitable.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.gaps ? `still needs ${p.gaps} thing${p.gaps > 1 ? "s" : ""}` : "qualifies now"}</option>)}
                </NativeSelect>
                <Button variant="outline" disabled={!prog} onClick={() => void api<{ message: string }>(`/funder/companies/${companyId}/invite`, { body: { programmeId: prog } }).then((r) => { toast(r.message); refresh(); }, (e: ApiError) => toast(e.message))}><Send className="h-4 w-4" />Send invite</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </CompanyDrawer>
  );
}
