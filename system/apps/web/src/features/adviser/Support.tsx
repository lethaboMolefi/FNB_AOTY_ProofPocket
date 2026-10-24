// Support log (v2/app.js ngoSupport): log support, introductions and tender interest to arrange, history.
import { SUPPORT_TYPES, shortDate } from "@proofpocket/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import { PageHead, Pill, Spinner, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";

interface Data {
  incubator: string; companies: { id: string; name: string }[];
  logs: { id: string; company: string; date: string; type: string; note: string }[];
  intros: { id: string; company: string; buyer: string; status: string }[];
  tenderInterests: { id: string; company: string; title: string; status: string }[];
}

export function RequestRow({ text, status, onDecide }: { text: ReactNode; status: string; onDecide: (s: "arranged" | "declined") => void }) {
  return (
    <div className="li"><span className="small">{text}</span>
      <div className="li-side">{status === "requested" ? <div className="row" style={{ gap: 6 }}>
        <button className="btn sm primary" onClick={() => onDecide("arranged")}>Mark arranged</button>
        <button className="btn sm" onClick={() => onDecide("declined")}>Decline</button></div>
        : <Pill tone={status === "arranged" ? "good" : "plain"}>{status === "arranged" ? "Arranged" : "Declined"}</Pill>}</div></div>
  );
}

export default function Support() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["adviser", "support"], queryFn: () => api<Data>("/adviser/support") });
  const [f, setF] = useState({ companyId: "", type: SUPPORT_TYPES[0] as string, note: "" });
  const [err, setErr] = useState("");
  if (!q.data) return <><PageHead title="Support log" /><Spinner /></>;
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
      <PageHead label={d.incubator} title="Support log" sub="Record every intervention so funders and your monitoring and evaluation reports show what support each company received." />
      <form className="panel stack" onSubmit={submit} noValidate>
        <h2>Log support</h2>
        <div className="form-grid">
          <label className="field"><span>Company</span><select value={f.companyId} onChange={(e) => setF({ ...f, companyId: e.target.value })}>{d.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className="field"><span>Type of support</span><select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{SUPPORT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label className="field" style={{ gridColumn: "1/-1" }}><span>What happened and what's next</span><textarea placeholder="e.g. Walked through CIPC registration on BizPortal; follow up when the certificate arrives." value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
        </div>
        {err && <p className="err" role="alert">{err}</p>}
        <div className="row between"><span className="hint">Shows on the company's timeline.</span><button className="btn primary" type="submit">Save</button></div>
      </form>
      {(d.intros.length > 0 || d.tenderInterests.length > 0) && (
        <section className="panel">
          <h2>Introductions and tender interest</h2>
          {d.intros.map((i) => <RequestRow key={i.id} text={<><b>{i.company}</b> asked to meet {i.buyer}</>} status={i.status} onDecide={(s) => void call(`/adviser/intros/${i.id}`, { status: s })} />)}
          {d.tenderInterests.map((t) => <RequestRow key={t.id} text={<><b>{t.company}</b> is interested in “{t.title}”</>} status={t.status} onDecide={(s) => void call(`/adviser/tenders/${t.id}`, { status: s })} />)}
        </section>
      )}
      <section className="panel">
        <h2>History</h2>
        {d.logs.length ? d.logs.map((l) => <div key={l.id} className="tl"><span className="when">{shortDate(l.date)}</span><span><b>{l.company}</b> · {l.type}<br /><span className="small muted">{l.note}</span></span></div>)
          : <p className="muted">No support logged yet.</p>}
      </section>
    </>
  );
}
