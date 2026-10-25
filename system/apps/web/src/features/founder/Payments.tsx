// Payments — create requests, share links, check proofs. ProofPocket never moves money.
import { R, RAILS, RAIL_KEYS, shortDate, type Rail } from "@proofpocket/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  AlertCircle, BadgeCheck, CheckCircle2, ClipboardCopy, ExternalLink,
  Loader2, Plus, XCircle, Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Spinner, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { FounderHead } from "./FounderHead";

type ProofCheck = { code: string; ok: boolean; text: string };
interface Proof {
  payerName: string; amount: number; paidOn: string; method: Rail;
  usedReference: boolean; checks: ProofCheck[]; status: string;
}
interface PayReq {
  id: string; ref: string; clientName: string; amount: number; description: string;
  rails: Rail[]; status: string; requestedOn: string; expiresAt: string | null;
  publicLink: string; proof: Proof | null;
}
interface PaymentsData {
  paymentDetails: { bank: string; accountName: string; accountLast4: string | null; shapId: string; inBusinessName: boolean | null } | null;
  requests: PayReq[];
}

const STATUS_META: Record<string, { label: string; variant: "secondary" | "warning" | "success" | "destructive" | "outline" }> = {
  waiting:      { label: "Waiting",       variant: "secondary" },
  checking:     { label: "Check proof",   variant: "warning" },
  paid:         { label: "Paid",          variant: "success" },
  not_received: { label: "Not received",  variant: "warning" },
  flagged:      { label: "Flagged",       variant: "destructive" },
  expired:      { label: "Expired",       variant: "outline" },
  cancelled:    { label: "Cancelled",     variant: "outline" },
};

const RAIL_LABELS: Record<string, string> = { payshap: "PayShap", eft: "EFT", cash: "Cash", card_machine: "Card machine", payfast: "Card/EFT (PayFast)" };

