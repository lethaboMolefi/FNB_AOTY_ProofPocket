// Admin: reports, feature requests, flagged payments and the sender watch list, tenders and requests.
import { DOCS, FUNDER_REQUIRABLE_DOCS, R, SECTORS, shortDate, todayZA, type DocType } from "@proofpocket/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { PageHead, Pill, Spinner, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { RequestRow } from "../adviser/Support";

function useCall() {
  const qc = useQueryClient();
  const toast = useToast();
  return async (path: string, body: object, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    try { toast((await api<{ message: string }>(path, { body })).message); void qc.invalidateQueries({ queryKey: ["admin"] }); }
    catch (e) { toast((e as ApiError).message); }
  };
}
const day = (iso: string) => shortDate(iso.slice(0, 10));

export function Reports() {
  const call = useCall();
  const q = useQuery({ queryKey: ["admin", "reports"], queryFn: () => api<{ reports: { id: string; target: string; company: string | null; reason: string; status: string; note: string | null; date: string }[] }>("/admin/reports") });
  if (!q.data) return <><PageHead title="Reports" /><Spinner /></>;
  return (
    <>
      <PageHead label="ProofPocket admin" title="Reports" sub="Businesses and payment requests reported by the public and founders. ProofPocket promises a review within two working days." />
      <section className="panel">{q.data.reports.length ? q.data.reports.map((r) => (
        <div key={r.id} className="li">
          <div className="li-main"><span><b>{r.company ?? "Unknown"}</b> · {r.target === "payment_request" ? "payment request" : r.target}</span>
            <span className="small">{r.reason || "No reason given"}</span><span className="hint">{day(r.date)}{r.note ? ` · ${r.note}` : ""}</span></div>
          <div className="li-side">{r.status === "open" ? <div className="row" style={{ gap: 6 }}>
            <button className="btn sm primary" onClick={() => { const note = window.prompt("What did you do?") ?? ""; void call(`/admin/reports/${r.id}`, { status: "resolved", note }); }}>Resolve</button>
            <button className="btn sm" onClick={() => void call(`/admin/reports/${r.id}`, { status: "dismissed", note: "" })}>Dismiss</button></div>
            : <Pill tone={r.status === "resolved" ? "good" : "plain"}>{r.status === "resolved" ? "Resolved" : "Dismissed"}</Pill>}</div>
        </div>
      )) : <p className="muted">No reports.</p>}</section>
    </>
  );
}

export function Features() {
  const call = useCall();
  const q = useQuery({ queryKey: ["admin", "features"], queryFn: () => api<{ posts: { id: string; company: string; verified: boolean; text: string; date: string; feature: string; featuredUntil: string | null }[] }>("/admin/features") });
  if (!q.data) return <><PageHead title="Feature requests" /><Spinner /></>;
  return (
    <>
      <PageHead label="ProofPocket admin" title="Feature requests" sub="Posts Verified businesses asked to feature in the directory. Featured posts show for 7 days. Reject anything misleading or harmful." />
      <section className="panel">{q.data.posts.length ? q.data.posts.map((p) => (
        <div key={p.id} className="li">
          <div className="li-main"><span><b>{p.company}</b> {!p.verified && <Pill tone="warn">No longer verified</Pill>}</span><span className="small">“{p.text}”</span><span className="hint">{shortDate(p.date)}</span></div>
          <div className="li-side">{p.feature === "requested" ? <div className="row" style={{ gap: 6 }}>
            <button className="btn sm primary" onClick={() => void call(`/admin/features/${p.id}`, { approve: true })}>Feature</button>
            <button className="btn sm" onClick={() => { const note = window.prompt("Reason the founder will see") ?? ""; void call(`/admin/features/${p.id}`, { approve: false, note }); }}>Reject</button></div>
            : <Pill tone="good">Featured{p.featuredUntil ? ` until ${shortDate(p.featuredUntil)}` : ""}</Pill>}</div>
        </div>
      )) : <p className="muted">No feature requests.</p>}</section>
    </>
  );
}

export function Flagged() {
  const call = useCall();
  const q = useQuery({ queryKey: ["admin", "flagged"], queryFn: () => api<{ payments: { id: string; ref: string; company: string; client: string; amount: number; attempts: number; date: string }[]; watchlist: { id: string; sender: string; reports: number; status: string; last: string }[] }>("/admin/flagged") });
  if (!q.data) return <><PageHead title="Flagged payments" /><Spinner /></>;
  return (
    <>
      <PageHead label="ProofPocket admin" title="Flagged payments" sub="Payment requests where a founder rejected the proof of payment twice, and senders founders reported." />
      <section className="panel"><h2>Possible fake proofs of payment</h2>{q.data.payments.length ? q.data.payments.map((p) => (
        <div key={p.id} className="li"><div className="li-main"><span><b>{p.company}</b> · <span className="mono">{p.ref}</span></span><span className="small">{p.client} · {R(p.amount)} · {p.attempts} proofs rejected</span></div><span className="hint">{day(p.date)}</span></div>
      )) : <p className="muted">None.</p>}</section>
      <section className="panel"><h2>Reported senders</h2>{q.data.watchlist.length ? q.data.watchlist.map((w) => (
        <div key={w.id} className="li">
          <div className="li-main"><span className="mono">{w.sender}</span><span className="hint">{w.reports} report{w.reports > 1 ? "s" : ""} · last {day(w.last)}</span></div>
          <div className="li-side">{w.status === "watch" ? <div className="row" style={{ gap: 6 }}>
            <button className="btn sm danger" onClick={() => void call(`/admin/watchlist/${w.id}`, { status: "confirmed_scam" })}>Confirm scam</button>
            <button className="btn sm" onClick={() => void call(`/admin/watchlist/${w.id}`, { status: "cleared" })}>Clear</button></div>
            : <Pill tone={w.status === "confirmed_scam" ? "bad" : "plain"}>{w.status === "confirmed_scam" ? "Confirmed scam" : "Cleared"}</Pill>}</div>
        </div>
      )) : <p className="muted">None.</p>}</section>
    </>
  );
}

