// Document checks: advisers (their cohort) and the ProofPocket admin checker (companies without an incubator).
import { shortFingerprint } from "@proofpocket/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileCheck, FileText, Undo2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent } from "@/components/ui/card";
import { TextField } from "@/components/ui/field";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader } from "../../components/PageHeader";
import { LevelBadge } from "../../components/ToneBadge";
import { Spinner, useToast } from "../../components/ui";
import { API_BASE, ApiError, api } from "../../lib/api";

interface Item { id: string; docType: string; docName: string; companyName: string; cipcNumber: string | null; verified: boolean; fileId: string | null; fileName: string | null; sha256: string | null }

const EXPIRING = new Set(["tax", "bbbee", "csd"]);

function Row({ item, scope }: { item: Item; scope: "adviser" | "admin" }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [expires, setExpires] = useState("");
  const [err, setErr] = useState("");
  const done = async (r: { message: string }) => { toast(r.message); await qc.invalidateQueries({ queryKey: ["checks", scope] }); };
  const approve = useMutation({ mutationFn: () => api<{ message: string }>(`/${scope}/checks/${item.id}/approve`, { body: { expiresOn: expires || null } }), onSuccess: done, onError: (e) => setErr((e as ApiError).message) });
  const reject = useMutation({ mutationFn: () => api<{ message: string }>(`/${scope}/checks/${item.id}/reject`, { body: { reason } }), onSuccess: done, onError: (e) => setErr((e as ApiError).message) });
  const open = async () => {
    if (!item.fileId) return;
    try { const { url } = await api<{ url: string }>(`/files/${item.fileId}/download-url`); window.open(url.startsWith("/") ? `${API_BASE}${url}` : url, "_blank", "noopener"); }
    catch (e) { setErr((e as ApiError).message); }
  };
  return (
    <li className="flex flex-col gap-3 border-b border-border py-4 last:border-b-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2 text-sm"><b>{item.companyName}</b> · {item.docName} <LevelBadge verified={item.verified} /></div>
        <p className="fp font-mono text-xs text-muted-foreground">{item.fileName ?? "uploaded file"}{item.sha256 ? ` · fingerprint ${shortFingerprint(item.sha256)}` : ""}</p>
        {item.docType === "cipc" && item.cipcNumber && <p className="text-xs text-muted-foreground">CIPC number given: <span className="font-mono text-foreground">{item.cipcNumber}</span></p>}
        <div className="grid max-w-[520px] gap-3 pt-1.5 sm:grid-cols-2">
          <TextField label="Reason, if you send it back" value={reason} onChange={(e) => { setReason(e.target.value); setErr(""); }} />
          {EXPIRING.has(item.docType) && <TextField label="Valid until (optional)" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />}
        </div>
        {err && <Callout tone="bad" role="alert">{err}</Callout>}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {item.fileId && <Button size="sm" variant="outline" onClick={() => void open()}><FileText className="h-4 w-4" />Open file</Button>}
        <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate()}><CheckCircle2 className="h-4 w-4" />Approve</Button>
        <Button size="sm" variant="destructive" disabled={reject.isPending} onClick={() => (reason.trim() ? reject.mutate() : setErr("Add a reason so the founder knows what to fix"))}><Undo2 className="h-4 w-4" />Send back</Button>
      </div>
    </li>
  );
}

export default function Checks({ scope }: { scope: "adviser" | "admin" }) {
  const q = useQuery({ queryKey: ["checks", scope], queryFn: () => api<{ queue: Item[] }>(`/${scope}/checks`) });
  return (
    <>
      <PageHeader title={scope === "admin" ? "Checker queue" : "Document checks"}
        sub={scope === "admin"
          ? "Documents from companies without an incubator. Check each upload against the original or the issuer's records, then approve it or send it back with a reason."
          : "Check each upload against the original or the issuer's records, then approve it or send it back with a reason. A company becomes Verified when its four joining documents are approved."} />
      <Card>
        <CardContent className="pt-2">
          {!q.data ? <Spinner /> : q.data.queue.length
            ? <ul aria-label="Documents waiting">{q.data.queue.map((i) => <Row key={i.id} item={i} scope={scope} />)}</ul>
            : <EmptyState icon={FileCheck}>No documents waiting. New uploads {scope === "admin" ? "from companies without an incubator" : "from your companies"} appear here.</EmptyState>}
        </CardContent>
      </Card>
    </>
  );
}
