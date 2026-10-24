// Registration steps (v2/app.js vStart).
import { zodResolver } from "@hookform/resolvers/zod";
import { DOC_STATE_LABEL, cipcNumberSchema, canUpload, shortFingerprint, type DocType } from "@proofpocket/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FilePick } from "../../components/FilePick";
import { Notice, Pill, Spinner, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { meKey } from "../../lib/me";
import { FounderHead } from "./FounderHead";
import type { DocumentsResponse } from "./types";

const SUB = "Everything a business needs to trade formally, one step at a time. The first four make you a Verified business; the rest open tenders and bigger funding.";

export default function Start() {
  const qc = useQueryClient();
  const toast = useToast();
  const [err, setErr] = useState("");
  const q = useQuery({ queryKey: ["founder-documents"], queryFn: () => api<DocumentsResponse>("/founder/documents") });
  const cipc = useForm<{ cipcNumber: string }>({ resolver: zodResolver(cipcNumberSchema) });
  if (!q.data) return <><FounderHead title="Registration steps" sub={SUB} /><Spinner /></>;
  const d = q.data;
  const doc = (k: DocType) => d.documents.find((x) => x.docType === k)!;

  const attach = async (k: DocType, fileId: string) => {
    setErr("");
    try {
      const r = await api<{ message: string }>("/founder/documents", { body: { docType: k, fileId } });
      toast(r.message);
      await qc.invalidateQueries({ queryKey: ["founder-documents"] });
    } catch (x) { setErr(x instanceof ApiError ? x.message : "Try again."); }
  };
  const saveCipc = cipc.handleSubmit(async (v) => {
    try {
      const r = await api<{ message: string }>("/founder/cipc", { method: "PUT", body: v });
      toast(r.message);
      await Promise.all([qc.invalidateQueries({ queryKey: ["founder-documents"] }), qc.invalidateQueries({ queryKey: meKey })]);
    } catch (x) { cipc.setError("cipcNumber", { message: x instanceof ApiError ? x.message : "Try again." }); }
  });

  const docLine = (k: DocType) => {
    const x = doc(k);
    return x.sha256 && x.state !== "missing" && <span className="fp">{x.fileName ? `${x.fileName} · ` : ""}fingerprint {shortFingerprint(x.sha256)}</span>;
  };
  const uploadButton = (k: DocType, primaryWhenMissing = true) => {
    const st = doc(k).state;
    return canUpload(st) && <FilePick label={st === "missing" ? "Upload" : "Replace"} primary={primaryWhenMissing && st === "missing"} onUploaded={(f) => attach(k, f.fileId)} onError={setErr} />;
  };

  return (
    <>
      <FounderHead title="Registration steps" sub={SUB} />
      <Notice tone={d.company.verified ? "good" : "info"} icon={d.company.verified ? "✓" : "i"}>
        <span className="small">{d.company.verified
          ? <><b>Verified.</b> Funders, buyers and the public directory can now see your business{d.company.cipcNumber ? ` (CIPC ${d.company.cipcNumber})` : ""}.</>
          : <><b>Who checks your documents?</b> {d.checker.kind === "adviser" ? `Your adviser at ${d.checker.name} checks each upload, usually within two working days.` : "A ProofPocket checker reviews each upload."} Each file gets a fingerprint so it can't be swapped later.</>}
        </span>
      </Notice>
      {!d.company.cipcNumber && (
        <form className="panel row" style={{ alignItems: "end" }} onSubmit={saveCipc} noValidate>
          <label className="field" style={{ flex: 1, minWidth: 200 }}><span>Registered with CIPC already? Enter your number</span>
            <input type="text" className="mono" placeholder="2026/123456/07" {...cipc.register("cipcNumber")} />
          </label>
          <button className="btn" type="submit">Save number</button>
          {cipc.formState.errors.cipcNumber && <p className="err w-full">{cipc.formState.errors.cipcNumber.message}</p>}
        </form>
      )}
      {err && <p className="err" role="alert">{err}</p>}
      <div className="stack">
        {d.steps.map((s, i) => {
          const x = doc(s.key);
          const done = x.state === "verified";
          return (
            <section key={s.key} className={`panel startstep ${done ? "done" : ""}`} aria-label={s.title}>
              <span className="sn" aria-hidden="true">{done ? "✓" : i + 1}</span>
              <div className="li-main">
                <div className="row" style={{ gap: 8 }}>
                  <h3>{s.title}</h3>
                  {s.neededToVerify ? <Pill tone="info">Needed to verify</Pill> : <Pill tone="plain">{s.key === "tax" ? "Needed for funding" : "Needed for tenders"}</Pill>}
                </div>
                <p className="small muted">{s.how}</p>
                {docLine(s.key)}
                {x.sentBackReason && <span className="small text-bad">Sent back: {x.sentBackReason}</span>}
                {x.expiresOn && x.state === "verified" && <span className="hint">Valid until {x.expiresOn}</span>}
              </div>
              <div className="li-side"><Pill tone={DOC_STATE_LABEL[x.state].tone}>{DOC_STATE_LABEL[x.state].label}</Pill>{uploadButton(s.key)}</div>
            </section>
          );
        })}
      </div>
      <section className="panel">
        <h2>Other documents funders ask for</h2>
        {(["bplan", "fin"] as const).map((k) => (
          <div key={k} className="li">
            <div className="li-main">
              <span>{doc(k).name}</span>
              <span className="hint">{k === "fin" ? "Your ProofPocket books can be handed to an accountant to prepare and sign these." : "Your adviser can help you write one."}</span>
              {docLine(k)}
            </div>
            <div className="li-side"><Pill tone={DOC_STATE_LABEL[doc(k).state].tone}>{DOC_STATE_LABEL[doc(k).state].label}</Pill>{uploadButton(k)}</div>
          </div>
        ))}
      </section>
    </>
  );
}
