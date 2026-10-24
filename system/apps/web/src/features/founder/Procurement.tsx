// Procurement (v2/app.js vProcurement).
import { R, shortDate, type DocType } from "@proofpocket/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Pill, Spinner, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { FounderHead } from "./FounderHead";

interface Data {
  recordMonths: number; verified: boolean; tenderDocs: number;
  tenders: { id: string; title: string; buyer: string; value: number; closesOn: string; months: number; yourSector: boolean; requirements: { docType: DocType; short: string; ok: boolean }[]; monthsOk: boolean;
    action: { kind: "verify_first" } | { kind: "add_documents"; missing: DocType[] } | { kind: "more_months"; months: number } | { kind: "can_express" }; interest: string | null }[];
}
const SUB = "Tenders and supplier opportunities. Buyers see your checked documents and your track record on ProofPocket, so you don't have to prove it from scratch each time.";

export default function Procurement() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["founder", "procurement"], queryFn: () => api<Data>("/founder/procurement") });
  if (!q.data) return <><FounderHead title="Procurement" sub={SUB} /><Spinner /></>;
  const d = q.data;
  const interest = async (id: string) => {
    try { toast((await api<{ message: string }>(`/founder/tenders/${id}/interest`, { body: {} })).message); void qc.invalidateQueries({ queryKey: ["founder", "procurement"] }); }
    catch (e) { toast((e as ApiError).message); }
  };
  return (
    <>
      <FounderHead title="Procurement" sub={SUB} />
      <div className="grid-3">
        <div className="panel stat"><span className="label">Track record</span><span className="v">{d.recordMonths}<span className="small muted"> of 6 months</span></span><div className="bar" style={{ width: "100%" }}><i style={{ width: `${Math.min(100, (d.recordMonths / 6) * 100)}%` }} /></div></div>
        <div className="panel stat"><span className="label">Account</span><span className="v" style={{ fontSize: "1.1rem" }}>{d.verified ? "Verified" : "Starter"}</span><span className="small muted">{d.verified ? "Buyers can check your documents" : "Verify to apply"}</span></div>
        <div className="panel stat"><span className="label">Tender documents</span><span className="v" style={{ fontSize: "1.1rem" }}>{d.tenderDocs} of 3</span><span className="small muted">Tax, CSD, B-BBEE</span></div>
      </div>
      <div className="table-wrap"><table>
        <thead><tr><th>Opportunity</th><th>Value</th><th>Closes</th><th>Needs</th><th /></tr></thead>
        <tbody>{d.tenders.map((t) => (
          <tr key={t.id}>
            <td><b>{t.title}</b><div className="hint">{t.buyer}{t.yourSector && <> · <Pill tone="info">Your sector</Pill></>}</div></td>
            <td className="num">{R(t.value)}</td><td className="num">{shortDate(t.closesOn)}</td>
            <td><div className="row" style={{ gap: 4 }}>{t.requirements.map((r) => <span key={r.docType} className="chip">{r.ok ? "✓" : "×"} {r.short}</span>)}<span className="chip">{t.monthsOk ? "✓" : "×"} {t.months} months' record</span></div></td>
            <td className="r">{t.interest ? <Pill tone="good">{t.interest === "arranged" ? "Passed to buyer" : t.interest === "declined" ? "Not taken further" : "Interest sent"}</Pill>
              : t.action.kind === "verify_first" ? <Pill tone="plain">Verify first</Pill>
              : t.action.kind === "add_documents" ? <Link className="btn sm" to="/app/start">Add {t.action.missing.length} document{t.action.missing.length > 1 ? "s" : ""}</Link>
              : t.action.kind === "more_months" ? <Pill tone="plain">{t.action.months} more month{t.action.months > 1 ? "s" : ""}</Pill>
              : <button className="btn sm primary" onClick={() => void interest(t.id)}>Express interest</button>}</td>
          </tr>
        ))}{!d.tenders.length && <tr><td colSpan={5} className="muted">No open tenders right now.</td></tr>}</tbody>
      </table></div>
    </>
  );
}
