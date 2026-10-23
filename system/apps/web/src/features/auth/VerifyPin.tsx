// Email one-time PIN after sign-in, for funder, adviser and admin accounts.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Notice, Spinner } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { meKey, useMe } from "../../lib/me";
import { AuthPageShell } from "./SignIn";

export default function VerifyPin() {
  const { status, signOut } = useAuth();
  const me = useMe();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [code, setCode] = useState("");
  const sentOnce = useRef(false);

  const send = useMutation({ mutationFn: () => api<{ sentTo: string; expiresInMinutes: number }>("/auth/otp/request", { body: { purpose: "sign_in" } }) });
  const verify = useMutation({
    mutationFn: (c: string) => api("/auth/otp/verify", { body: { purpose: "sign_in", code: c } }),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: meKey }); nav("/", { replace: true }); },
  });

  const needs = me.data?.needsOtp;
  useEffect(() => {
    if (needs && !sentOnce.current) { sentOnce.current = true; send.mutate(); }
  }, [needs, send]);

  if (status === "signedOut") return <Navigate to="/sign-in" replace />;
  if (me.isPending) return <Spinner />;
  if (me.data && !me.data.needsOtp) return <Navigate to="/" replace />;

  const err = (verify.error ?? send.error) as ApiError | null;
  return (
    <AuthPageShell>
      <div><h1>Check your email</h1>
        <p className="muted mt-1.5">{send.data ? `We sent a 6-digit PIN to ${send.data.sentTo}. It expires in ${send.data.expiresInMinutes} minutes.` : "Sending a 6-digit PIN to your email…"}</p>
      </div>
      <form className="panel flex flex-col gap-3" noValidate onSubmit={(e) => { e.preventDefault(); verify.mutate(code); }}>
        <label className="field"><span>PIN</span>
          <input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} className="mono text-center text-xl tracking-[.4em]"
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} autoFocus />
        </label>
        {err && <p className="err" role="alert">{err.message}</p>}
        <button className="btn primary" type="submit" disabled={code.length !== 6 || verify.isPending}>Continue</button>
        <button className="btn ghost self-start" type="button" onClick={() => send.mutate()} disabled={send.isPending}>Send a new PIN</button>
      </form>
      <Notice tone="warn" icon="!"><span className="small">ProofPocket will never phone you or message you to ask for this PIN.</span></Notice>
      <button className="btn sm self-start" onClick={() => void signOut()}>Use a different account</button>
    </AuthPageShell>
  );
}
