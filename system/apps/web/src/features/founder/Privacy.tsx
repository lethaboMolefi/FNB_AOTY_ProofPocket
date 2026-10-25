// Privacy & sharing (v2/app.js vPrivacy), plus choosing or leaving an incubator (inventory 12.12).
import { todayZA } from "@proofpocket/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Download, Loader2, Lock } from "lucide-react";
import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Spinner, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { FounderHead } from "./FounderHead";

type Sharing = "none" | "summary" | "full";
interface Data { sharing: Sharing; incubators: { id: string; name: string }[]; incubator: { id: string; name: string } | null; adviser: string | null; pendingRequest: { name: string } | null }

const SUB = "You decide who sees what. You can change this at any time.";
const OPTIONS: [Sharing, string, string][] = [
  ["none", "Nothing", "Funders can't find you. Applying to a programme still shares your profile with that funder only."],
  ["summary", "Summary", "Readiness score, document status (not the files) and monthly totals."],
  ["full", "Full books", "Everything in Summary, plus each entry in your books. Funders with full access can decide faster."],
];

function SharingCard({ current, onSave }: { current: Sharing; onSave: (s: Sharing) => Promise<void> }) {
  const [picked, setPicked] = useState<Sharing>(current);
  const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); try { await onSave(picked); } finally { setBusy(false); } };
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">What verified funders can see</CardTitle>
        <CardDescription>Your adviser always sees your records in order to help. This controls funders only.</CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup value={picked} onValueChange={(v) => setPicked(v as Sharing)} aria-label="What verified funders can see" className="space-y-3">
          {OPTIONS.map(([v, title, desc]) => (
            <label key={v} htmlFor={`sharing-${v}`} className={cn("flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
              picked === v ? "border-primary bg-primary/5" : "border-border hover:border-foreground/30")}>
              <RadioGroupItem id={`sharing-${v}`} value={v} className="mt-0.5" />
              <span className="flex-1">
                <span className="flex items-center gap-2 text-sm font-semibold">{title}{current === v && <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">current</span>}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{desc}</span>
              </span>
            </label>
          ))}
        </RadioGroup>
        <div className="flex justify-end pt-4">
          <Button onClick={() => void save()} disabled={busy || picked === current}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save</Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** POPIA access, correction and deletion: download everything, or ask ProofPocket to change it. */
function YourData() {
  const toast = useToast();
  const detailsId = useId();
  const [kind, setKind] = useState<"" | "correction" | "deletion">("");
  const [details, setDetails] = useState("");
  const download = async () => {
    try {
      const data = await api<unknown>("/founder/privacy/export");
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: `proofpocket-my-data-${todayZA()}.json` });
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { toast(e instanceof ApiError ? e.message : "The download didn't work. Try again."); }
  };
  const send = async () => {
    if (!kind) return;
    if (kind === "deletion" && !window.confirm("Ask ProofPocket to delete your data? We'll contact you before anything is deleted.")) return;
    try { toast((await api<{ message: string }>("/founder/privacy/requests", { body: { kind, details } })).message); setKind(""); setDetails(""); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Try again."); }
  };
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Your data</CardTitle>
        <CardDescription>Download everything ProofPocket keeps about your business, or ask us to correct or delete it. Read the <Link className="font-medium text-primary hover:underline" to="/privacy-notice">privacy notice</Link>.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button variant="outline" onClick={() => void download()}><Download className="h-4 w-4" />Download my data</Button>
        <NativeSelect label="Ask ProofPocket to" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          <option value="">Choose…</option>
          <option value="correction">Correct something</option>
          <option value="deletion">Delete my data</option>
        </NativeSelect>
        {kind && <div className="space-y-1.5"><Label htmlFor={detailsId}>What should we know? (optional)</Label><Textarea id={detailsId} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} /></div>}
        {kind && <Button variant={kind === "deletion" ? "destructive" : "default"} onClick={() => void send()}>Send request</Button>}
      </CardContent>
    </Card>
  );
}

export default function Privacy() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["founder", "privacy"], queryFn: () => api<Data>("/founder/privacy") });
  const [choice, setChoice] = useState("");
  const done = async (r: { message: string }) => { toast(r.message); await qc.invalidateQueries({ queryKey: ["founder"] }); };
  const fail = (e: unknown) => toast(e instanceof ApiError ? e.message : "Try again.");
  if (!q.data) return <><FounderHead title="Privacy & sharing" sub={SUB} /><Spinner /></>;
  const d = q.data;
  const setSharing = (s: Sharing) => api<{ message: string }>("/founder/privacy", { method: "PUT", body: { sharing: s } }).then(done, fail);
  const incubator = (id: string | null) => api<{ message: string }>("/founder/incubator", { body: { incubatorId: id } }).then(done, fail);
  return (
    <>
      <FounderHead title="Privacy & sharing" sub={SUB} />
      <SharingCard key={d.sharing} current={d.sharing} onSave={setSharing} />
      <div className="grid gap-6 desktop:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Lock className="h-4 w-4 text-primary" />Always private</CardTitle></CardHeader>
          <CardContent className="space-y-2.5">
            {["Your document files. Others see only whether they're checked.", "Your ID number and bank account number.", "Personal purchases you've marked."].map((t) => (
              <div key={t} className="flex items-start gap-2.5 text-sm"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-good" /><span>{t}</span></div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Your incubator</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">{d.incubator
              ? `${d.incubator.name} supports you and can see your books and documents in order to help. Adviser: ${d.adviser ?? "not assigned yet"}.`
              : "You haven't chosen an incubator."}</p>
            {d.pendingRequest && <Callout tone="info">You asked to join <b>{d.pendingRequest.name}</b>. They'll accept you soon.</Callout>}
            {d.incubator && <Button size="sm" variant="destructive" onClick={() => window.confirm(`Leave ${d.incubator!.name}? Your adviser will no longer see your records.`) && void incubator(null)}>Leave {d.incubator.name}</Button>}
            <div className="flex flex-wrap items-end gap-2">
              <NativeSelect className="min-w-[200px] flex-1" label={d.incubator ? "Move to another incubator" : "Ask an incubator to support you"} value={choice} onChange={(e) => setChoice(e.target.value)}>
                <option value="">Choose…</option>
                {d.incubators.filter((i) => i.id !== d.incubator?.id).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </NativeSelect>
              <Button variant="outline" disabled={!choice} onClick={() => void incubator(choice)}>Send request</Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <YourData />
    </>
  );
}
