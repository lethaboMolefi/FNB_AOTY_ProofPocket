// The step after the password: the Google Authenticator code, or setting it up first (required accounts).
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Notice, Spinner } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { meKey, useMe } from "../../lib/me";
import { AuthPageShell } from "./SignIn";
import { AuthenticatorSetup, CodeInput } from "./TwoFactor";

export default function VerifyPin() {
  const { status, signOut } = useAuth();
  const me = useMe();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [code, setCode] = useState("");
  const done = async () => { await qc.invalidateQueries({ queryKey: meKey }); nav("/", { replace: true }); };
  const verify = useMutation({ mutationFn: () => api("/auth/totp/verify", { body: { code } }), onSuccess: done });

  if (status === "signedOut") return <Navigate to="/sign-in" replace />;
  if (me.isPending) return <Spinner />;
  // Signed in but no account yet: there's no code to enter; finish joining first.
  if (me.error instanceof ApiError && me.error.code === "no_account") return <Navigate to="/join" replace />;
  if (me.data && !me.data.needsOtp) return <Navigate to="/" replace />;
  const settingUp = me.data && !me.data.twoFactor.enabled;

  return (
    <AuthPageShell toSignIn>
      {settingUp ? (
        <>
          <div><h1>Set up two-step sign-in</h1><p className="muted mt-1.5">Funder, adviser and admin accounts use Google Authenticator to keep founders' records safe. It takes a minute, once.</p></div>
          <section className="panel"><AuthenticatorSetup onDone={done} /></section>
        </>
      ) : (
        <>
          <div><h1>Enter your code</h1><p className="muted mt-1.5">Open Google Authenticator on your phone and enter the 6-digit code shown for ProofPocket.</p></div>
          <form className="panel stack" noValidate onSubmit={(e) => { e.preventDefault(); verify.mutate(); }}>
            <CodeInput value={code} onChange={setCode} label="Code" />
            {verify.error && <p className="err" role="alert">{(verify.error as ApiError).message}</p>}
            <button className="btn primary" type="submit" disabled={code.length !== 6 || verify.isPending}>Continue</button>
          </form>
          <p className="hint">Lost your phone? Contact ProofPocket: an admin can reset it after checking who you are.</p>
        </>
      )}
      <Notice tone="warn" icon="!"><span className="small">ProofPocket will never phone you or message you to ask for your password or a code.</span></Notice>
      <button className="btn sm self-start" onClick={() => void signOut()}>Use a different account</button>
    </AuthPageShell>
  );
}
