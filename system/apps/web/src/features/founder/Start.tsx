// Registration steps (v2/app.js vStart) — rebuilt with shadcn.
import { zodResolver } from "@hookform/resolvers/zod";
import { DOC_STATE_LABEL, cipcNumberSchema, canUpload, shortFingerprint, type DocType } from "@proofpocket/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { AlertCircle, BadgeCheck, CheckCircle2, Clock, FileText, Info, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { FilePick } from "../../components/FilePick";
import { Spinner } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { meKey } from "../../lib/me";
import { useToast } from "../../components/ui";
import { FounderHead } from "./FounderHead";
import type { DocumentsResponse } from "./types";
import type { Tone } from "@proofpocket/shared";

const SUB = "Everything a business needs to trade formally, one step at a time. The first four make you Verified; the rest open tenders and bigger funding.";

const STATE_ICON: Record<string, React.ReactNode> = {
  verified: <CheckCircle2 className="h-4 w-4 text-good" />,
  pending:  <Clock className="h-4 w-4 text-warn" />,
  missing:  <FileText className="h-4 w-4 text-muted-foreground" />,
  expired:  <XCircle className="h-4 w-4 text-bad" />,
};

const TONE_VARIANT: Record<Tone, "success" | "warning" | "destructive" | "secondary" | "outline"> = {
  good:  "success",
  warn:  "warning",
  bad:   "destructive",
  info:  "secondary",
  plain: "outline",
};

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
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["founder-documents"] }),
        qc.invalidateQueries({ queryKey: meKey }),
      ]);
    } catch (x) {
      cipc.setError("cipcNumber", { message: x instanceof ApiError ? x.message : "Try again." });
    }
  });

  return (
    <>
      <FounderHead title="Registration steps" sub={SUB} />

      {/* Status notice */}
      <Card className={d.company.verified ? "border-good/40 bg-good-soft/20" : "border-primary/20 bg-primary/5"}>
        <CardContent className="flex items-start gap-3 p-4">
          {d.company.verified
            ? <BadgeCheck className="h-5 w-5 text-good shrink-0 mt-0.5" />
            : <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />}
          <p className="text-sm">
            {d.company.verified
              ? <><strong>Verified.</strong> Funders, buyers and the public directory can now see your business{d.company.cipcNumber ? ` (CIPC ${d.company.cipcNumber})` : ""}.</>
              : <><strong>Who checks your documents?</strong>{" "}{d.checker.kind === "adviser" ? `Your adviser at ${d.checker.name} checks each upload, usually within two working days.` : "A ProofPocket checker reviews each upload."} Each file gets a fingerprint so it can't be swapped later.</>}
          </p>
        </CardContent>
      </Card>

      {/* CIPC number entry */}
      {!d.company.cipcNumber && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Already registered with CIPC?</CardTitle>
            <CardDescription>Enter your registration number to link it to your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveCipc} noValidate>
              <div className="flex gap-3 items-end">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="cipc-number">CIPC number</Label>
                  <Input id="cipc-number" className="font-mono" placeholder="2026/123456/07" {...cipc.register("cipcNumber")} />
                  {cipc.formState.errors.cipcNumber && (
                    <p className="text-xs text-destructive">{cipc.formState.errors.cipcNumber.message}</p>
                  )}
                </div>
                <Button type="submit" disabled={cipc.formState.isSubmitting}>Save number</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {err && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{err}
        </div>
      )}

      {/* Main steps */}
      <div className="space-y-3">
        {d.steps.map((s, i) => {
          const x = doc(s.key);
          const done = x.state === "verified";
          const stateInfo = DOC_STATE_LABEL[x.state];
          return (
            <Card key={s.key} className={done ? "border-good/40 bg-good-soft/10" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Step number */}
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold mt-0.5 ${
                    done ? "bg-good text-white" : "bg-primary/10 text-primary"
                  }`}>
                    {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h2 className="font-semibold text-sm text-foreground">{s.title}</h2>
                      <Badge variant={s.neededToVerify ? "default" : "outline"} className="text-[10px]">
                        {s.neededToVerify ? "Needed to verify" : s.key === "tax" ? "Needed for funding" : "Needed for tenders"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{s.how}</p>

                    {/* File fingerprint */}
                    {x.sha256 && x.state !== "missing" && (
                      <p className="mt-1.5 text-xs text-muted-foreground font-mono">
                        {x.fileName ? `${x.fileName} · ` : ""}fingerprint {shortFingerprint(x.sha256)}
                      </p>
                    )}
                    {x.sentBackReason && (
                      <p className="mt-1.5 text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> Sent back: {x.sentBackReason}
                      </p>
                    )}
                    {x.expiresOn && x.state === "verified" && (
                      <p className="mt-1 text-xs text-muted-foreground">Valid until {x.expiresOn}</p>
                    )}
                  </div>

                  {/* Status + upload */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="flex items-center gap-1.5">
                      {STATE_ICON[x.state]}
                      <Badge variant={TONE_VARIANT[stateInfo.tone]} className="text-[10px]">{stateInfo.label}</Badge>
                    </div>
                    {canUpload(x.state) && (
                      <FilePick
                        label={x.state === "missing" ? "Upload" : "Replace"}
                        primary={x.state === "missing"}
                        onUploaded={(f) => attach(s.key, f.fileId)}
                        onError={setErr}
                      />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Other docs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Other documents funders ask for</CardTitle>
          <CardDescription>Not required to be Verified, but increase your readiness score.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {(["bplan", "fin"] as const).map((k, i) => {
            const x = doc(k);
            const stateInfo = DOC_STATE_LABEL[x.state];
            return (
              <div key={k}>
                {i > 0 && <Separator className="mb-3" />}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{x.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {k === "fin"
                        ? "Your ProofPocket books can be handed to an accountant to prepare and sign these."
                        : "Your adviser can help you write one."}
                    </p>
                    {x.sha256 && x.state !== "missing" && (
                      <p className="mt-1 text-xs text-muted-foreground font-mono">
                        {x.fileName ? `${x.fileName} · ` : ""}fingerprint {shortFingerprint(x.sha256)}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <Badge variant={TONE_VARIANT[stateInfo.tone]} className="text-[10px]">{stateInfo.label}</Badge>
                    {canUpload(x.state) && (
                      <FilePick label={x.state === "missing" ? "Upload" : "Replace"} onUploaded={(f) => attach(k, f.fileId)} onError={setErr} />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </>
  );
}
