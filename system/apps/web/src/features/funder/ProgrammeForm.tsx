// Set your requirements (v2/app.js funderSetup), also used for "Add a programme".
import { DOCS, FUNDER_KINDS, FUNDER_REQUIRABLE_DOCS, type DocType } from "@proofpocket/shared";
import { useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { NativeSelect, TextField } from "@/components/ui/field";
import { PageHeader } from "../../components/PageHeader";
import { ToggleChips } from "../../components/ToggleChips";
import { useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { meKey } from "../../lib/me";

export function ProgrammeForm({ onDone, onCancel }: { onDone: () => void; onCancel?: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: "", kind: "Grant", minAmount: "5000", maxAmount: "30000", budget: "500000", minMonths: "3", minScore: "40" });
  const [req, setReq] = useState<DocType[]>(["cipc", "bank", "tax"]);
  const [err, setErr] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr("");
    const body = { name: f.name, kind: f.kind, minAmount: Number(f.minAmount), maxAmount: Number(f.maxAmount), budget: Number(f.budget), minMonths: Number(f.minMonths), minScore: Number(f.minScore), requiredDocs: req };
    if (!f.name.trim() || !body.maxAmount || body.minAmount > body.maxAmount) { setErr("Add a programme name, and make sure the smallest amount isn't bigger than the largest."); return; }
    try { toast((await api<{ message: string }>("/funder/programmes", { body })).message); onDone(); }
    catch (x) { setErr((x as ApiError).message); }
  };
  const num = (k: keyof typeof f, label: string, extra: object = {}) => (
    <TextField label={label} type="number" min={0} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...extra} />
  );
  return (
    <Card>
      <form onSubmit={submit} noValidate>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <TextField label="Programme name" placeholder="e.g. Township Starter Grant" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            <NativeSelect label="Type" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{FUNDER_KINDS.map((k) => <option key={k}>{k}</option>)}</NativeSelect>
            {num("minAmount", "Smallest amount (R)")}{num("maxAmount", "Largest amount (R)")}{num("budget", "Total budget (R)")}
            {num("minMonths", "Months of records needed", { max: 36 })}{num("minScore", "Minimum readiness score", { max: 100 })}
          </div>
          <ToggleChips legend="Documents applicants must have checked" options={FUNDER_REQUIRABLE_DOCS.map((k) => ({ value: k, label: DOCS[k].name }))} value={req} onChange={setReq} />
          {err && <Callout tone="bad" role="alert">{err}</Callout>}
        </CardContent>
        <CardFooter className="flex flex-wrap justify-between gap-3">
          <CardDescription>You can change requirements later. Founders see every change.</CardDescription>
          <div className="flex gap-2">
            {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}
            <Button type="submit"><Save className="h-4 w-4" />Save and open pipeline</Button>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function Setup() {
  const qc = useQueryClient();
  const nav = useNavigate();
  return (
    <>
      <PageHeader title="Set your requirements" sub="Before you see companies, tell founders what you need. They see these requirements on their Funding page before they apply, so fewer incomplete applications reach you." />
      <ProgrammeForm onDone={async () => { await qc.invalidateQueries({ queryKey: meKey }); nav("/funder/pipeline", { replace: true }); }} />
    </>
  );
}
