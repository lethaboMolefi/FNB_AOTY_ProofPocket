// Document checks: advisers (their cohort) and the ProofPocket admin checker (companies without an incubator).
import { shortFingerprint } from "@proofpocket/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LevelPill, PageHead, Spinner, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { useMe } from "../../lib/me";

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
    try { const { url } = await api<{ url: string }>(`/files/${item.fileId}/download-url`); window.open(url, "_blank", "noopener"); }
    catch (e) { setErr((e as ApiError).message); }
  };
  return (
    <div className="li">
      <div className="li-main">
        <span><b>{item.companyName}</b> · {item.docName} <LevelPill verified={item.verified} /></span>
        <span className="fp">{item.fileName ?? "uploaded file"}{item.sha256 ? ` · fingerprint ${shortFingerprint(item.sha256)}` : ""}</span>
        {item.docType === "cipc" && item.cipcNumber && <span className="hint">CIPC number given: <span className="mono">{item.cipcNumber}</span></span>}
        <div className="form-grid mt-1.5" style={{ maxWidth: 520 }}>
          <label className="field"><span>Reason, if you send it back</span><input type="text" value={reason} onChange={(e) => { setReason(e.target.value); setErr(""); }} /></label>
          {EXPIRING.has(item.docType) && <label className="field"><span>Valid until (optional)</span><input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} /></label>}
        </div>
        {err && <p className="err" role="alert">{err}</p>}
      </div>
      <div className="li-side">
        {item.fileId && <button className="btn sm" onClick={() => void open()}>Open file</button>}
        <button className="btn sm primary" disabled={approve.isPending} onClick={() => approve.mutate()}>Approve</button>
        <button className="btn sm danger" disabled={reject.isPending} onClick={() => (reason.trim() ? reject.mutate() : setErr("Add a reason so the founder knows what to fix"))}>Send back</button>
      </div>
    </div>
  );
}

export default function Checks({ scope }: { scope: "adviser" | "admin" }) {
  const { data: me } = useMe();
  const q = useQuery({ queryKey: ["checks", scope], queryFn: () => api<{ queue: Item[] }>(`/${scope}/checks`) });
  return (
    <>
      <PageHead label={scope === "admin" ? "ProofPocket checker" : me?.org?.name} title={scope === "admin" ? "Checker queue" : "Document checks"}
        sub={scope === "admin"
          ? "Documents from companies without an incubator. Check each upload against the original or the issuer's records, then approve it or send it back with a reason."
          : "Check each upload against the original or the issuer's records, then approve it or send it back with a reason. A company becomes Verified when its four joining documents are approved."} />
      <section className="panel">
        {!q.data ? <Spinner /> : q.data.queue.length
          ? <div>{q.data.queue.map((i) => <Row key={i.id} item={i} scope={scope} />)}</div>
          : <p className="muted">No documents waiting. New uploads {scope === "admin" ? "from companies without an incubator" : "from your companies"} appear here.</p>}
      </section>
    </>
  );
}
