// Support log (v2/app.js ngoSupport): log support, introductions and tender interest to arrange, history.
import { SUPPORT_TYPES, shortDate } from "@proofpocket/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ClipboardList, Handshake, History, Save, X } from "lucide-react";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "../../components/EmptyState";
import { ListRow, RowHint } from "../../components/ListRow";
import { PageHeader } from "../../components/PageHeader";
import { ToneBadge } from "../../components/ToneBadge";
import { Spinner, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";

interface Data {
  incubator: string; companies: { id: string; name: string }[];
  logs: { id: string; company: string; date: string; type: string; note: string }[];
  intros: { id: string; company: string; buyer: string; status: string }[];
  tenderInterests: { id: string; company: string; title: string; status: string }[];
}

const SUB = "Record every intervention so funders and your monitoring and evaluation reports show what support each company received.";

/** An introduction or tender-interest request: arrange or decline (adviser and admin). Renders an <li>. */
export function RequestRow({ text, status, onDecide }: { text: ReactNode; status: string; onDecide: (s: "arranged" | "declined") => void }) {
  return (
    <ListRow side={status === "requested" ? <>
      <Button size="sm" onClick={() => onDecide("arranged")}><CheckCircle2 className="h-4 w-4" />Mark arranged</Button>
      <Button size="sm" variant="outline" onClick={() => onDecide("declined")}><X className="h-4 w-4" />Decline</Button>
    </> : <ToneBadge tone={status === "arranged" ? "good" : "plain"}>{status === "arranged" ? "Arranged" : "Declined"}</ToneBadge>}>
      <p>{text}</p>
    </ListRow>
  );
}

export default function Support() {
  const qc = useQueryClient();
  const toast = useToast();
  const noteId = useId();
  const q = useQuery({ queryKey: ["adviser", "support"], queryFn: () => api<Data>("/adviser/support") });
  const [f, setF] = useState({ companyId: "", type: SUPPORT_TYPES[0] as string, note: "" });
  const [err, setErr] = useState("");
  if (!q.data) return <><PageHeader title="Support log" sub={SUB} /><Spinner /></>;
  const d = q.data;
  const call = async (path: string, body: object) => {
    try { toast((await api<{ message: string }>(path, { body })).message); void qc.invalidateQueries({ queryKey: ["adviser"] }); return true; }
    catch (e) { setErr((e as ApiError).message); return false; }
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr("");
    if (!f.note.trim()) { setErr("Add a note about the support"); return; }
    if (await call("/adviser/support", { ...f, companyId: f.companyId || d.companies[0]?.id })) setF({ ...f, note: "" });
  };
  return (
    <>
      <PageHeader label={d.incubator} title="Support log" sub={SUB} />
      <Card>
        <form onSubmit={submit} noValidate>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><ClipboardList className="h-4 w-4 text-primary" aria-hidden="true" />Log support</CardTitle>
            <CardDescription>Shows on the company's timeline.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <NativeSelect label="Company" value={f.companyId} onChange={(e) => setF({ ...f, companyId: e.target.value })}>{d.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect>
              <NativeSelect label="Type of support" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{SUPPORT_TYPES.map((t) => <option key={t}>{t}</option>)}</NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={noteId}>What happened and what's next</Label>
              <Textarea id={noteId} placeholder="e.g. Walked through CIPC registration on BizPortal; follow up when the certificate arrives." value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
            </div>
            {err && <Callout tone="bad" role="alert">{err}</Callout>}
            <Button type="submit"><Save className="h-4 w-4" />Save</Button>
          </CardContent>
        </form>
      </Card>
      {(d.intros.length > 0 || d.tenderInterests.length > 0) && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Handshake className="h-4 w-4 text-primary" aria-hidden="true" />Introductions and tender interest</CardTitle></CardHeader>
          <CardContent className="pt-0"><ul>
            {d.intros.map((i) => <RequestRow key={i.id} text={<><b>{i.company}</b> asked to meet {i.buyer}</>} status={i.status} onDecide={(s) => void call(`/adviser/intros/${i.id}`, { status: s })} />)}
            {d.tenderInterests.map((t) => <RequestRow key={t.id} text={<><b>{t.company}</b> is interested in “{t.title}”</>} status={t.status} onDecide={(s) => void call(`/adviser/tenders/${t.id}`, { status: s })} />)}
          </ul></CardContent>
        </Card>
      )}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4 text-primary" aria-hidden="true" />History</CardTitle></CardHeader>
        <CardContent className="pt-0">
          {d.logs.length ? <ul>{d.logs.map((l) => (
            <ListRow key={l.id} side={<RowHint>{shortDate(l.date)}</RowHint>}>
              <p><b>{l.company}</b> · {l.type}</p>
              <RowHint>{l.note}</RowHint>
            </ListRow>
          ))}</ul> : <EmptyState icon={History}>No support logged yet.</EmptyState>}
        </CardContent>
      </Card>
    </>
  );
}
