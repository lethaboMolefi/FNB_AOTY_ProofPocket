// Set your requirements (v2/app.js funderSetup), also used for "Add a programme".
import { DOCS, FUNDER_KINDS, FUNDER_REQUIRABLE_DOCS, type DocType } from "@proofpocket/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { PageHead, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { meKey, useMe } from "../../lib/me";

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
    <label className="field"><span>{label}</span><input type="number" min={0} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...extra} /></label>
  );
  return (
    <form className="panel stack" onSubmit={submit} noValidate>
      <div className="form-grid">
        <label className="field"><span>Programme name</span><input type="text" placeholder="e.g. Township Starter Grant" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label className="field"><span>Type</span><select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{FUNDER_KINDS.map((k) => <option key={k}>{k}</option>)}</select></label>
        {num("minAmount", "Smallest amount (R)")}{num("maxAmount", "Largest amount (R)")}{num("budget", "Total budget (R)")}
        {num("minMonths", "Months of records needed", { max: 36 })}{num("minScore", "Minimum readiness score", { max: 100 })}
      </div>
      <fieldset><legend className="label mb-1.5">Documents applicants must have checked</legend>
        <div className="row" style={{ gap: 6 }}>{FUNDER_REQUIRABLE_DOCS.map((k) => (
          <label key={k} className="chip"><input type="checkbox" checked={req.includes(k)} onChange={(e) => setReq(e.target.checked ? [...req, k] : req.filter((x) => x !== k))} /> {DOCS[k].name}</label>
        ))}</div>
      </fieldset>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="row between"><span className="hint">You can change requirements later. Founders see every change.</span>
        <div className="row" style={{ gap: 6 }}>{onCancel && <button className="btn" type="button" onClick={onCancel}>Cancel</button>}<button className="btn primary" type="submit">Save and open pipeline</button></div></div>
    </form>
  );
}

export default function Setup() {
  const me = useMe().data;
  const qc = useQueryClient();
  const nav = useNavigate();
  return (
    <>
      <PageHead label={me?.org?.name} title="Set your requirements" sub="Before you see companies, tell founders what you need. They see these requirements on their Funding page before they apply, so fewer incomplete applications reach you." />
      <ProgrammeForm onDone={async () => { await qc.invalidateQueries({ queryKey: meKey }); nav("/funder/pipeline", { replace: true }); }} />
    </>
  );
}