function ProofSection({ req, onAction }: { req: PayReq; onAction: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const confirm = useMutation({
    mutationFn: (action: "received" | "not-received") =>
      api<{ message: string }>(`/founder/payments/${req.id}/${action}`, { body: {} }),
    onSuccess: (r) => { toast(r.message); void qc.invalidateQueries({ queryKey: ["founder", "payments"] }); onAction(); },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Try again."),
  });

  if (!req.proof) return null;
  const p = req.proof;
  const allOk = p.checks.every((c) => c.ok);

  return (
    <div className="mt-2 rounded-lg border border-border bg-muted/30 p-3 space-y-2">
      <button
        type="button"
        className="flex w-full items-center justify-between text-sm font-medium"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="flex items-center gap-1.5">
          {allOk
            ? <CheckCircle2 className="h-4 w-4 text-good" />
            : <AlertCircle className="h-4 w-4 text-warn" />}
          Proof from {p.payerName} · {R(p.amount)} via {RAIL_LABELS[p.method] ?? p.method}
        </span>
        <span className="text-xs text-muted-foreground">{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div className="space-y-1.5 pt-1">
          {p.checks.map((c) => (
            <div key={c.code} className="flex items-start gap-2 text-sm">
              {c.ok
                ? <CheckCircle2 className="h-3.5 w-3.5 text-good shrink-0 mt-0.5" />
                : <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />}
              <span className={c.ok ? "text-foreground" : "text-destructive"}>{c.text}</span>
            </div>
          ))}
        </div>
      )}
      {req.status === "checking" && (
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={() => confirm.mutate("received")} disabled={confirm.isPending}>
            {confirm.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Money is in my account
          </Button>
          <Button size="sm" variant="outline" onClick={() => confirm.mutate("not-received")} disabled={confirm.isPending}>
            Not received
          </Button>
        </div>
      )}
    </div>
  );
}

function CreateRequestForm({ onCreated }: { onCreated: (link: string, ref: string) => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [f, setF] = useState({ clientName: "", amount: "", description: "" });
  const [selectedRails, setSelectedRails] = useState<Rail[]>(["payshap", "eft"]);
  const [err, setErr] = useState("");

  const create = useMutation({
    mutationFn: () => api<{ ref: string; publicLink: string; message: string }>("/founder/payments", {
      body: { clientName: f.clientName.trim(), amount: Number(f.amount), description: f.description.trim(), rails: selectedRails },
    }),
    onSuccess: (r) => {
      toast(r.message);
      setF({ clientName: "", amount: "", description: "" });
      setErr("");
      void qc.invalidateQueries({ queryKey: ["founder", "payments"] });
      onCreated(r.publicLink, r.ref);
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Try again."),
  });

  const toggleRail = (rail: Rail) =>
    setSelectedRails((prev) => prev.includes(rail) ? prev.filter((r) => r !== rail) : [...prev, rail]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Create a payment request</CardTitle>
        <CardDescription>Send the link to your client — they pay directly into your account.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-2">
            <Label htmlFor="p-client">Client name</Label>
            <Input id="p-client" placeholder="e.g. Thandi Mokoena" value={f.clientName}
              onChange={(e) => setF({ ...f, clientName: e.target.value })} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="p-amount">Amount (R)</Label>
            <Input id="p-amount" type="number" min={1} step="0.01" inputMode="decimal" placeholder="0"
              value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="p-desc">What for (optional)</Label>
            <Input id="p-desc" placeholder="e.g. Lash lift" maxLength={200}
              value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className="mt-1.5" />
          </div>
        </div>

        <div className="mt-3">
          <Label>Payment methods</Label>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {(RAIL_KEYS as Rail[]).map((rail) => (
              <button
                key={rail} type="button"
                onClick={() => toggleRail(rail)}
                className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${
                  selectedRails.includes(rail)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-foreground"
                }`}
              >
                {RAIL_LABELS[rail]}
              </button>
            ))}
          </div>
        </div>

        {err && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive mt-3" role="alert">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{err}
          </div>
        )}
        <div className="flex justify-end mt-4">
          <Button onClick={() => create.mutate()} disabled={create.isPending || !f.clientName || !f.amount || !selectedRails.length}>
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create request
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Payments() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["founder", "payments"], queryFn: () => api<PaymentsData>("/founder/payments") });
  const toast = useToast();
  const [newLink, setNewLink] = useState<{ link: string; ref: string } | null>(null);

  const cancel = useMutation({
    mutationFn: (id: string) => api<{ message: string }>(`/founder/payments/${id}/cancel`, { body: {} }),
    onSuccess: (r) => { toast(r.message); void qc.invalidateQueries({ queryKey: ["founder", "payments"] }); },
  });

  if (!q.data) return <><FounderHead title="Payments" sub="Clients pay you directly. ProofPocket records every payment and checks proofs." /><Spinner /></>;
  const d = q.data;

  return (
    <>
      <FounderHead title="Payments" sub="Clients pay you directly. ProofPocket records every payment and checks proofs." />

      {/* New link just created */}
      {newLink && (
        <div className="rounded-lg border border-good/30 bg-good/5 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-good" />
            <span className="text-sm font-semibold text-good">Request {newLink.ref} created — share this link:</span>
          </div>
          <div className="flex gap-2">
            <Input readOnly value={newLink.link} className="font-mono text-xs" />
            <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard.writeText(newLink.link); toast("Link copied."); }}>
              <ClipboardCopy className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={newLink.link} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
            </Button>
          </div>
          <button type="button" className="text-xs text-muted-foreground hover:underline" onClick={() => setNewLink(null)}>Dismiss</button>
        </div>
      )}

      {/* Bank details notice */}
      {d.paymentDetails ? (
        <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-start gap-3">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
          <div className="text-sm">
            <span className="font-medium">{d.paymentDetails.bank}</span>
            {d.paymentDetails.accountName && <> · {d.paymentDetails.accountName}</>}
            {d.paymentDetails.accountLast4 && <> · ···{d.paymentDetails.accountLast4}</>}
            {d.paymentDetails.shapId && <> · PayShap: {d.paymentDetails.shapId}</>}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-warn/30 bg-warn-soft/50 p-3 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-warn shrink-0 mt-0.5" />
          <p className="text-sm">Add your bank details in <strong>Registration steps</strong> so clients know where to pay.</p>
        </div>
      )}

      <CreateRequestForm onCreated={(link, ref) => setNewLink({ link, ref })} />

      {/* Requests table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your payment requests</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ref</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="hidden sm:table-cell">Methods</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.requests.map((req) => {
                const meta = STATUS_META[req.status] ?? { label: req.status, variant: "outline" as const };
                return (
                  <TableRow key={req.id}>
                    <TableCell className="font-mono text-sm font-medium">{req.ref}</TableCell>
                    <TableCell className="text-sm">{req.clientName}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{R(req.amount)}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {req.rails.map((rail) => (
                          <Badge key={rail} variant="outline" className="text-[10px]">{RAIL_LABELS[rail] ?? rail}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                        {req.status === "checking" && req.proof && (
                          <ProofSection req={req} onAction={() => {}} />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{shortDate(req.requestedOn)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button size="sm" variant="ghost" asChild>
                          <a href={req.publicLink} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { void navigator.clipboard.writeText(req.publicLink); toast("Link copied."); }}>
                          <ClipboardCopy className="h-3.5 w-3.5" />
                        </Button>
                        {["waiting", "not_received"].includes(req.status) && (
                          <Button size="sm" variant="ghost" onClick={() => cancel.mutate(req.id)}>
                            <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!d.requests.length && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No payment requests yet. Create one above.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        <Info className="h-4 w-4 mt-0.5 shrink-0 text-foreground/60" />
        <p>ProofPocket never holds or moves money. Clients pay you directly. Always check your banking app before confirming — not just the screenshot.</p>
      </div>
    </>
  );
}