export function Tenders() {
  const call = useCall();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "tenders"], queryFn: () => api<{ tenders: { id: string; title: string; buyer: string; value: number; closesOn: string; minMonths: number; sectors: string[]; requiredDocs: DocType[]; interested: number }[]; requests: { kind: "intro" | "tender"; id: string; company: string; about: string; status: string }[] }>("/admin/tenders") });
  const [f, setF] = useState({ title: "", buyerName: "", value: "", closesOn: "", minMonths: "3", sectors: [] as string[], requiredDocs: ["tax"] as DocType[] });
  const [err, setErr] = useState("");
  const all = [...new Set(Object.values(SECTORS).flat())];
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr("");
    try { toast((await api<{ message: string }>("/admin/tenders", { body: { ...f, value: Number(f.value), minMonths: Number(f.minMonths) } })).message); setF({ ...f, title: "", buyerName: "", value: "" }); void qc.invalidateQueries({ queryKey: ["admin"] }); }
    catch (x) { setErr((x as ApiError).message); }
  };
  if (!q.data) return <><PageHead title="Tenders & buyers" /><Spinner /></>;
  return (
    <>
      <PageHead label="ProofPocket admin" title="Tenders & buyers" sub="Opportunities founders can express interest in. Buyers are organisations; add them under Organisations." />
      <form className="panel stack" onSubmit={submit} noValidate>
        <h2>Publish a tender</h2>
        <div className="form-grid">
          <label className="field" style={{ gridColumn: "1/-1" }}><span>Title</span><input type="text" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
          <label className="field"><span>Buyer</span><input type="text" value={f.buyerName} onChange={(e) => setF({ ...f, buyerName: e.target.value })} /></label>
          <label className="field"><span>Value (R)</span><input type="number" min={1} value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} /></label>
          <label className="field"><span>Closes</span><input type="date" min={todayZA()} value={f.closesOn} onChange={(e) => setF({ ...f, closesOn: e.target.value })} /></label>
          <label className="field"><span>Months of records</span><input type="number" min={0} max={36} value={f.minMonths} onChange={(e) => setF({ ...f, minMonths: e.target.value })} /></label>
        </div>
        <div className="label">Sectors</div>
        <div className="row" style={{ gap: 6 }}>{all.map((s) => <label key={s} className="chip"><input type="checkbox" checked={f.sectors.includes(s)} onChange={(e) => setF({ ...f, sectors: e.target.checked ? [...f.sectors, s] : f.sectors.filter((x) => x !== s) })} /> {s}</label>)}</div>
        <div className="label">Documents needed</div>
        <div className="row" style={{ gap: 6 }}>{FUNDER_REQUIRABLE_DOCS.map((k) => <label key={k} className="chip"><input type="checkbox" checked={f.requiredDocs.includes(k)} onChange={(e) => setF({ ...f, requiredDocs: e.target.checked ? [...f.requiredDocs, k] : f.requiredDocs.filter((x) => x !== k) })} /> {DOCS[k].short}</label>)}</div>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn primary self-start" type="submit">Publish</button>
      </form>
      {q.data.requests.length > 0 && <section className="panel"><h2>Requests from companies without an incubator</h2>
        {q.data.requests.map((r) => <RequestRow key={r.id} text={<><b>{r.company}</b> {r.kind === "intro" ? `asked to meet ${r.about}` : `is interested in “${r.about}”`}</>} status={r.status} onDecide={(s) => void call(`/admin/${r.kind}s/${r.id}`, { status: s })} />)}</section>}
      <div className="table-wrap"><table>
        <thead><tr><th>Tender</th><th>Value</th><th>Closes</th><th>Needs</th><th className="r">Interested</th></tr></thead>
        <tbody>{q.data.tenders.map((t) => (
          <tr key={t.id}><td><b>{t.title}</b><div className="hint">{t.buyer} · {t.sectors.join(", ")}</div></td><td className="num">{R(t.value)}</td>
            <td className="num">{shortDate(t.closesOn)}{t.closesOn < todayZA() && <div className="hint">Closed</div>}</td>
            <td className="small">{t.requiredDocs.map((k) => DOCS[k].short).join(", ")} · {t.minMonths} months</td><td className="r num">{t.interested}</td></tr>
        ))}</tbody>
      </table></div>
    </>
  );
}
